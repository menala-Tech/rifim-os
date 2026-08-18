/** RIFIM OS shared bootstrap. Core preserved in api-cache-core.js. */
/* finance session-gate cache bust 2026-08-18 */
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
