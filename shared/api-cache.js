/** RIFIM OS shared bootstrap. Core preserved in api-cache-core.js. */
/* finance canonical runtime fix 2026-08-18 */
(function(){
  'use strict';
  function load(src){document.write('<script src="'+src+'"></'+'script>');}
  load('/shared/fixed-module-shell.js?v=20260818-fixed-1');
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
  if(/\/finance(?:\/|$)/.test(p)) {
    load('/shared/finance-data-router.js?v=20260818-session-gate-1');
    load('/shared/finance-target-mode-labels.js?v=20260819-mode-labels-1');
  }
})();

(function(global){
  'use strict';
  if(!/\/finance(?:\/|$)/.test(String(global.location&&global.location.pathname||''))) return;

  var GAS_HOST='script.google.com';
  var GAS_GAP_MS=1400;
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

  // P0.4 fix (2026-08-18): this IIFE used to wrap global._gasCall a SECOND
  // time (finance-data-router.js already installs the canonical wrapper —
  // marked __financeCanonicalRouter) with its own separate legacy-read cache
  // (rifim_finance_runtime_cache_v1, distinct from the router's
  // rifim_finance_legacy_cache_v2) AND its own markPaidAsCurrentUser() that
  // decoded the JWT client-side to derive the processor identity. Because
  // this double-wrap ran its finance_saldo_raos_mark_paid branch BEFORE
  // falling through to original(), markPaidAsCurrentUser was the one
  // actually executing in production -- not finance-data-router's
  // server-derived DIRECT_POST -> api/internal/hris-contracts.js markSaldo()
  // path, which is more secure (processor id comes from the authenticated
  // actor server-side, never from a client-decoded token). Per the "SATU
  // canonical Finance fetch layer" directive both the duplicate legacy-read
  // wrapping and the duplicate mark-paid path are removed: finance-data-
  // router.js's single wrapper (and its finance_legacy_gas server passthrough)
  // is now the only _gasCall wrapper installed. The GAS_GAP_MS fetch
  // rate-limiter above is left in place as a defensive no-op safety net for
  // any residual direct browser->GAS traffic, but legacy reads no longer hit
  // GAS from the browser at all -- they run server-side via
  // api/internal/hris-contracts.js?mode=finance_legacy_gas.
  function isRouterInstalled(){return typeof global._gasCall==='function'&&!!global._gasCall.__financeCanonicalRouter;}

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

  global.FinanceRuntimeFix={version:'2.0.0-single-transport-p0.4',getAgentState:getAgentState,isInstalled:isRouterInstalled};
})(window);
