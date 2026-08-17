(function(global){
'use strict';
if(!/\/hris(?:\/|$)/.test(location.pathname))return;

var CACHE='hris_contract_bridge_v1';
var EMP_SNAPSHOT='hris_employee_table_snapshot_v1';
var employeeFetchInFlight=null;
var employeeFetchKey='';

function role(){
  try{return String((global.currentUser&&global.currentUser.role)||JSON.parse(localStorage.getItem('rifim_auth')||'{}').role||'').toLowerCase()}
  catch(_){return''}
}
function canWrite(){return ['admin','direksi','direktur'].includes(role())}
function sb(){return global.supabase&&global.supabase.from?global.supabase:(global._supabase&&global._supabase.from?global._supabase:null)}
function esc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
function cacheGet(){try{return JSON.parse(localStorage.getItem(CACHE)||'null')}catch(_){return null}}
function cacheSet(rows){try{localStorage.setItem(CACHE,JSON.stringify({at:Date.now(),rows:rows||[]}))}catch(_){}}

function renderContracts(rows){
  var tb=document.getElementById('tbody-contracts');
  if(!tb)return;
  if(!rows||!rows.length){tb.innerHTML='<tr><td colspan="8" class="empty-state">Belum ada kontrak.</td></tr>';return}
  tb.innerHTML=rows.map(function(r){
    var act='';
    if(canWrite()&&String(r.validation_status||'pending')!=='validated')act='<button class="btn btn-success btn-sm" data-validate-contract="'+esc(r.id)+'">Validasi</button>';
    else act='<span class="badge '+(r.validation_status==='validated'?'badge-aktif':'badge-pending')+'">'+esc(r.validation_status||'pending')+'</span>';
    return '<tr><td>'+esc(r.employee_id)+'</td><td>'+esc(r.full_name||'-')+'</td><td>'+esc(r.contract_type||'-')+'</td><td>'+esc(r.start_date||'-')+'</td><td>'+esc(r.end_date||'-')+'</td><td>'+(r.pdf_url?'<a href="'+esc(r.pdf_url)+'" target="_blank">'+esc(r.document_number||'PDF')+'</a>':esc(r.document_number||'-'))+'</td><td>'+esc(r.contract_status||'-')+'</td><td>'+act+'</td></tr>'
  }).join('');
  tb.querySelectorAll('[data-validate-contract]').forEach(function(b){b.onclick=function(){validateContract(b.dataset.validateContract)}})
}

async function loadContractsBridge(){
  var c=cacheGet();
  if(c&&c.rows)renderContracts(c.rows);
  var client=sb();
  if(!client)return false;
  var q=await client.from('hris_contract_employee_view').select('*').order('updated_at',{ascending:false});
  if(q.error){console.warn('[HRIS contract bridge]',q.error.message);return false}
  cacheSet(q.data||[]);
  renderContracts(q.data||[]);
  return true
}

async function validateContract(id){
  var client=sb();
  if(!client)return alert('Supabase client belum siap');
  var r=await client.rpc('hris_validate_contract',{p_contract_id:id});
  if(r.error)return alert(r.error.message);
  await loadContractsBridge()
}

function isRealEmployeeRow(tr){
  if(!tr||!tr.cells||tr.cells.length<10)return false;
  if(tr.querySelector('.loading,.empty-state'))return false;
  var id=String(tr.cells[0]&&tr.cells[0].textContent||'').trim();
  var st=String(tr.cells[7]&&tr.cells[7].textContent||'').trim().toUpperCase();
  if(!id||!st)return false;
  if(/MEMUAT|LOADING|BELUM ADA|GAGAL|TIDAK ADA/i.test(id))return false;
  return ['AKTIF','NONAKTIF','NON-AKTIF','RESIGN','PHK'].includes(st)
}

async function activateEmployee(id,btn){
  if(!id||/MEMUAT|LOADING/i.test(id))return;
  if(!confirm('Aktifkan '+id+' dan mulai sinkron modul sesuai role?'))return;
  var client=sb();
  if(!client)return alert('Supabase client belum siap');
  btn.disabled=true;
  var old=btn.textContent;
  btn.textContent='Memproses…';
  var r=await client.rpc('hris_activate_employee',{p_employee_id:id});
  if(r.error){btn.disabled=false;btn.textContent=old;return alert(r.error.message)}
  btn.textContent='✓ Aktif';
  if(typeof global.showToast==='function')global.showToast('Karyawan aktif. Event sinkron dibuat.','success');
  if(typeof global.loadEmployees==='function')global.loadEmployees()
}

function decorateEmployees(){
  if(!canWrite())return;
  document.querySelectorAll('#tbody-employees tr').forEach(function(tr){
    if(!isRealEmployeeRow(tr))return;
    var cell=tr.lastElementChild;
    if(!cell||cell.querySelector('[data-activate-employee]'))return;
    var id=String(tr.cells[0].textContent||'').trim();
    var st=String(tr.cells[7].textContent||'').trim().toUpperCase();
    if(st==='AKTIF')return;
    var b=document.createElement('button');
    b.type='button';
    b.className='btn btn-success btn-sm';
    b.dataset.activateEmployee=id;
    b.textContent='✓ Aktifkan';
    b.onclick=function(){activateEmployee(id,b)};
    cell.appendChild(document.createTextNode(' '));
    cell.appendChild(b)
  })
}

function getEmployeeSnapshot(){
  try{return JSON.parse(localStorage.getItem(EMP_SNAPSHOT)||'null')}catch(_){return null}
}

function saveEmployeeSnapshot(){
  var tb=document.getElementById('tbody-employees');
  if(!tb)return;
  var realRows=Array.from(tb.querySelectorAll('tr')).filter(isRealEmployeeRow);
  if(!realRows.length)return;
  try{
    localStorage.setItem(EMP_SNAPSHOT,JSON.stringify({
      at:Date.now(),
      html:tb.innerHTML,
      stats:{
        total:document.getElementById('stat-total')&&document.getElementById('stat-total').textContent,
        aktif:document.getElementById('stat-aktif')&&document.getElementById('stat-aktif').textContent,
        pkwt:document.getElementById('stat-pkwt')&&document.getElementById('stat-pkwt').textContent,
        pkwtt:document.getElementById('stat-pkwtt')&&document.getElementById('stat-pkwtt').textContent
      }
    }))
  }catch(_){ }
}

function restoreEmployeeSnapshot(force){
  var tb=document.getElementById('tbody-employees');
  if(!tb)return false;
  var hasReal=Array.from(tb.querySelectorAll('tr')).some(isRealEmployeeRow);
  if(hasReal&&!force)return true;
  var snap=getEmployeeSnapshot();
  if(!snap||!snap.html)return false;
  tb.innerHTML=snap.html;
  var s=snap.stats||{};
  if(document.getElementById('stat-total')&&s.total!=null)document.getElementById('stat-total').textContent=s.total;
  if(document.getElementById('stat-aktif')&&s.aktif!=null)document.getElementById('stat-aktif').textContent=s.aktif;
  if(document.getElementById('stat-pkwt')&&s.pkwt!=null)document.getElementById('stat-pkwt').textContent=s.pkwt;
  if(document.getElementById('stat-pkwtt')&&s.pkwtt!=null)document.getElementById('stat-pkwtt').textContent=s.pkwtt;
  return true
}

function restoreEmployeeSnapshotIfLoading(){
  var tb=document.getElementById('tbody-employees');
  if(!tb||!tb.querySelector('.loading'))return;
  restoreEmployeeSnapshot(false)
}

function cleanInvalidActivationButtons(){
  document.querySelectorAll('#tbody-employees [data-activate-employee]').forEach(function(btn){
    var tr=btn.closest('tr');
    if(!isRealEmployeeRow(tr))btn.remove()
  })
}

function stabilizeEmployees(){
  cleanInvalidActivationButtons();
  restoreEmployeeSnapshotIfLoading();
  decorateEmployees();
  saveEmployeeSnapshot()
}

function patchEmployeeFetch(){
  if(typeof global._fetchEmployeesFast!=='function'||global._fetchEmployeesFast.__deduped)return;
  var origFetch=global._fetchEmployeesFast;
  var wrapped=async function(){
    var key=String(global.selectedCompany||'ALL');
    if(employeeFetchInFlight&&employeeFetchKey===key)return employeeFetchInFlight;
    employeeFetchKey=key;
    employeeFetchInFlight=Promise.resolve().then(function(){return origFetch.apply(global,arguments)}).finally(function(){employeeFetchInFlight=null;employeeFetchKey=''}.bind(null));
    return employeeFetchInFlight
  };
  wrapped.__deduped=true;
  global._fetchEmployeesFast=wrapped
}

function patchEmployeeLoader(){
  if(typeof global.loadEmployees!=='function'||global.loadEmployees.__stable)return;
  var origLoad=global.loadEmployees;
  var wrapped=function(opts){
    opts=opts||{};
    var tb=document.getElementById('tbody-employees');
    var hasReal=tb&&Array.from(tb.querySelectorAll('tr')).some(isRealEmployeeRow);
    if(!hasReal)restoreEmployeeSnapshot(false);
    if(opts.forceRefresh&&hasReal)opts=Object.assign({},opts,{forceRefresh:false});
    return origLoad.call(this,opts)
  };
  wrapped.__stable=true;
  global.loadEmployees=wrapped
}

function patch(){
  if(typeof global.loadContracts==='function'&&!global.loadContracts.__bridge){
    var orig=global.loadContracts;
    var f=async function(){var ok=await loadContractsBridge();if(!ok)return orig.apply(this,arguments)};
    f.__bridge=true;
    global.loadContracts=f
  }
  patchEmployeeFetch();
  patchEmployeeLoader();
  restoreEmployeeSnapshot(false);
  stabilizeEmployees();
  var root=document.getElementById('tbody-employees')||document.body;
  new MutationObserver(stabilizeEmployees).observe(root,{childList:true,subtree:true})
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',patch,{once:true});else patch();
})(window);
