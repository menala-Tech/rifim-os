(function(global){
'use strict';
if(!/\/finance(?:\/|$)/.test(String(location.pathname||'')))return;

var API='/api/internal/hris-contracts';
var PREFIX='rifim_finance_legacy_cache_v2:';
var MAX_STALE=24*60*60*1000;
var installed=false;
var original=null;

var DIRECT_GET={
  finance_kpi_target_branch_list:'finance_branch_targets',
  finance_kpi_target_staff_list:'finance_staff_targets',
  finance_drivers_list:'finance_drivers',
  finance_branches_list:'finance_branches'
};
var DIRECT_POST={
  finance_saldo_raos_mark_paid:'finance_saldo_mark_paid',
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
function token(){var a=auth();return String(a.access_token||a.accessToken||'')}
function scope(){var a=auth();return String(a.id||a.user_id||a.email||'anonymous').replace(/[^a-zA-Z0-9@._-]/g,'_')}
function cacheKey(action,params){return PREFIX+scope()+':'+action+':'+JSON.stringify(params||{})}
function readCache(action,params){try{var raw=localStorage.getItem(cacheKey(action,params));if(!raw)return null;var x=JSON.parse(raw);if(!x||!x.at||!x.payload)return null;if(Date.now()-x.at>MAX_STALE)return null;return x}catch(_){return null}}
function writeCache(action,params,payload){try{localStorage.setItem(cacheKey(action,params),JSON.stringify({at:Date.now(),payload:payload}))}catch(_){}}
function val(id){var e=document.getElementById(id);return e?String(e.value||'').trim():''}

async function apiGet(mode,params){
  var t=token();if(!t)throw new Error('Session token tidak ada. Login ulang melalui Portal.');
  var qs=new URLSearchParams({mode:mode});
  Object.keys(params||{}).forEach(function(k){var v=params[k];if(v!==''&&v!=null)qs.set(k,String(v))});
  var r=await fetch(API+'?'+qs.toString(),{headers:{Authorization:'Bearer '+t},cache:'no-store'});
  var d=await r.json().catch(function(){return{}});
  if(!r.ok||d.success!==true)throw new Error(d.message||'Finance API gagal');
  return d;
}
async function apiPost(mode,params){
  var t=token();if(!t)throw new Error('Session token tidak ada. Login ulang melalui Portal.');
  var body=Object.assign({mode:mode},params||{});
  var r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+t},body:JSON.stringify(body)});
  var d=await r.json().catch(function(){return{}});
  if(!r.ok||d.success!==true)throw new Error(d.message||'Finance API gagal');
  return d;
}

function dateKey(v){
  var s=String(v||'').trim(),m;
  if((m=s.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/)))return m[3]+'-'+m[2]+'-'+m[1];
  if((m=s.match(/^(\d{4})-(\d{2})-(\d{2})/)))return m[1]+'-'+m[2]+'-'+m[3];
  var d=new Date(s);return isNaN(d.getTime())?'':d.toISOString().slice(0,10);
}
function filterLog(data,params){
  if(!data||!Array.isArray(data.rows))return data;
  var from=String(params.from||''),to=String(params.to||'');if(!from&&!to)return data;
  var copy=Object.assign({},data);
  copy.rows=data.rows.filter(function(r){var k=dateKey(r.tanggal||r.date||r.timestamp);if(!k)return true;if(from&&k<from)return false;if(to&&k>to)return false;return true});
  return copy;
}
async function legacyRead(action,params){
  params=Object.assign({},params||{});
  if(action==='finance_log_list'){if(!params.from)params.from=val('l-from');if(!params.to)params.to=val('l-to')}
  var cached=readCache(action,params);
  try{
    var fresh=await original(action,params);
    if(fresh&&fresh.success!==false){writeCache(action,params,fresh);return action==='finance_log_list'?filterLog(fresh,params):fresh}
    if(cached){var stale=Object.assign({},cached.payload);stale._stale=true;stale._stale_at=cached.at;stale.message='Menampilkan data terakhir karena GAS sedang tidak tersedia.';return action==='finance_log_list'?filterLog(stale,params):stale}
    return fresh;
  }catch(e){
    if(cached){var stale2=Object.assign({},cached.payload);stale2._stale=true;stale2._stale_at=cached.at;stale2.message='Menampilkan data terakhir karena GAS sedang tidak tersedia.';return action==='finance_log_list'?filterLog(stale2,params):stale2}
    throw e;
  }
}

async function saldoList(params){
  params=Object.assign({},params||{});
  if(String(params.status||'').toLowerCase()==='semua')delete params.status;
  var data=await apiGet('finance_saldo_list',params);
  var rows=Array.isArray(data.rows)?data.rows.slice():[];
  var branch=val('sr-branch'),search=val('sr-search').toLowerCase();
  if(branch)rows=rows.filter(function(r){return String(r.branch_id||'')===branch});
  if(search)rows=rows.filter(function(r){return [r.id,r.request_no,r.staff_name,r.staff_code,r.driver_name,r.driver_login_id,r.branch_name].join(' ').toLowerCase().indexOf(search)>=0});
  return Object.assign({},data,{rows:rows});
}

function bind(id,event,fn){var e=document.getElementById(id);if(!e||e.dataset.financeRouterBound==='1')return;e.dataset.financeRouterBound='1';e.addEventListener(event,fn)}
async function syncBranches(){
  try{
    var d=await apiGet('finance_branches',{}),rows=d.rows||[];
    var sr=document.getElementById('sr-branch');
    if(sr){var selected=sr.value;sr.innerHTML='<option value="">Semua Cabang</option>'+rows.map(function(b){return '<option value="'+String(b.id).replace(/"/g,'&quot;')+'">'+String(b.name||b.slug||b.code||'')+'</option>'}).join('');if(rows.some(function(b){return String(b.id)===selected}))sr.value=selected}
  }catch(e){console.warn('[Finance router] branch sync:',e.message||e)}
}
function bindUi(){
  bind('sr-branch','change',function(){if(typeof global.loadSaldoRaos==='function')global.loadSaldoRaos()});
  bind('sr-search','input',function(){if(typeof global.loadSaldoRaos==='function')global.loadSaldoRaos()});
  bind('l-from','change',function(){if(typeof global.loadLog==='function')global.loadLog()});
  bind('l-to','change',function(){if(typeof global.loadLog==='function')global.loadLog()});
  var panel=document.querySelector('[data-panel="db-driver"]');
  if(panel){var desc=panel.querySelector('.desc');if(desc)desc.textContent='Daftar driver per cabang + assignment ke staff. Admin/Direksi dapat assign; Management read-only.';var a=document.getElementById('dd-assign');if(a)a.textContent='🎲 Random Assign (Admin/Direksi)'}
}
function refreshActive(){
  var tab=document.querySelector('.tab.active'),name=tab&&tab.dataset&&tab.dataset.tab;
  var map={'saldo-raos':'loadSaldoRaos','target-cabang':'loadTargetCabang','target-staff':'loadTargetStaff','db-driver':'loadDBDriver'};
  var fn=map[name];if(fn&&typeof global[fn]==='function')setTimeout(function(){global[fn]()},0);
}
function postInstall(){
  bindUi();syncBranches();
  if(typeof global.populateBranchDropdowns==='function')Promise.resolve(global.populateBranchDropdowns()).catch(function(){});
  refreshActive();
  setTimeout(function(){bindUi();syncBranches();if(typeof global.populateBranchDropdowns==='function')Promise.resolve(global.populateBranchDropdowns()).catch(function(){})},500);
}
function install(){
  if(installed||typeof global._gasCall!=='function')return false;
  original=global._gasCall;
  global._gasCall=async function(action,params){
    params=params||{};
    if(action==='finance_saldo_raos_list')return saldoList(params);
    if(DIRECT_GET[action])return apiGet(DIRECT_GET[action],params);
    if(DIRECT_POST[action])return apiPost(DIRECT_POST[action],params);
    if(LEGACY_READ.has(action))return legacyRead(action,params);
    return original.apply(this,arguments);
  };
  global._gasCall.__financeCanonicalRouter=true;
  installed=true;
  postInstall();
  return true;
}
function start(){var tries=0,t=setInterval(function(){tries++;if(install()||tries>240)clearInterval(t)},25)}
start();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){install();bindUi()},{once:true});
global.FinanceDataRouter={install:install,version:'2.1.0',api:API,syncBranches:syncBranches};
})(window);
