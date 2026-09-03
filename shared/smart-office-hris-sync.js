(function(global){
'use strict';
// 2026-08-18: the automatic PKWT deep-link ("HRIS -> klik PKWT -> Smart
// Office auto-buka card + auto-isi") was removed entirely per explicit
// user decision after it repeatedly froze the Smart Office tab (unbounded
// retry loop feeding a MutationObserver feeding the retry loop — see git
// history on this file for the earlier bounded-retry attempt, superseded
// by this simpler design). Replaced with a fully manual, user-triggered
// flow: admin opens Smart Office, picks PKWT themselves, and picks the
// employee by name/ID in the form (autocomplete datalist below) — no
// auto-navigation, no background retry timers, nothing that can spin.
if(!/\/smart-office(?:\/|$)/.test(location.pathname))return;
var KEY='smart_office_hris_employees_v3',rows=[];
var CANONICAL_DIRECTOR_NAME='Bobby Rahman M.B';
var CANONICAL_DIRECTOR_TITLE='Direktur Utama';
var enforceSignerTimer=null;
var mutationDebounce=null;

function gas(){return (global.RifimAPI&&global.RifimAPI._gasUrl)||global.GAS_WEB_APP_URL||''}
function auth(){try{return JSON.parse(localStorage.getItem('rifim_auth')||'{}')||{}}catch(_){return{}}}
// Hotfix 2026-09-03: pakai RifimPortalSession (auto-refresh) supaya
// /api/internal/hris-v2?mode=employees tidak kena 401 saat token expired.
function token(){
  try{
    var p=window.RifimPortalSession&&window.RifimPortalSession.read&&window.RifimPortalSession.read();
    if(p&&p.access_token)return String(p.access_token);
  }catch(_){}
  var a=auth();return String(a.access_token||a.accessToken||'');
}
function readCache(){try{var x=JSON.parse(localStorage.getItem(KEY)||'null');rows=x&&Array.isArray(x.rows)?x.rows:[]}catch(_){rows=[]}}
function save(r){rows=r||[];try{localStorage.setItem(KEY,JSON.stringify({at:Date.now(),rows:rows}))}catch(_){}}
async function refreshFast(){var t=token();if(!t)return null;var r=await fetch('/api/internal/hris-v2?mode=employees&company_code=ALL&status=ALL',{headers:{Authorization:'Bearer '+t},cache:'no-store'});var d=await r.json().catch(function(){return{}});if(!r.ok||d.success!==true)throw new Error(d.message||'HRIS employee API gagal');save(d.rows||d.employees||[]);return rows}
async function refreshGas(){var u=gas();if(!u)return rows;var url=new URL(u);url.searchParams.set('action','hris_employees');url.searchParams.set('company_code','ALL');url.searchParams.set('status','ALL');var res=await fetch(url.toString());var d=await res.json();if(d&&d.success)save(d.employees||d.rows||[]);return rows}
async function refresh(){try{var r=await refreshFast();if(r)return r}catch(e){console.warn('[SmartOffice HRIS fast]',e.message||e)}return refreshGas()}
function dep(e){if(e&&e.department)return e.department;var p=String((e&&e.position)||'').toLowerCase();if(p.includes('admin'))return'Administrasi';if(p.includes('management')||p.includes('manajemen'))return'Management';if(p.includes('direk'))return'Direktur';return'Operasional'}
function id(v){return String(v||'').trim().toLowerCase()}
function find(v){var x=id(v);return rows.find(function(e){return id(e.employee_id)===x||id(e.full_name)===x})||null}
function set(i,v,ro){var el=document.getElementById(i);if(!el||v==null)return false;el.value=String(v);if(ro)el.readOnly=true;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));return true}
function rupiah(v){return new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(v||0))}
function fillSigner(){var title=document.getElementById('signerTitle'),name=document.getElementById('signerName');if(title)title.value=CANONICAL_DIRECTOR_TITLE;if(name){name.value=CANONICAL_DIRECTOR_NAME;name.readOnly=true;name.dispatchEvent(new Event('input',{bubbles:true}))}return !!(title&&name)}
function installSignerOverride(){global._onSignerTitleChange=function(){var title=document.getElementById('signerTitle'),name=document.getElementById('signerName');if(!title||!name)return;if(String(title.value||'').trim().toLowerCase()===CANONICAL_DIRECTOR_TITLE.toLowerCase()){name.value=CANONICAL_DIRECTOR_NAME;name.readOnly=true;name.dispatchEvent(new Event('input',{bubbles:true}));return}name.readOnly=false};fillSigner()}
function enforceSigner(){
  // Single shared timer (not one-per-call) — see 2026-08-18 fix history.
  if(enforceSignerTimer)clearInterval(enforceSignerTimer);
  var tries=0;
  enforceSignerTimer=setInterval(function(){tries++;installSignerOverride();fillSigner();if(tries>=32){clearInterval(enforceSignerTimer);enforceSignerTimer=null}},250)
}
// Manual employee sync — this IS the "sinkronisasi dari Tab Karyawan"
// requested: admin picks a name/ID in the employee field (datalist below)
// and every mapped Smart Office field fills automatically. No auto-nav,
// no retry loop — runs once, synchronously, in response to a real user
// action (change/blur on the field).
function fill(e){if(!e)return false;var ok=false;ok=set('employee_name',e.full_name||'',true)||ok;ok=set('employee_id',e.employee_id||'',true)||ok;ok=set('employee_position',e.position||'',true)||ok;ok=set('employee_dept',dep(e),true)||ok;set('salary',rupiah(e.salary_base||0),true);if(e.join_date){set('join_date',e.join_date,true);set('contract_start',e.join_date,true)}if(e.end_date)set('contract_end',e.end_date,true);installSignerOverride();fillSigner();enforceSigner();return ok}
function dl(){var d=document.getElementById('soEmpMaster');if(!d){d=document.createElement('datalist');d.id='soEmpMaster';document.body.appendChild(d)}d.innerHTML=rows.filter(function(e){return String(e.status||'').toUpperCase()==='AKTIF'}).map(function(e){return '<option value="'+String(e.employee_id||'').replace(/"/g,'&quot;')+'">'+String(e.full_name||'')+' — '+String(e.position||'')+' — '+String(e.branch||'')+'</option>'}).join('')}
function bind(){['employee_id','employee_name'].forEach(function(i){var el=document.getElementById(i);if(!el||el.dataset.hrisBound)return;el.dataset.hrisBound='1';el.setAttribute('list','soEmpMaster');var run=async function(){var e=find(el.value);if(!e){await refresh().catch(function(){});e=find(el.value)}if(e)fill(e)};el.addEventListener('change',run);el.addEventListener('blur',run)});dl();installSignerOverride();fillSigner()}
async function syncPKWT(){try{var empEl=document.getElementById('employee_id'),startEl=document.getElementById('contract_start'),endEl=document.getElementById('contract_end');if(!empEl||!startEl||!endEl)return;var emp=String(empEl.value||'').trim();if(!emp)return;var t=token();if(!t)return;var num=String((document.getElementById('resultDocNum')||{}).textContent||'').trim();if(!num)return;var body={employee_id:emp,contract_type:'PKWT',document_number:num,gdoc_url:String((document.getElementById('resultGdocBtn')||{}).href||''),pdf_url:String((document.getElementById('resultPdfBtn')||{}).href||''),start_date:startEl.value||null,end_date:endEl.value||null,payload:{employee_name:(document.getElementById('employee_name')||{}).value||'',employee_position:(document.getElementById('employee_position')||{}).value||'',employee_dept:(document.getElementById('employee_dept')||{}).value||'',salary:(document.getElementById('salary')||{}).value||'',branch:(find(emp)||{}).branch||'',director_name:(document.getElementById('signerName')||{}).value||'',director_title:(document.getElementById('signerTitle')||{}).value||''}};var r=await fetch('/api/internal/hris-contract-sync',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+t},body:JSON.stringify(body)});var d=await r.json().catch(function(){return{}});if(!r.ok||d.success!==true)throw new Error(d.message||'Sync PKWT ke HRIS gagal');if(typeof global.showToast==='function')global.showToast('PKWT tersinkron ke HRIS Kontrak.','success')}catch(e){console.warn('[SmartOffice->HRIS]',e.message||e)}}
function onBodyMutated(){
  // Debounced, and does ONLY two things now: keep the employee-name
  // autocomplete rebound after the form re-renders (switching doc type
  // replaces #dynFields), and fire the post-generate PKWT->HRIS sync when
  // the result overlay appears. No deep-link, no retry chain — this can't
  // spin, because neither action here re-triggers a DOM mutation that
  // would feed back into this same observer in a loop.
  clearTimeout(mutationDebounce);
  mutationDebounce=setTimeout(function(){
    installSignerOverride();bind();fillSigner();
    var ov=document.getElementById('resultOverlay');
    if(ov&&ov.style.display&&ov.style.display!=='none')syncPKWT();
  },120)
}
function start(){readCache();installSignerOverride();fillSigner();enforceSigner();bind();refresh().then(function(){dl();bind()}).catch(function(){});new MutationObserver(onBodyMutated).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['style']})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})(window);
