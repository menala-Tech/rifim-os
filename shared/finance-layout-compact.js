(function(global){
  'use strict';
  if(!/\/finance(?:\/|$)/.test(String(global.location&&global.location.pathname||''))) return;

  function install(){
    if(document.getElementById('finance-layout-compact-v1')) return;
    var style=document.createElement('style');
    style.id='finance-layout-compact-v1';
    style.textContent=`
      :root{--finance-header-h:58px;--finance-tabs-h:46px}
      #app>header{
        position:sticky!important;top:0!important;z-index:120!important;
        min-height:var(--finance-header-h)!important;height:var(--finance-header-h)!important;
        padding:5px 16px!important;background:rgba(255,255,255,.98)!important;
        box-shadow:0 4px 16px rgba(15,23,42,.08)!important
      }
      #app>header .brand{gap:8px!important}
      #app>header .brand-logo{height:42px!important;max-height:42px!important;width:auto!important}
      #app>header .module-badge{font-size:11px!important;padding:7px 12px!important;letter-spacing:.09em!important}
      #app>header .header-right{gap:8px!important}
      #app>header .user-name{font-size:11px!important}
      #app>header .user-role{font-size:9px!important;padding:2px 7px!important;margin-top:1px!important}
      #app>header .btn-back{font-size:11px!important;padding:7px 11px!important}

      main{max-width:none!important;padding:8px 12px 16px!important}
      .page-title{display:none!important}
      .page-sub{display:none!important}

      .tabs{
        position:sticky!important;top:var(--finance-header-h)!important;z-index:110!important;
        margin:0 -12px 8px!important;padding:5px 12px 6px!important;gap:6px!important;
        min-height:var(--finance-tabs-h)!important;background:rgba(255,255,255,.98)!important;
        border-top:0!important;box-shadow:0 4px 12px rgba(15,23,42,.07)!important
      }
      .tab{font-size:11px!important;padding:8px 12px!important;border-radius:12px!important;box-shadow:none!important}

      .stats{grid-template-columns:repeat(4,minmax(150px,1fr))!important;gap:8px!important;margin-bottom:8px!important}
      .stat{padding:9px 12px!important;border-radius:14px!important;min-height:74px!important;box-shadow:0 6px 16px rgba(15,23,42,.05)!important}
      .stat .lbl{font-size:9px!important;margin-bottom:3px!important;color:#111827!important}
      .stat .val{font-size:16px!important;color:#111827!important}
      .stat .sub{font-size:9px!important;margin-top:2px!important;color:#111827!important}

      .panel{padding:12px!important;border-radius:16px!important;box-shadow:0 7px 20px rgba(15,23,42,.06)!important}
      .panel h2,.panel h3,.panel .desc,.roadmap,.sinks,.cab-card,.empty{color:#111827!important}
      .toolbar{gap:6px!important;margin-bottom:8px!important}
      .toolbar input,.toolbar select{padding:8px 10px!important;border-radius:10px!important;font-size:11px!important;color:#111827!important}
      .btn{font-size:11px!important;padding:7px 11px!important}

      .tbl{font-size:11px!important;color:#111827!important}
      .tbl th,.tbl td{padding:7px 8px!important}
      .tbl thead th{position:sticky!important;top:0!important;z-index:8!important;background:#f8fafc!important;color:#111827!important;font-size:10px!important}
      .tbl tbody td,.tbl tbody td *{color:#111827!important}
      .tbl tbody td .btn,.tbl tbody td .btn *{color:#fff!important}
      .tbl tbody td .btn.ghost,.tbl tbody td .btn.ghost *{color:#111827!important}
      .tbl tbody td input,.tbl tbody td select{color:#111827!important}
      .tbl .num,.tbl .num.in,.tbl .num.out{color:#111827!important}
      .tbl tr:hover td{background:#f8fafc!important}

      .cab-card{padding:9px 11px!important;border-radius:12px!important}
      .cab-card .cab-name,.cab-card .cab-total{color:#111827!important}

      [data-panel="target-staff"] .tbl,[data-panel="target-cabang"] .tbl,[data-panel="db-driver"] .tbl{
        min-width:1100px!important
      }
      [data-panel] > div[style*="overflow-x:auto"],.panel>div[style*="overflow-x:auto"]{
        scrollbar-gutter:stable
      }

      @media(max-width:900px){
        :root{--finance-header-h:54px}
        #app>header{height:54px!important;min-height:54px!important;padding:4px 8px!important}
        #app>header .brand-logo{height:36px!important;max-height:36px!important}
        #app>header .module-badge{font-size:10px!important;padding:6px 9px!important}
        #app>header .user-name{max-width:120px!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
        main{padding:6px 8px 12px!important}
        .tabs{margin:0 -8px 6px!important;padding-left:8px!important;padding-right:8px!important}
        .stats{grid-template-columns:repeat(2,minmax(130px,1fr))!important}
        .stat{min-height:66px!important}
      }
    `;
    document.head.appendChild(style);
    document.documentElement.dataset.financeCompactUi='1';
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
  global.FinanceCompactLayout={version:'1.0.0',install:install};
})(window);
