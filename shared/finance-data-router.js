(function(global){
'use strict';
if(!/\/finance(?:\/|$)/.test(String(location.pathname||'')))return;

var API='/api/internal/hris-contracts';
var PREFIX='rifim_finance_legacy_cache_v2:';
var MAX_STALE=24*60*60*1000;
var installed=false;
var original=null;

var DIRECT_GET={
  finance_saldo_raos_list:'finance_saldo_list',
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

async function legacyRead(action,params){
  var cached=readCache(action,params);
  try{
    var fresh=await original(action,params||{});
    if(fresh&&fresh.success!==false){writeCache(action,params,fresh);return fresh}
    if(cached){var stale=Object.assign({},cached.payload);stale._stale=true;stale._stale_at=cached.at;stale.message='Menampilkan data terakhir karena GAS sedang tidak tersedia.';return stale}
    return fresh;
  }catch(e){
    if(cached){var stale2=Object.assign({},cached.payload);stale2._stale=true;stale2._stale_at=cached.at;stale2.message='Menampilkan data terakhir karena GAS sedang tidak tersedia.';return stale2}
    throw e;
  }
}

function install(){
  if(installed||typeof global._gasCall!=='function')return false;
  original=global._gasCall;
  global._gasCall=async function(action,params){
    params=params||{};
    if(DIRECT_GET[action])return apiGet(DIRECT_GET[action],params);
    if(DIRECT_POST[action])return apiPost(DIRECT_POST[action],params);
    if(LEGACY_READ.has(action))return legacyRead(action,params);
    return original.apply(this,arguments);
  };
  global._gasCall.__financeCanonicalRouter=true;
  installed=true;
  return true;
}
function start(){var tries=0,t=setInterval(function(){tries++;if(install()||tries>200)clearInterval(t)},25)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
global.FinanceDataRouter={install:install,version:'2.0.0',api:API};
})(window);
