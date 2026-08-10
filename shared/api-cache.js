/** RIFIM OS shared bootstrap. Core preserved in api-cache-core.js. */
(function(){
  'use strict';
  function load(src){document.write('<script src="'+src+'"><\\/script>');}
  load('/shared/api-cache-core.js');
  var p=String(location.pathname||'');
  if(/\/hris(?:\/|$)/.test(p)) {
    load('/shared/hris-contract-activation-sync.js');
    load('/shared/hris-attendance-payroll-v2.js');
  }
  if(/\/smart-office(?:\/|$)/.test(p)) load('/shared/smart-office-hris-sync.js');
})();
