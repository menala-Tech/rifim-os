(function(global){
'use strict';
var p=String(location.pathname||'');
function ensureTableHeaderCss(){
  var old=document.querySelector('link[data-rifim-table-freeze]');
  if(old&&String(old.href||'').indexOf('freeze-4')>=0)return;
  if(old)old.remove();
  var l=document.createElement('link');
  l.rel='stylesheet';
  l.href='/shared/table-header-freeze.css?v=20260818-freeze-4';
  l.dataset.rifimTableFreeze='1';
  document.head.appendChild(l);
}
function ensureTableFreezeSync(){
  // 2026-08-18 fix: table-header-freeze.css now reads its `top` offset from
  // --rifim-table-freeze-offset (falling back to the same hard-coded number
  // as before if this script hasn't measured yet). This script sets that
  // var to the ACTUAL rendered header/nav/tabs height per module, so the
  // sticky table header can't drift out of sync the way the old hard-coded
  // top:104px (etc.) did whenever a module's header height changed.
  if(document.querySelector('script[data-rifim-table-freeze-sync]'))return;
  var s=document.createElement('script');
  s.src='/shared/table-header-freeze-sync.js?v=20260818-sync-1';
  s.async=false;
  s.dataset.rifimTableFreezeSync='1';
  document.head.appendChild(s);
}
function ensureModuleRuntimeHotfix(){
  if(document.querySelector('script[data-rifim-module-runtime-hotfix]'))return;
  var s=document.createElement('script');
  s.src='/shared/module-runtime-hotfix.js?v=20260818-runtime-1';
  s.async=false;
  s.dataset.rifimModuleRuntimeHotfix='1';
  document.head.appendChild(s);
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
function install(){
  if(document.getElementById('rifim-fixed-module-shell')){
    ensureTableHeaderCss();ensureTableFreezeSync();ensureModuleRuntimeHotfix();ensureFinanceAutoRecompute();return;
  }
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
 #app>header{position:fixed!important;top:0!important;left:0!important;right:0!important;width:100%!important;z-index:9990!important;height:86px!important;min-height:86px!important;padding-top:4px!important;padding-bottom:4px!important}
 #app>main{padding-top:110px!important}
 `);
  ensureTableHeaderCss();
  ensureTableFreezeSync();
  ensureModuleRuntimeHotfix();
  ensureFinanceAutoRecompute();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
global.RifimFixedModuleShell={version:'1.4.0-table-freeze-sync',install:install};
})(window);
