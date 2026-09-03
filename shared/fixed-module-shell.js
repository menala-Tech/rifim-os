(function(global){
'use strict';
var p=String(location.pathname||'');
var host=String(location.hostname||'').toLowerCase();
var isPreview=host.endsWith('.vercel.app')&&host!=='rifim-os.vercel.app';
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
function ensureSessionFetch(){
  // 2026-09-03: auto-refresh + retry pada 401 dari Supabase + sticky banner
  // "Sesi berakhir". Depends on portal-session.js (dimuat lebih dulu).
  if(document.querySelector('script[data-rifim-session-fetch]'))return;
  var s=document.createElement('script');
  s.src='/shared/session-fetch.js?v=20260903-session-fetch-1';
  s.async=false;
  s.dataset.rifimSessionFetch='1';
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
function ensureHrisPreviewGuard(){
  if(!isPreview||!/^\/hris(?:\/|$)/.test(p))return;
  var attempts=0;
  var timer=global.setInterval(function(){
    attempts+=1;
    var target=document.querySelector('#tab-karyawan .card-body');
    if(!target){if(attempts>=100)global.clearInterval(timer);return;}
    if(!document.getElementById('hris-preview-guard')){
      var guard=document.createElement('div');
      guard.id='hris-preview-guard';
      guard.style.cssText='padding:11px 14px;margin-bottom:12px;background:#fff7ed;border-left:4px solid #ea580c;border-radius:6px;font-size:13px;color:#9a3412;font-weight:700';
      guard.textContent='PREVIEW QA — Supabase QA only. Sync SSOT/GAS production dinonaktifkan di halaman ini.';
      target.insertBefore(guard,target.firstChild);
    }
    var syncBtn=document.getElementById('btn-sync-ssot-now');
    if(syncBtn){
      syncBtn.disabled=true;
      syncBtn.onclick=function(){return false;};
      syncBtn.textContent='Sync dinonaktifkan di Preview';
      syncBtn.title='Preview QA tidak boleh menjalankan GAS/production sync';
      syncBtn.style.opacity='.55';
      syncBtn.style.cursor='not-allowed';
    }
    global.clearInterval(timer);
  },50);
}
function ensureHrisPreactivationEntry(){
  if(!/^\/hris(?:\/|$)/.test(p))return;
  if(document.getElementById('hris-preactivation-entry'))return;
  var attempts=0;
  var timer=global.setInterval(function(){
    attempts+=1;
    if(document.getElementById('hris-preactivation-entry')){global.clearInterval(timer);return;}
    var target=document.querySelector('#tab-karyawan .card-body');
    if(!target){if(attempts>=100)global.clearInterval(timer);return;}
    var box=document.createElement('div');
    box.id='hris-preactivation-entry';
    box.style.cssText='padding:12px 14px;margin-bottom:12px;background:#eef6ff;border-left:4px solid #2563eb;border-radius:6px;font-size:13px;color:#1e3a8a;display:flex;align-items:center;gap:12px;flex-wrap:wrap';
    var text=document.createElement('div');
    text.style.cssText='flex:1;min-width:260px;line-height:1.5';
    text.innerHTML='<strong>Incoming / Pre-Activation Workforce</strong><br><span style="color:#475569">Lihat staff SOETA dari RAOS Staff Master sebelum aktivasi. Read-only, belum masuk employees/payroll/attendance aktif.</span>';
    var btn=document.createElement('button');
    btn.type='button';
    btn.className='btn btn-secondary';
    btn.textContent='Buka Pre-Activation';
    btn.onclick=function(){global.location.href='/modules/hris/preactivation.html';};
    box.appendChild(text);box.appendChild(btn);
    target.insertBefore(box,target.firstChild);
    global.clearInterval(timer);
  },50);
}
function css(t){var s=document.createElement('style');s.id='rifim-fixed-module-shell';s.textContent=t;document.head.appendChild(s)}
function install(){
  if(document.getElementById('rifim-fixed-module-shell')){
    ensureTableHeaderCss();ensureTableFreezeSync();ensureModuleRuntimeHotfix();ensureSessionFetch();ensureFinanceAutoRecompute();ensureHrisPreactivationEntry();ensureHrisPreviewGuard();return;
  }
  // 2026-09-03: compact header + tabs across modules supaya lebih banyak
  // table row terlihat di viewport pertama. Penurunan tinggi berkisar 18-40px
  // per modul. Font-size header shell dikecilkan lewat targeted selectors,
  // KPI card padding juga dipangkas.
  if(/^\/finance(?:\/|$)/.test(p))css(`
 :root{--rifim-head:46px;--rifim-tabs:36px}
 #app>header{position:fixed!important;top:0!important;left:0!important;right:0!important;width:100%!important;z-index:9990!important;height:var(--rifim-head)!important;min-height:var(--rifim-head)!important;padding-top:4px!important;padding-bottom:4px!important}
 #app>header,#app>header *{font-size:13px!important}
 #app>header h1,#app>header .brand,#app>header [class*=title]{font-size:15px!important}
 main{padding-top:calc(var(--rifim-head) + var(--rifim-tabs) + 8px)!important}
 main>.tabs,.tabs{position:fixed!important;top:var(--rifim-head)!important;left:0!important;right:0!important;width:100%!important;margin:0!important;z-index:9980!important;height:var(--rifim-tabs)!important;min-height:var(--rifim-tabs)!important;font-size:13px!important}
 main .stat,main .kpi,main [class*=card]{padding:8px 12px!important}
 main .stat h3,main .kpi h3,main [class*=card] h3{font-size:11px!important;margin:0 0 2px!important}
 main .stat .val,main .kpi .val{font-size:18px!important;line-height:1.1!important}
 @media(max-width:900px){:root{--rifim-head:42px;--rifim-tabs:34px}}
 `);
  else if(/^\/hris(?:\/|$)/.test(p))css(`
 #app>header{position:fixed!important;top:0!important;left:0!important;right:0!important;width:100%!important;z-index:9990!important;height:44px!important;min-height:44px!important;padding-top:4px!important;padding-bottom:4px!important}
 #app>header,#app>header *{font-size:13px!important}
 #app>header h1,#app>header .brand{font-size:15px!important}
 #app>nav{position:fixed!important;top:44px!important;left:0!important;right:0!important;width:100%!important;z-index:9980!important;height:38px!important;min-height:38px!important;font-size:13px!important}
 #app>main,main{padding-top:90px!important}
 main .stat,main .kpi,main .card{padding:8px 12px!important}
 main .stat h3,main .kpi h3,main .card h3{font-size:11px!important;margin:0 0 2px!important}
 main .stat .val,main .kpi .val,main .card .val{font-size:18px!important;line-height:1.1!important}
 `);
  else if(/^\/smart-office(?:\/|$)/.test(p))css(`
 :root{--topnav-h:44px!important}
 .topnav{position:fixed!important;top:0!important;left:0!important;right:0!important;width:100%!important;z-index:9990!important;height:44px!important;min-height:44px!important;padding-top:4px!important;padding-bottom:4px!important;font-size:13px!important}
 .layout{padding-top:44px!important}
 .main .tabs{position:sticky!important;top:0!important;z-index:9980!important;font-size:13px!important;height:36px!important;min-height:36px!important}
 `);
  else if(/^\/sistem(?:\/|$)/.test(p))css(`
 #app>header{position:fixed!important;top:0!important;left:0!important;right:0!important;width:100%!important;z-index:9990!important;height:64px!important;min-height:64px!important;padding-top:4px!important;padding-bottom:4px!important}
 #app>header,#app>header *{font-size:13px!important}
 #app>header h1{font-size:15px!important}
 #app>main{padding-top:78px!important}
 `);
  ensureTableHeaderCss();
  ensureTableFreezeSync();
  ensureModuleRuntimeHotfix();
  ensureSessionFetch();
  ensureFinanceAutoRecompute();
  ensureHrisPreactivationEntry();
  ensureHrisPreviewGuard();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
global.RifimFixedModuleShell={version:'1.8.0-compact-header',install:install};
})(window);
