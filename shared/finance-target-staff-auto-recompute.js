(function(global){
'use strict';
if(!/^\/finance(?:\/|$)/.test(String(global.location&&global.location.pathname||'')))return;

// Hotfix 2026-08-29 followup: pull URL/anon from RifimPortalSession so this
// script targets QA on Preview instead of always PROD.
var SB_URL=(global.RifimPortalSession&&global.RifimPortalSession.config&&global.RifimPortalSession.config.supabaseUrl)||'https://vlievtojpmrbsmzlqswl.supabase.co';
var SB_KEY=(global.RifimPortalSession&&global.RifimPortalSession.config&&global.RifimPortalSession.config.supabaseAnonKey)||'sb_publishable_8KpL6zmpt_O_x21v4Jn3Tw_J_I3y-r1';
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
function monthDate(v){
  var s=String(v||'').trim();
  if(/^\d{4}-\d{2}$/.test(s))return s+'-01';
  if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s.slice(0,7)+'-01';
  var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-01';
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
  var r=await fetch(SB_URL+'/rest/v1/rpc/raos_compute_payroll_staff',{
    method:'POST',
    headers:{apikey:SB_KEY,Authorization:'Bearer '+t,'Content-Type':'application/json'},
    body:JSON.stringify({p_month:monthDate(month),p_staff_id:staffId}),
    cache:'no-store'
  });
  var raw=await r.text();
  var d;try{d=raw?JSON.parse(raw):0}catch(_){d=raw}
  if(!r.ok)throw new Error((d&&d.message)||String(d||('Supabase HTTP '+r.status)));
  return {success:true,processed:Number(d)||0,staff_id:staffId,month:monthDate(month)};
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
    if(/Klik\s+Recompute\s+Payroll/i.test(text))text=text.replace(/Klik\s+Recompute\s+Payroll[^.]*\.?/i,'Payroll staff sudah dihitung ulang otomatis.');
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

global.FinanceTargetStaffAutoRecompute={version:'1.1.0-direct-rpc',install:installGasWrap,recomputeOne:recomputeOne,isInstalled:function(){return installed}};
})(window);
