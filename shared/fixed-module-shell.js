(function(global){
'use strict';
var p=String(location.pathname||'');
function ensureTableHeaderCss(){
  if(document.querySelector('link[data-rifim-table-freeze]'))return;
  var l=document.createElement('link');
  l.rel='stylesheet';
  l.href='/shared/table-header-freeze.css?v=20260818-freeze-2';
  l.dataset.rifimTableFreeze='1';
  document.head.appendChild(l);
}
function ensureFinanceAutoRecompute(){
  if(!/^\/finance(?:\/|$)/.test(p))return;
  if(document.querySelector('script[data-finance-staff-auto-recompute]'))return;
  var s=document.createElement('script');
  s.src='/shared/finance-target-staff-auto-recompute.js?v=20260818-auto-1';
  s.async=false;
  s.dataset.financeStaffAutoRecompute='1';
  document.head.appendChild(s);
}
function css(t){var s=document.createElement('style');s.id='rifim-fixed-module-shell';s.textContent=t;document.head.appendChild(s)}
function install(){if(document.getElementById('rifim-fixed-module-shell')){ensureTableHeaderCss();ensureFinanceAutoRecompute();return;}
 if(/^\/finance(?:\/|$)/.test(p))css(`
 :root{--rifim-head:58px;--rifim-tabs:46px}
 #app>header{position:fixed!important;top:0!important;left:0!important;right:0!important;width:100%!important;z-index:9990!important;height:var(--rifim-head)!important;min-height:var(--rifim-head)!important}
 main{padding-top:calc(var(--rifim-head) + var(--rifim-tabs) + 14px)!important}
 main>.tabs,.tabs{position:fixed!important;top:var(--rifim-head)!important;left:0!important;right:0!important;width:100%!important;margin:0!important;z-index:9980!important;height:var(--rifim-tabs)!important;min-height:var(--rifim-tabs)!important}
 @media(max-width:900px){:root{--rifim-head:54px;--rifim-tabs:44px}}
 `);
 else if(/^\/hris(?:\/|$)/.test(p))css(`
 #app>header{position:fixed!important;top:0!important;left:0!important;right:0!important;width:100%!important;z-index:9990!important}
 #app>nav{position:fixed!important;top:56px!important;left:0!important;right:0!important;width:100%!important;z-index:9980!important}
 #app>main,main{padding-top:132px!important}
 `);
 else if(/^\/smart-office(?:\/|$)/.test(p))css(`
 .topnav{position:fixed!important;top:0!important;left:0!important;right:0!important;width:100%!important;z-index:9990!important}
 .layout{padding-top:var(--topnav-h)!important}
 .main .tabs{position:sticky!important;top:0!important;z-index:9980!important}
 `);
 else if(/^\/sistem(?:\/|$)/.test(p))css(`
 body>header,header{position:fixed!important;top:0!important;left:0!important;right:0!important;width:100%!important;z-index:9990!important;height:86px!important;min-height:86px!important;padding-top:4px!important;padding-bottom:4px!important}
 body>main,main{padding-top:110px!important}
 `);
 ensureTableHeaderCss();
 ensureFinanceAutoRecompute();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
global.RifimFixedModuleShell={version:'1.2.0-table-freeze-auto-payroll',install:install};
})(window);
