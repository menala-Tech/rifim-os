(function(global){
'use strict';
if(!/\/finance(?:\/|$)/.test(String(location.pathname||'')))return;

var API='/api/internal/hris-contracts';
var PREFIX='rifim_finance_legacy_cache_v2:';
var MAX_STALE=24*60*60*1000;
var SUMMARY_TTL=15*60*1000;
var installed=false;
var ready=false;
var original=null;
var summaryAt=0;
var summaryBusy=false;
var pendingTab=null;
var releasingTab=false;

var DIRECT_GET={
  finance_kpi_target_branch_list:'finance_branch_targets',
  finance_kpi_target_staff_list:'finance_staff_targets',
  finance_drivers_list:'finance_drivers',
  finance_branches_list:'finance_branches'
};
var DIRECT_POST={
  finance_saldo_raos_mark_paid:'finance_saldo_mark_paid',
  finance_tagihan_add:'finance_tagihan_add',
  finance_tagihan_mark_paid:'finance_tagihan_mark_paid',
  finance_kpi_target_branch_upsert:'finance_branch_target_upsert',
  finance_kpi_target_staff_upsert:'finance_staff_target_upsert',
  finance_payroll_compute:'finance_payroll_compute',
  finance_driver_assign_random:'finance_driver_assign'
};
var LEGACY_READ=new Set([
  'finance_list','finance_cabang_list','finance_tagihan_list',
  'finance_rekap_harian','finance_rekap_bulanan','finance_log_list'
]);

function auth(){try{return JSON.parse(localStorage.getItem('rifim_auth')||'{}')||{}}catch(_){return{}}}
function rawToken(){var a=auth();return String(a.access_token||a.accessToken||'')}
async function sessionToken(){
  if(global.RifimPortalSession&&typeof global.RifimPortalSession.validate==='function'){
    var s=await global.RifimPortalSession.validate();
    if(!s||!s.access_token)throw new Error('Session berakhir. Silakan login ulang melalui Portal.');
    return String(s.access_token);
  }
  var t=rawToken();if(!t)throw new Error('Session token tidak ada. Login ulang melalui Portal.');return t;
}
function scope(){var a=auth();return String(a.id||a.user_id||a.email||'anonymous').replace(/[^a-zA-Z0-9@._-]/g,'_')}
function cacheKey(action,params){return PREFIX+scope()+':'+action+':'+JSON.stringify(params||{})}
function readCache(action,params){try{var raw=localStorage.getItem(cacheKey(action,params));if(!raw)return null;var x=JSON.parse(raw);if(!x||!x.at||!x.payload)return null;if(Date.now()-x.at>MAX_STALE)return null;return x}catch(_){return null}}
function writeCache(action,params,payload){try{localStorage.setItem(cacheKey(action,params),JSON.stringify({at:Date.now(),payload:payload}))}catch(_){}}
function val(id){var e=document.getElementById(id);return e?String(e.value||'').trim():''}
function money(n){return 'Rp '+(Number(n)||0).toLocaleString('id-ID')}
function setText(id,v){var e=document.getElementById(id);if(e)e.textContent=v}

async function apiGet(mode,params){
  var t=await sessionToken();
  var qs=new URLSearchParams({mode:mode});
  Object.keys(params||{}).forEach(function(k){var v=params[k];if(v!==''&&v!=null)qs.set(k,String(v))});
  var r=await fetch(API+'?'+qs.toString(),{headers:{Authorization:'Bearer '+t},cache:'no-store'});
  var d=await r.json().catch(function(){return{}});
  if(!r.ok||d.success!==true)throw new Error(d.message||'Finance API gagal');
  return d;
}
async function apiPost(mode,params){
  var t=await sessionToken();
  var body=Object.assign({mode:mode},params||{});
  var r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+t},body:JSON.stringify(body)});
  var d=await r.json().catch(function(){return{}});
  if(!r.ok||d.success!==true)throw new Error(d.message||'Finance API gagal');
  return d;
}

function dateKey(v){var s=String(v||'').trim(),m;if((m=s.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/)))return m[3]+'-'+m[2]+'-'+m[1];if((m=s.match(/^(\d{4})-(\d{2})-(\d{2})/)))return m[1]+'-'+m[2]+'-'+m[3];var d=new Date(s);return isNaN(d.getTime())?'':d.toISOString().slice(0,10)}
function filterLog(data,params){if(!data||!Array.isArray(data.rows))return data;var from=String(params.from||''),to=String(params.to||'');if(!from&&!to)return data;var copy=Object.assign({},data);copy.rows=data.rows.filter(function(r){var k=dateKey(r.tanggal||r.date||r.timestamp);if(!k)return true;if(from&&k<from)return false;if(to&&k>to)return false;return true});return copy}
async function legacyRead(action,params){
  params=Object.assign({},params||{});if(action==='finance_log_list'){if(!params.from)params.from=val('l-from');if(!params.to)params.to=val('l-to')}
  var cached=readCache(action,params);
  try{
    var fresh=await apiPost('finance_legacy_gas',Object.assign({gas_action:action},params));
    if(fresh&&fresh.success!==false){writeCache(action,params,fresh);return action==='finance_log_list'?filterLog(fresh,params):fresh}
    if(cached){var stale=Object.assign({},cached.payload);stale._stale=true;stale._stale_at=cached.at;stale.message='Menampilkan data terakhir karena GAS sedang tidak tersedia.';return action==='finance_log_list'?filterLog(stale,params):stale}
    return fresh;
  }
  catch(e){if(cached){var stale2=Object.assign({},cached.payload);stale2._stale=true;stale2._stale_at=cached.at;stale2.message='Menampilkan data terakhir karena GAS sedang tidak tersedia.';return action==='finance_log_list'?filterLog(stale2,params):stale2}throw e}
}

function invoiceNominal(rawValue){
  var raw=Number(rawValue)||0;
  var map={45000:50000,95000:100000,140000:150000,145000:150000,190000:200000,195000:200000};
  return map[raw]||raw;
}
async function saldoList(params){params=Object.assign({},params||{});if(['semua','all'].includes(String(params.status||'').toLowerCase()))delete params.status;var data=await apiGet('finance_saldo_list',params);var rows=Array.isArray(data.rows)?data.rows.slice():[];var branch=val('sr-branch'),search=val('sr-search').toLowerCase();if(branch)rows=rows.filter(function(r){return String(r.branch_id||'')===branch});if(search)rows=rows.filter(function(r){return [r.id,r.request_no,r.staff_name,r.staff_code,r.driver_name,r.driver_login_id,r.branch_name].join(' ').toLowerCase().indexOf(search)>=0});rows=rows.map(function(r){var raw=Number(r.nominal)||0,invoice=invoiceNominal(raw);return Object.assign({},r,{saldo_nominal:raw,invoice_nominal:invoice,nominal:invoice})});return Object.assign({},data,{rows:rows})}

function normalizeHeader(v){return String(v||'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim()}
function totalRowFromRekap(data){var headers=Array.isArray(data&&data.headers_row_1)?data.headers_row_1:[];var rows=Array.isArray(data&&data.rows_from_2)?data.rows_from_2:[];var total=rows.find(function(r){return Array.isArray(r)&&r.some(function(c){return /TOTAL\s+KESELURUHAN/i.test(String(c||''))})});if(!total)return null;var hi={};headers.forEach(function(h,i){hi[normalizeHeader(h)]=i});function at(names,fallback){for(var i=0;i<names.length;i++){var k=normalizeHeader(names[i]);if(hi[k]!=null)return Number(total[hi[k]])||0}return Number(total[fallback])||0}return {income:at(['TOTAL PEMASUKAN RP','TOTAL PEMASUKAN'],3),expense:at(['TOTAL PENGELUARAN RP','TOTAL PENGELUARAN'],4),net:at(['NET RP','NET'],5)}}
function applyLedgerSummary(s,stale){if(!s)return;setText('s-in',money(s.income));setText('s-out',money(s.expense));setText('s-net',money(s.net));setText('s-in-sub',stale?'data terakhir · Sheet':'Sheet TABEL BULANAN');setText('s-out-sub',stale?'data terakhir · Sheet':'Sheet TABEL BULANAN');setText('s-net-sub',stale?'data terakhir':'saldo bersih')}
function applyBillSummary(data){var rows=Array.isArray(data&&data.rows)?data.rows:[];var unpaid=rows.filter(function(r){var s=String(r.status||'').toLowerCase();return !['sudah_bayar','paid','lunas'].includes(s)});var total=unpaid.reduce(function(sum,r){return sum+(Number(r.jumlah)||0)},0);setText('s-bill',String(unpaid.length));setText('s-bill-sub',money(total)+(data&&data._stale?' · data terakhir':''))}
async function refreshDashboardSummary(force){if(summaryBusy)return;if(!force&&Date.now()-summaryAt<SUMMARY_TTL)return;summaryBusy=true;try{var results=await Promise.allSettled([legacyRead('finance_rekap_bulanan',{}),legacyRead('finance_tagihan_list',{status:'',bulan:'',search:''})]);if(results[0].status==='fulfilled'){var r=results[0].value;if(r&&r.success!==false)applyLedgerSummary(totalRowFromRekap(r),!!r._stale)}if(results[1].status==='fulfilled'){var b=results[1].value;if(b&&b.success!==false)applyBillSummary(b)}summaryAt=Date.now()}catch(_){}finally{summaryBusy=false}}

function bind(id,event,fn){var e=document.getElementById(id);if(!e||e.dataset.financeRouterBound==='1')return;e.dataset.financeRouterBound='1';e.addEventListener(event,fn)}
async function syncBranches(){try{var d=await apiGet('finance_branches',{}),rows=d.rows||[];var sr=document.getElementById('sr-branch');if(sr){var selected=sr.value;sr.innerHTML='<option value="">Semua Cabang</option>'+rows.map(function(b){return '<option value="'+String(b.id).replace(/"/g,'&quot;')+'">'+String(b.name||b.slug||b.code||'')+'</option>'}).join('');if(rows.some(function(b){return String(b.id)===selected}))sr.value=selected}}catch(e){console.warn('[Finance router] branch sync:',e.message||e)}}
function bindUi(){bind('sr-branch','change',function(){if(typeof global.loadSaldoRaos==='function')global.loadSaldoRaos()});bind('sr-search','input',function(){if(typeof global.loadSaldoRaos==='function')global.loadSaldoRaos()});bind('l-from','change',function(){if(typeof global.loadLog==='function')global.loadLog()});bind('l-to','change',function(){if(typeof global.loadLog==='function')global.loadLog()});var panel=document.querySelector('[data-panel="db-driver"]');if(panel){var desc=panel.querySelector('.desc');if(desc)desc.textContent='Daftar driver per cabang + assignment ke staff. Admin/Direksi dapat assign; Management read-only.';var a=document.getElementById('dd-assign');if(a)a.textContent='🎲 Random Assign (Admin/Direksi)'}document.querySelectorAll('.tab[data-tab="dashboard"]').forEach(function(t){if(t.dataset.financeSummaryBound!=='1'){t.dataset.financeSummaryBound='1';t.addEventListener('click',function(){refreshDashboardSummary(false)})}})}
function refreshActive(){var tab=document.querySelector('.tab.active'),name=tab&&tab.dataset&&tab.dataset.tab;var map={'saldo-raos':'loadSaldoRaos','target-cabang':'loadTargetCabang','target-staff':'loadTargetStaff','db-driver':'loadDBDriver'};var fn=map[name];if(fn&&typeof global[fn]==='function')setTimeout(function(){global[fn]()},0);if(name==='dashboard')setTimeout(function(){refreshDashboardSummary(false)},0)}

function interceptEarlyTab(event){if(ready||releasingTab)return;var btn=event.target&&event.target.closest?event.target.closest('.tab'):null;if(!btn)return;pendingTab=btn.dataset.tab||pendingTab;event.preventDefault();event.stopPropagation();event.stopImmediatePropagation()}
document.addEventListener('click',interceptEarlyTab,true);

async function releaseBoot(){try{await sessionToken()}catch(e){console.warn('[Finance router] session gate:',e.message||e);return}ready=true;document.removeEventListener('click',interceptEarlyTab,true);bindUi();await syncBranches();if(typeof global.populateBranchDropdowns==='function')await Promise.resolve(global.populateBranchDropdowns()).catch(function(){});releasingTab=true;var name=pendingTab||String(location.hash||'').replace('#','')||'dashboard';var btn=document.querySelector('.tab[data-tab="'+name.replace(/"/g,'')+'"]')||document.querySelector('.tab[data-tab="dashboard"]');if(btn)btn.click();else refreshActive();releasingTab=false}
function postInstall(){setTimeout(releaseBoot,0);setTimeout(function(){bindUi();syncBranches()},500)}
function install(){if(installed||typeof global._gasCall!=='function')return false;original=global._gasCall;global._gasCall=async function(action,params){params=params||{};if(action==='finance_saldo_raos_list')return saldoList(params);if(DIRECT_GET[action])return apiGet(DIRECT_GET[action],params);if(DIRECT_POST[action])return apiPost(DIRECT_POST[action],params);if(LEGACY_READ.has(action))return legacyRead(action,params);return original.apply(this,arguments)};global._gasCall.__financeCanonicalRouter=true;installed=true;postInstall();return true}
function start(){var tries=0,t=setInterval(function(){tries++;if(install()||tries>400)clearInterval(t)},25)}
start();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){install();bindUi()},{once:true});
global.FinanceDataRouter={install:install,version:'2.3.2-global-invoice-rounding',api:API,syncBranches:syncBranches,refreshSummary:refreshDashboardSummary,isReady:function(){return ready}};
})(window);
