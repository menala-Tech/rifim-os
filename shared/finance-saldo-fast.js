(function(global){
'use strict';
if(!/\/finance(?:\/|$)/.test(location.pathname))return;
function readAuth(){try{return JSON.parse(localStorage.getItem('rifim_auth')||'{}')||{}}catch(_){return{}}}
function token(){var a=readAuth();return String(a.access_token||a.accessToken||'')}
async function callFast(action,extra){var t=token();if(!t)throw new Error('Session token tidak ada. Login ulang melalui Portal.');if(action==='finance_saldo_raos_list'){var qs=new URLSearchParams();var st=String((extra&&extra.status)||'').trim();if(st)qs.set('status',st);var r=await fetch('/api/internal/finance-saldo-raos'+(qs.toString()?'?'+qs.toString():''),{headers:{Authorization:'Bearer '+t},cache:'no-store'});var d=await r.json().catch(function(){return{}});if(!r.ok||d.success!==true)throw new Error(d.message||'Gagal load Isi Saldo');return d}if(action==='finance_saldo_raos_mark_paid'){var r2=await fetch('/api/internal/finance-saldo-raos',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+t},body:JSON.stringify({id:extra&&extra.id})});var d2=await r2.json().catch(function(){return{}});if(!r2.ok||d2.success!==true)throw new Error(d2.message||'Gagal tandai Lunas');return d2}return null}
function install(){if(typeof global._gasCall!=='function')return false;if(global._finSaldoFastInstalled)return true;var original=global._gasCall;global._gasCall=async function(action,extra){if(action==='finance_saldo_raos_list'||action==='finance_saldo_raos_mark_paid'){try{return await callFast(action,extra||{})}catch(e){console.warn('[Finance Saldo fast API]',e.message||e);throw e}}return original.apply(this,arguments)};global._finSaldoFastInstalled=true;return true}
function start(){var tries=0,t=setInterval(function(){tries++;if(install()||tries>80)clearInterval(t)},50)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})(window);
