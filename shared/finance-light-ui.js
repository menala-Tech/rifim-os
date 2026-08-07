// RIFIM OS Finance — light Maxim theme + sticky navigation + compact notes
// UI-only enhancer. Loaded conditionally by shared/api-cache.js on /finance.
(function () {
  'use strict';

  const STYLE_ID = 'rifim-finance-light-ui';

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      :root{
        --finance-header-h:94px;
        --finance-surface:rgba(255,255,255,.90);
        --finance-surface-strong:rgba(255,255,255,.96);
        --finance-border:rgba(15,23,42,.12);
        --finance-text:#172033;
        --finance-muted:#64748b;
        --finance-shadow:0 10px 30px rgba(15,23,42,.10);
      }

      html,body{background:#eef3f8;color:var(--finance-text)}
      body{
        min-height:100dvh;
        background:
          linear-gradient(rgba(255,255,255,.78),rgba(255,255,255,.88)),
          url('/branding/backgrounds/bagroun-maxim.png') center/cover fixed no-repeat;
      }

      #gate{
        color:var(--finance-text);
        background:
          linear-gradient(rgba(255,255,255,.76),rgba(255,255,255,.88)),
          url('/branding/backgrounds/bagroun-maxim.png') center/cover fixed no-repeat;
      }
      .gate-card{box-shadow:var(--finance-shadow);border:1px solid var(--finance-border)}

      #app{
        color:var(--finance-text);
        background:
          linear-gradient(rgba(255,255,255,.76),rgba(255,255,255,.88)),
          url('/branding/backgrounds/bagroun-maxim.png') center/cover fixed no-repeat;
      }

      header{
        min-height:var(--finance-header-h);
        padding:10px 28px;
        color:var(--finance-text);
        background:rgba(255,255,255,.92);
        border-bottom:1px solid var(--finance-border);
        box-shadow:0 4px 18px rgba(15,23,42,.08);
        -webkit-backdrop-filter:blur(16px);
        backdrop-filter:blur(16px);
      }
      .brand-logo{height:78px!important;width:auto!important;max-width:min(280px,42vw);object-fit:contain}
      .module-badge{color:#7f1d1d;background:#fff1f2;border-color:#fecdd3}
      .user-name{color:var(--finance-text)}
      .user-role{color:#991b1b;background:#fee2e2;border-color:#fecaca}
      .btn-back{color:#334155;border-color:#cbd5e1;background:rgba(255,255,255,.72)}
      .btn-back:hover{background:#fff;border-color:#94a3b8}

      main{padding-top:18px}
      .page-title{color:var(--finance-text)}
      .page-sub{color:var(--finance-muted);opacity:1}

      .tabs{
        position:sticky;
        top:var(--finance-header-h);
        z-index:46;
        width:100%;
        margin:0;
        padding:8px max(18px,calc((100vw - 1400px)/2 + 24px));
        gap:5px;
        border:0;
        border-bottom:1px solid var(--finance-border);
        background:rgba(255,255,255,.94);
        box-shadow:0 6px 18px rgba(15,23,42,.08);
        -webkit-backdrop-filter:blur(16px);
        backdrop-filter:blur(16px);
        scrollbar-width:thin;
      }
      .tab{color:#64748b;border-radius:9px;border-bottom:0;padding:10px 13px}
      .tab:hover{color:#991b1b;background:#fff1f2}
      .tab.active{color:#fff;background:var(--red);box-shadow:0 4px 12px rgba(196,0,0,.18);border-bottom:0}

      .stats{margin-top:4px}
      .stat,.panel,.cab-card,.launcher{
        color:var(--finance-text);
        background:var(--finance-surface);
        border-color:var(--finance-border);
        box-shadow:var(--finance-shadow);
        -webkit-backdrop-filter:blur(10px);
        backdrop-filter:blur(10px);
      }
      .stat .lbl,.stat .sub,.cab-card .cab-total{color:var(--finance-muted)}
      .stat.in .val,.tbl .num.in{color:#15803d}
      .stat.out .val,.tbl .num.out{color:#b91c1c}
      .stat.net .val{color:#0369a1}
      .stat.pending .val{color:#a16207}

      .panel{padding:16px}
      .panel h2{color:var(--finance-text)}
      .panel .desc{color:var(--finance-muted)}
      .cab-card:hover{background:#fff;border-color:#fca5a5}
      .cab-card.active{background:#fff1f2;border-color:var(--red)}
      .launcher p{color:#475569}

      .toolbar input,.toolbar select{
        color:var(--finance-text);
        background:rgba(255,255,255,.94);
        border-color:#cbd5e1;
      }
      .toolbar input::placeholder{color:#94a3b8}
      .toolbar input:focus,.toolbar select:focus{border-color:var(--red);box-shadow:0 0 0 3px rgba(196,0,0,.08)}
      .btn.ghost{color:#334155;background:#fff;border-color:#cbd5e1}
      .btn.ghost:hover{background:#f8fafc}

      .tbl{color:var(--finance-text)}
      .tbl th,.tbl td{border-bottom-color:#e2e8f0}
      .tbl th{top:0;color:#64748b;background:#f8fafc}
      .tbl tr:hover td{background:rgba(248,250,252,.92)}
      .empty{color:#64748b}

      .sink.sheet{background:#dcfce7;color:#166534;border-color:#bbf7d0}
      .sink.supabase{background:#e0f2fe;color:#075985;border-color:#bae6fd}
      .sink.gform{background:#f3e8ff;color:#6b21a8;border-color:#e9d5ff}
      .sink.gas{background:#fef9c3;color:#854d0e;border-color:#fde68a}
      .sink.raos{background:#fee2e2;color:#991b1b;border-color:#fecaca}
      .roadmap{background:#fff7ed;border-color:#fdba74;color:#9a3412}
      .roadmap strong{color:#c2410c}
      .roadmap code{background:#ffedd5;color:#7c2d12}

      .badge.in,.badge.paid{background:#dcfce7;color:#166534}
      .badge.out,.badge.overdue{background:#fee2e2;color:#991b1b}
      .badge.pending{background:#fef9c3;color:#854d0e}

      .finance-note{
        margin:0 0 12px;
        border:1px solid var(--finance-border);
        border-radius:10px;
        background:rgba(255,255,255,.82);
        box-shadow:0 4px 12px rgba(15,23,42,.05);
        overflow:hidden;
      }
      .finance-note summary{
        display:flex;align-items:center;gap:8px;
        min-height:36px;padding:7px 10px;
        color:#475569;font-size:11px;font-weight:700;
        cursor:pointer;list-style:none;user-select:none;
      }
      .finance-note summary::-webkit-details-marker{display:none}
      .finance-note summary::before{content:'ⓘ';color:var(--red);font-size:13px}
      .finance-note summary::after{content:'▾';margin-left:auto;color:#94a3b8;transition:transform .15s ease}
      .finance-note[open] summary::after{transform:rotate(180deg)}
      .finance-note-title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#334155}
      .finance-note-body{padding:0 10px 10px;border-top:1px solid #eef2f7}
      .finance-note-body h2{font-size:14px!important;margin:10px 0 4px!important}
      .finance-note-body .desc{font-size:11px!important;margin-bottom:8px!important;line-height:1.45}
      .finance-note-body .sinks{margin-bottom:8px}
      .finance-note-body .roadmap{font-size:11px;margin-bottom:0;padding:8px 10px}
      .finance-overview-note{max-width:760px;margin-bottom:14px}
      .finance-overview-note .finance-note-body .page-title{font-size:16px;margin:10px 0 4px}
      .finance-overview-note .finance-note-body .page-sub{font-size:11px;margin:0;line-height:1.45}

      footer{color:#475569;opacity:.8}

      @media(max-width:700px){
        :root{--finance-header-h:76px}
        header{padding:8px 12px;gap:8px}
        .brand{gap:6px;min-width:0}
        .brand-logo{height:58px!important;max-width:44vw}
        .module-badge{font-size:10px;padding:5px 8px}
        .header-right{gap:6px}
        .user-name{max-width:92px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px}
        .user-role{font-size:9px}
        .btn-back{padding:5px 8px;font-size:10px}
        .tabs{padding:7px 10px;scroll-snap-type:x proximity}
        .tab{padding:9px 11px;font-size:12px;scroll-snap-align:start}
        main{padding:14px 12px 22px}
        .panel{padding:12px;border-radius:10px}
        .stats{grid-template-columns:1fr 1fr;gap:8px}
        .stat{padding:11px}
        .stat .val{font-size:16px}
        .finance-note{margin-bottom:10px}
      }

      @media(max-width:430px){
        .stats{grid-template-columns:1fr}
        .brand-logo{height:54px!important;max-width:42vw}
        .header-right>div{display:none}
      }
    `;
    document.head.appendChild(style);
  }

  function compactOverview(main) {
    if (!main || main.querySelector(':scope > .finance-overview-note')) return;
    const title = main.querySelector(':scope > .page-title');
    const sub = main.querySelector(':scope > .page-sub');
    if (!title && !sub) return;

    const details = document.createElement('details');
    details.className = 'finance-note finance-overview-note';
    const summary = document.createElement('summary');
    summary.innerHTML = '<span class="finance-note-title">Keterangan Finance</span>';
    const body = document.createElement('div');
    body.className = 'finance-note-body';
    details.append(summary, body);
    main.insertBefore(details, title || sub);
    if (title) body.appendChild(title);
    if (sub) body.appendChild(sub);
  }

  function compactPanel(panel) {
    if (!panel || panel.querySelector(':scope > .finance-note')) return;
    const movable = [];
    let titleText = '';

    for (const child of Array.from(panel.children)) {
      if (!child.matches('h2,.desc,.sinks,.roadmap')) break;
      if (!titleText && child.matches('h2')) titleText = child.textContent.trim();
      movable.push(child);
    }
    if (!movable.length) return;

    const details = document.createElement('details');
    details.className = 'finance-note';
    const summary = document.createElement('summary');
    const label = document.createElement('span');
    label.className = 'finance-note-title';
    label.textContent = titleText ? `Keterangan — ${titleText}` : 'Keterangan';
    summary.appendChild(label);
    const body = document.createElement('div');
    body.className = 'finance-note-body';
    details.append(summary, body);

    panel.insertBefore(details, movable[0]);
    movable.forEach((el) => body.appendChild(el));
  }

  function moveTabsBelowHeader(app) {
    const header = app && app.querySelector(':scope > header');
    const tabs = app && app.querySelector('.tabs');
    if (!header || !tabs || tabs.dataset.stickyMounted === '1') return;
    header.insertAdjacentElement('afterend', tabs);
    tabs.dataset.stickyMounted = '1';
  }

  function applyFinanceLayout() {
    installStyles();
    const app = document.getElementById('app');
    const main = app && app.querySelector('main');
    if (!app || !main) return;

    moveTabsBelowHeader(app);
    compactOverview(main);
    main.querySelectorAll('.panel').forEach(compactPanel);
  }

  installStyles();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyFinanceLayout, { once:true });
  } else {
    applyFinanceLayout();
  }
})();
