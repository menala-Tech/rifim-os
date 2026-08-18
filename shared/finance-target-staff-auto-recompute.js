(function(global){
'use strict';
if(!/^\/finance(?:\/|$)/.test(String(global.location&&global.location.pathname||'')))return;

var API='/api/internal/finance-payroll-staff';
var installed=false;

function rawAuth(){try{return JSON.parse(localStorage.getItem('rifim_auth')||'{}')||{}}catch(_){return{}}}
async function token(){
  if(global.RifimPortalSession&&typeof global.RifimPortalSession.validate==='function'){
    var s=await global.RifimPortalSession.validate();
    if(s&&s.access_token)return String(s.access_token);
  }
  var t=String(rawAuth().access_token||'');
  if(!t)throw new Error('Session Finance berakhir. Login ulang melalui Portal.');
  return t;
}
function clearTargetCache(){
  try{
    for(var i=localStorage.length-1;i>=0;i--){
      var k=localStorage.key(i)||'';
      if(k.indexOf('rifim_finance_target_cache_v1:')===0)localStorage.removeItem(k);
    }
  }catch(_){}
}
async function recomputeOne(staffId,month){
  var t=await token();
  var r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+t},body:JSON.stringify({staff_id:staffId,month:month}),cache:'no-store'});
  var d=await r.json().catch(function(){return{}});
  if(!r.ok||d.success!==true)throw new Error(d.message||'Auto-recompute payroll staff gagal');
  return d;
}
function installGasWrap(){
  if(installed)return true;
  if(typeof global._gasCall!=='function'||!global._gasCall.__financeCanonicalRouter)return false;
  var original=global._gasCall;
  if(original.__financeStaffAutoRecompute){installed=true;return true;}
  var wrapped=async function(action,params){
    params=params||{};
    if(action!=='finance_kpi_target_staff_upsert')return original.apply(this,arguments);
    var saved=await original.apply(this,arguments);
    if(!saved||saved.success===false)return saved;
    var staffId=String(params.staff_id||'').trim();
    var month=String(params.month||'').trim();
    if(staffId&&month){
      try{
        await recomputeOne(staffId,month);
        clearTargetCache();
      }catch(err){
        throw new Error('Target tersimpan, tetapi auto-recompute payroll staff gagal: '+(err&&err.message?err.message:String(err)));
      }
    }
    if(saved&&typeof saved==='object')saved.auto_recomputed=true;
    return saved;
  };
  Object.keys(original).forEach(function(k){try{wrapped[k]=original[k]}catch(_){}});
  wrapped.__financeCanonicalRouter=true;
  wrapped.__financeStaffAutoRecompute=true;
  global._gasCall=wrapped;
  installed=true;
  return true;
}
function installToastWrap(){
  if(typeof global.showToast!=='function'||global.showToast.__financeStaffAutoRecompute)return false;
  var original=global.showToast;
  var wrapped=function(msg,kind){
    var text=String(msg==null?'':msg);
    if(/Klik\s+Recompute\s+Payroll/i.test(text)){
      text=text.replace(/Klik\s+Recompute\s+Payroll[^.]*\.?/i,'Payroll staff sudah dihitung ulang otomatis.');
    }
    return original.call(this,text,kind);
  };
  wrapped.__financeStaffAutoRecompute=true;
  global.showToast=wrapped;
  return true;
}
var tries=0;
var timer=setInterval(function(){
  tries++;
  installGasWrap();
  installToastWrap();
  if((installed&&typeof global.showToast==='function')||tries>600)clearInterval(timer);
},25);

global.FinanceTargetStaffAutoRecompute={version:'1.0.0',install:installGasWrap,recomputeOne:recomputeOne,isInstalled:function(){return installed}};
})(window);
