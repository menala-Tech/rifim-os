/** RIFIM OS shared bootstrap. Core preserved in api-cache-core.js. */
/* finance canonical runtime fix 2026-08-18 */
(function(){
  'use strict';
  function load(src){document.write('<script src="'+src+'"></'+'script>');}
  load('/shared/gas-fetch-proxy.js');
  load('/shared/api-cache-core.js');
  var p=String(location.pathname||'');
  if(/\/hris(?:\/|$)/.test(p)) {
    load('/shared/hris-contract-activation-sync.js');
    load('/shared/hris-attendance-payroll-v2.js');
    load('/shared/hris-payroll-income-branch-fix.js');
    load('/shared/hris-hotfix.js');
  }
  if(/\/smart-office(?:\/|$)/.test(p)) load('/shared/smart-office-hris-sync.js');
  if(/\/finance(?:\/|$)/.test(p)) load('/shared/finance-data-router.js?v=20260818-session-gate-1');
})();

(function(global){
  'use strict';
  if(!/\/finance(?:\/|$)/.test(String(global.location&&global.location.pathname||''))) return;

  var SUPABASE_URL='https://vlievtojpmrbsmzlqswl.supabase.co';
  var SUPABASE_PUBLISHABLE_KEY='sb_publishable_8KpL6zmpt_O_x21v4Jn3Tw_J_I3y-r1';
  var GAS_HOST='script.google.com';
  var GAS_GAP_MS=1400;
  var CACHE_FRESH_MS=5*60*1000;
  var CACHE_STALE_MS=24*60*60*1000;
  var CACHE_PREFIX='rifim_finance_runtime_cache_v1:';
  var legacyActions=new Set([
    'finance_list','finance_cabang_list','finance_tagihan_list',
    'finance_rekap_harian','finance_rekap_bulanan','finance_log_list'
  ]);

  var nativeFetch=global.fetch.bind(global);
  var gasTail=Promise.resolve();
  var gasNextAt=0;
  function isGasRequest(input){
    try{
      var u=typeof input==='string'?input:(input&&input.url)||'';
      return new URL(u,global.location.href).hostname===GAS_HOST;
    }catch(_){return false;}
  }
  function sleep(ms){return new Promise(function(resolve){setTimeout(resolve,ms);});}
  global.fetch=function(input,init){
    if(!isGasRequest(input)) return nativeFetch(input,init);
    var task=gasTail.then(async function(){
      var wait=Math.max(0,gasNextAt-Date.now());
      if(wait) await sleep(wait);
      try{return await nativeFetch(input,init);}
      finally{gasNextAt=Date.now()+GAS_GAP_MS;}
    },async function(){
      var wait=Math.max(0,gasNextAt-Date.now());
      if(wait) await sleep(wait);
      try{return await nativeFetch(input,init);}
      finally{gasNextAt=Date.now()+GAS_GAP_MS;}
    });
    gasTail=task.then(function(){},function(){});
    return task;
  };

  function sessionScope(){
    try{
      var s=JSON.parse(global.localStorage.getItem('rifim_auth')||'{}')||{};
      return String(s.id||s.user_id||s.email||'anonymous').replace(/[^a-zA-Z0-9@._-]/g,'_');
    }catch(_){return'anonymous';}
  }
  function cacheKey(action,params){return CACHE_PREFIX+sessionScope()+':'+action+':'+JSON.stringify(params||{});}
  function readCache(action,params){
    try{
      var raw=global.localStorage.getItem(cacheKey(action,params));
      if(!raw)return null;
      var x=JSON.parse(raw);
      if(!x||!x.at||!x.payload)return null;
      var age=Date.now()-x.at;
      if(age>CACHE_STALE_MS)return null;
      return {age:age,at:x.at,payload:x.payload};
    }catch(_){return null;}
  }
  function writeCache(action,params,payload){
    try{global.localStorage.setItem(cacheKey(action,params),JSON.stringify({at:Date.now(),payload:payload}));}catch(_){}
  }

  async function validatedToken(){
    if(global.RifimPortalSession&&typeof global.RifimPortalSession.validate==='function'){
      var s=await global.RifimPortalSession.validate();
      if(s&&s.access_token)return String(s.access_token);
    }
    try{
      var raw=JSON.parse(global.localStorage.getItem('rifim_auth')||'{}')||{};
      if(raw.access_token)return String(raw.access_token);
    }catch(_){}
    throw new Error('Session Finance berakhir. Login ulang melalui Portal.');
  }

  async function markPaidAsCurrentUser(params){
    var requestId=String(params&&(params.id||params.request_id)||'').trim();
    if(!requestId)throw new Error('id request wajib');
    var token=await validatedToken();
    var payload=null;
    try{
      var part=token.split('.')[1]||'';
      part=part.replace(/-/g,'+').replace(/_/g,'/');
      while(part.length%4)part+='=';
      payload=JSON.parse(decodeURIComponent(Array.from(atob(part)).map(function(c){return '%'+c.charCodeAt(0).toString(16).padStart(2,'0');}).join('')));
    }catch(_){}
    var processorId=payload&&payload.sub;
    if(!processorId)throw new Error('Identity Admin tidak valid');
    var res=await nativeFetch(SUPABASE_URL+'/rest/v1/rpc/raos_saldo_mark_paid',{
      method:'POST',
      headers:{apikey:SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+token,'Content-Type':'application/json'},
      body:JSON.stringify({p_request_id:requestId,p_processor_id:processorId})
    });
    var data=await res.json().catch(function(){return{};});
    if(!res.ok)throw new Error(data.message||data.error||('Supabase HTTP '+res.status));
    var row=Array.isArray(data)?(data[0]||{}):data;
    return Object.assign({success:true},row||{});
  }

  var runtimeInstalled=false;
  function installGasCallFix(){
    if(runtimeInstalled)return true;
    if(typeof global._gasCall!=='function'||!global._gasCall.__financeCanonicalRouter)return false;
    var original=global._gasCall;
    var wrapped=async function(action,params){
      params=params||{};
      if(action==='finance_saldo_raos_mark_paid')return markPaidAsCurrentUser(params);
      if(legacyActions.has(action)){
        var cached=readCache(action,params);
        if(cached&&cached.age<=CACHE_FRESH_MS)return cached.payload;
        try{
          var fresh=await original.apply(this,arguments);
          if(fresh&&fresh.success!==false){writeCache(action,params,fresh);return fresh;}
          if(cached)return Object.assign({},cached.payload,{_stale:true,_stale_at:cached.at,message:'Menampilkan data terakhir dari workbook karena transport Google sedang sibuk.'});
          return fresh;
        }catch(err){
          if(cached)return Object.assign({},cached.payload,{_stale:true,_stale_at:cached.at,message:'Menampilkan data terakhir dari workbook karena transport Google sedang sibuk.'});
          throw err;
        }
      }
      return original.apply(this,arguments);
    };
    wrapped.__financeCanonicalRouter=true;
    wrapped.__financeRuntimeFix=true;
    global._gasCall=wrapped;
    runtimeInstalled=true;
    return true;
  }
  var installTry=0;
  var installTimer=setInterval(function(){installTry++;if(installGasCallFix()||installTry>400)clearInterval(installTimer);},25);

  var agentState={at:0,online:false,ready:false,detail:''};
  async function getAgentState(force){
    if(!force&&Date.now()-agentState.at<8000)return agentState;
    try{
      var token=await validatedToken();
      var res=await nativeFetch('/api/internal/aist-agent/status',{headers:{Authorization:'Bearer '+token},cache:'no-store'});
      var data=await res.json().catch(function(){return{};});
      var a=data&&data.agent;
      agentState={at:Date.now(),online:!!a,ready:!!(a&&a.aist_ready&&a.finance_ready&&a.status!=='error'),detail:a?(String(a.machine_name||a.device_id||'Agent')+(a.last_error?' · '+a.last_error:'')):'Tidak ada MENALA AIST Agent yang heartbeat'};
    }catch(err){agentState={at:Date.now(),online:false,ready:false,detail:err&&err.message?err.message:'Agent tidak tersedia'};}
    return agentState;
  }
  function applyAistState(state){
    document.querySelectorAll('button[data-aist-saldo]').forEach(function(btn){
      if(!btn.dataset.runtimeOriginalText)btn.dataset.runtimeOriginalText=btn.textContent||'▶ Auto-Fill AIST';
      if(!btn.dataset.runtimeDriverState)btn.dataset.runtimeDriverState=btn.disabled?'disabled':'enabled';
      if(/queued|processing/i.test(String(btn.textContent||'')))return;
      var nextText,nextTitle,nextDisabled;
      if(!state.ready){
        nextDisabled=true;
        nextText=state.online?'🟠 AIST Belum Ready':'🔴 AIST Offline';
        nextTitle=state.detail+' — jalankan MENALA AIST Agent di laptop admin.';
      }else{
        nextDisabled=btn.dataset.runtimeDriverState==='disabled';
        nextText=btn.dataset.runtimeOriginalText;
        nextTitle=nextDisabled?'ID Driver belum tersedia':'Kirim ke MENALA AIST Agent ('+state.detail+')';
      }
      if(btn.disabled!==nextDisabled)btn.disabled=nextDisabled;
      if(btn.textContent!==nextText)btn.textContent=nextText;
      if(btn.title!==nextTitle)btn.title=nextTitle;
    });
  }
  function updateAistButtons(force){getAgentState(!!force).then(applyAistState);}
  function startAgentGuard(){
    updateAistButtons(true);
    setInterval(function(){updateAistButtons(false);},2000);
    setInterval(function(){updateAistButtons(true);},10000);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startAgentGuard,{once:true});
  else startAgentGuard();

  global.FinanceRuntimeFix={version:'1.0.1-workbook-aist',getAgentState:getAgentState,isInstalled:function(){return runtimeInstalled;}};
})(window);
