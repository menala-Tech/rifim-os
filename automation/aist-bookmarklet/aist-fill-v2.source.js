/**
 * AIST Fill Saldo — Bookmarklet v2.1 (One-click handoff)
 *
 * Arsitektur (spec 2026-08-27 rev 2):
 * 1. Operator buka AIST → Document → Add → Balance replenishment.
 * 2. Operator klik bookmark "Fill AIST Saldo".
 * 3. Bookmarklet membuka popup ke RIFIM /aist-handoff.
 * 4. RIFIM memverifikasi sesi aktif, membuat token scoped 10 menit,
 *    mengirimnya kembali via window.postMessage ke AIST (origin-locked).
 * 5. Bookmarklet mengambil antrian pending via fetch() ke RIFIM /api/aist-queue.
 * 6. Modal muncul di AIST; operator klik baris yang diinginkan.
 * 7. Bookmarklet mengisi Driver login + Amount (RAW saldo, bukan invoice).
 * 8. Bookmarklet membaca kembali (read-back). Kalau tidak cocok: fail closed.
 * 9. Operator verifikasi manual dan tekan OK di AIST.
 * 10. Bookmarklet TIDAK submit, TIDAK menandai Lunas, TIDAK memutasi Finance/Sheet.
 */
(function () { 'use strict';

  var RIFIM_BASE = 'https://rifim-os.vercel.app';
  var RIFIM_ORIGIN = (function () { try { return new URL(RIFIM_BASE).origin; } catch (_) { return RIFIM_BASE; } })();
  var QUEUE_URL = RIFIM_BASE + '/api/aist-queue';
  var HANDOFF_URL = RIFIM_BASE + '/aist-handoff';
  var HANDOFF_TYPE = 'MENALA_AIST_HANDOFF';

  var CSS = [
    'position:fixed', 'inset:0', 'z-index:2147483647', 'background:rgba(0,0,0,.6)',
    'display:flex', 'align-items:center', 'justify-content:center', 'font-family:system-ui,Segoe UI,sans-serif'
  ].join(';');
  var PANEL_CSS = [
    'background:#fff', 'color:#111', 'border-radius:12px', 'width:min(960px,96vw)', 'max-height:90vh',
    'display:flex', 'flex-direction:column', 'box-shadow:0 20px 60px rgba(0,0,0,.35)', 'overflow:hidden'
  ].join(';');
  var HEADER_CSS = [
    'padding:14px 18px', 'background:#C40000', 'color:#fff', 'font-weight:700', 'font-size:15px',
    'display:flex', 'justify-content:space-between', 'align-items:center'
  ].join(';');
  var BODY_CSS = 'padding:16px;overflow:auto;flex:1;';
  var TABLE_CSS = [
    'width:100%', 'border-collapse:collapse', 'font-size:13px'
  ].join(';');
  var TH_CSS = 'text-align:left;padding:8px 10px;border-bottom:2px solid #ddd;background:#f8f8f8;';
  var TD_CSS = 'padding:8px 10px;border-bottom:1px solid #eee;cursor:pointer;';
  var STATUS_CSS = 'color:#666;font-size:12px;';
  var FOOTER_CSS = 'padding:10px 16px;border-top:1px solid #eee;color:#666;font-size:12px;display:flex;gap:12px;align-items:center;';
  var BTN_CSS = [
    'padding:6px 12px', 'border:1px solid #ccc', 'border-radius:6px', 'background:#fff',
    'color:#333', 'cursor:pointer', 'font-size:12px'
  ].join(';');
  var SEARCH_CSS = 'padding:6px 10px;border:1px solid #ccc;border-radius:6px;flex:1;font-size:13px;';

  function el(tag, styles, html) {
    var e = document.createElement(tag);
    if (styles) e.style.cssText = styles;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function money(n) {
    return 'Rp ' + (Number(n) || 0).toLocaleString('id-ID');
  }

  var INVOICE_ROUND = { 45000: 50000, 95000: 100000, 140000: 150000, 145000: 150000, 190000: 200000, 195000: 200000 };
  function invoiceNominal(raw) { var n = Number(raw) || 0; return INVOICE_ROUND[n] || n; }

  function formatWib(iso) {
    if (!iso) return '';
    try { var d = new Date(iso); return d.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', hour12: false }); } catch (_) { return String(iso); }
  }

  function normalizeRow(r) {
    var raw = Number(r.saldo_nominal !== undefined ? r.saldo_nominal : r.nominal);
    if (!Number.isFinite(raw) || raw < 0) return null;
    var login = String(r.driver_login || r.loginId || r.loginID || r.login || '').replace(/\D/g, '');
    if (!login) return null;
    var saldo = raw;
    var invoice = Number(r.invoice_nominal) || invoiceNominal(saldo);
    var ts = r.submitted_at || r.ts || r.waktu || r.tanggal || '';
    return {
      request_id: String(r.request_id || r.row || r.id || ''),
      request_no: String(r.request_no || r.row || r.id || ''),
      driver_login: login,
      driver_name: String(r.driver_name || r.namaDriver || r.driverName || ''),
      branch_name: String(r.branch_name || r.cabang || r.branch || ''),
      staff_name: String(r.staff_name || r.staff || ''),
      saldo_nominal: saldo,
      invoice_nominal: invoice,
      submitted_at: ts,
      submitted_at_wib: r.submitted_at_wib || formatWib(ts),
      status: String(r.status || 'pending')
    };
  }

  function isVisibleInput(el) {
    if (!el || !el.tagName || el.tagName.toLowerCase() !== 'input') return false;
    if (el.disabled || el.readOnly) return false;
    if (el.type === 'hidden' || el.type === 'button' || el.type === 'submit' || el.type === 'checkbox' || el.type === 'radio' || el.type === 'file') return false;
    if (el.offsetParent === null) return false;
    var r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    return true;
  }

  function contextForInput(el) {
    var out = [];
    if (el.id) out.push(el.id);
    if (el.name) out.push(el.name);
    if (el.placeholder) out.push(el.placeholder);
    if (el.getAttribute('aria-label')) out.push(el.getAttribute('aria-label'));
    if (el.labels && el.labels.length) {
      for (var i = 0; i < el.labels.length; i++) out.push(el.labels[i].textContent);
    }
    var prev = el.previousElementSibling;
    var scan = 0;
    while (prev && scan < 4) {
      out.push(prev.textContent || '');
      prev = prev.previousElementSibling;
      scan++;
    }
    var parent = el.parentElement;
    while (parent && scan < 8) {
      if (parent.tagName && /^label$/i.test(parent.tagName)) { out.push(parent.textContent); }
      parent = parent.parentElement;
      scan++;
    }
    return out.join(' ').toLowerCase().replace(/\s+/g, ' ');
  }

  function findBySelector(keywords) {
    for (var i = 0; i < keywords.length; i++) {
      var k = keywords[i].toLowerCase();
      var candidates = [
        'input[id*="' + k + '" i]',
        'input[name*="' + k + '" i]',
        'input[aria-label*="' + k + '" i]',
        'input[placeholder*="' + k + '" i]'
      ];
      for (var c = 0; c < candidates.length; c++) {
        try {
          var found = document.querySelector(candidates[c]);
          if (found && isVisibleInput(found)) return found;
        } catch (e) {}
      }
    }
    return null;
  }

  function findByLabelNext(keywords) {
    var labels = document.querySelectorAll('label, span, div, td, th');
    for (var i = 0; i < labels.length; i++) {
      var lbl = labels[i];
      if (!lbl.textContent) continue;
      var text = lbl.textContent.toLowerCase().trim();
      for (var k = 0; k < keywords.length; k++) {
        if (text.indexOf(keywords[k].toLowerCase()) !== -1) {
          var inLabel = lbl.querySelector('input');
          if (inLabel && isVisibleInput(inLabel)) return inLabel;
          if (lbl.htmlFor) {
            var byId = document.getElementById(lbl.htmlFor);
            if (byId && isVisibleInput(byId)) return byId;
          }
          var next = lbl.nextElementSibling;
          while (next) {
            if (next.tagName && /^(input|textarea|select)$/i.test(next.tagName) && isVisibleInput(next)) return next;
            var nested = next.querySelector('input, textarea, select');
            if (nested && isVisibleInput(nested)) return nested;
            next = next.nextElementSibling;
          }
        }
      }
    }
    return null;
  }

  function findByTreeWalker(keywords) {
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    var node;
    while ((node = walker.nextNode()) !== null) {
      var text = (node.textContent || '').toLowerCase();
      for (var k = 0; k < keywords.length; k++) {
        if (text.indexOf(keywords[k].toLowerCase()) !== -1) {
          var n = node.parentNode;
          while (n && n !== document.body) {
            var inputs = n.querySelectorAll('input, textarea, select');
            for (var i = 0; i < inputs.length; i++) {
              if (isVisibleInput(inputs[i]) && n.compareDocumentPosition(inputs[i]) & Node.DOCUMENT_POSITION_FOLLOWING) {
                return inputs[i];
              }
            }
            n = n.parentNode;
          }
        }
      }
    }
    return null;
  }

  function findByHeuristic(keywords) {
    var inputs = document.querySelectorAll('input[type="text"], input[type="number"], input:not([type])');
    for (var i = 0; i < inputs.length; i++) {
      var el = inputs[i];
      if (!isVisibleInput(el)) continue;
      var ctx = contextForInput(el);
      for (var k = 0; k < keywords.length; k++) {
        if (ctx.indexOf(keywords[k].toLowerCase()) !== -1) return el;
      }
    }
    return null;
  }

  // TreeWalker-first matches the proven legacy AIST DOM traversal.
  var LOGIN_KEYWORDS = ['Driver login', 'Login ID', 'Driver ID', 'driver login', 'login driver', 'Nomor Login'];
  var AMOUNT_KEYWORDS = ['Amount', 'Jumlah', 'Nominal', 'amount', 'jumlah', 'nominal', 'Saldo'];

  function findLoginField() {
    return findByTreeWalker(LOGIN_KEYWORDS)
      || findByLabelNext(LOGIN_KEYWORDS)
      || findBySelector(LOGIN_KEYWORDS)
      || findByHeuristic(LOGIN_KEYWORDS);
  }

  function findAmountField() {
    return findByTreeWalker(AMOUNT_KEYWORDS)
      || findByLabelNext(AMOUNT_KEYWORDS)
      || findBySelector(AMOUNT_KEYWORDS)
      || findByHeuristic(AMOUNT_KEYWORDS);
  }

  function setInputValue(el, val) {
    var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(el, String(val));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  function alertLines(lines) {
    alert(lines.join('\n'));
  }

  function toast(msg, kind) {
    var host = document.createElement('div');
    host.style.cssText = [
      'position:fixed', 'top:20px', 'right:20px', 'max-width:420px', 'padding:12px 16px',
      'border-radius:8px', 'z-index:2147483647', 'font-family:system-ui,Segoe UI,sans-serif',
      'font-size:13px', 'box-shadow:0 8px 24px rgba(0,0,0,.35)', 'white-space:pre-wrap',
      'color:#fff', 'background:' + (kind === 'err' ? '#dc2626' : '#16a34a')
    ].join(';');
    host.textContent = msg;
    document.body.appendChild(host);
    setTimeout(function () { host.remove(); }, 5000);
  }

  function readAmountValue(el) {
    return Number(String(el.value || '').replace(/[^0-9]/g, '')) || 0;
  }

  function fillFromRow(row) {
    var loginEl = findLoginField();
    var amountEl = findAmountField();
    if (!loginEl || !amountEl) {
      alertLines([
        'Form AIST Balance replenishment tidak terdeteksi.',
        '',
        'Pastikan Anda sudah membuka:',
        'Document -> Add -> Balance replenishment',
        '',
        'Lalu klik bookmark kembali.'
      ]);
      return;
    }

    setInputValue(loginEl, row.driver_login);
    setInputValue(amountEl, String(row.saldo_nominal));

    var actualLogin = String(loginEl.value || '').trim();
    var actualAmount = readAmountValue(amountEl);

    if (actualLogin !== row.driver_login) {
      alertLines([
        'Read-back Driver login TIDAK cocok.',
        '',
        'Diharapkan : ' + row.driver_login,
        'Aktual     : ' + actualLogin,
        '',
        'JANGAN submit. Perbaiki manual atau ulangi.'
      ]);
      return;
    }
    if (actualAmount !== row.saldo_nominal) {
      alertLines([
        'Read-back Amount TIDAK cocok.',
        '',
        'Diharapkan : ' + row.saldo_nominal,
        'Aktual     : ' + actualAmount,
        '',
        'JANGAN submit. Periksa kembali field Amount.'
      ]);
      return;
    }

    toast('Field AIST diisi. Login=' + row.driver_login + ' | Amount=' + money(row.saldo_nominal) + ' (SALDO RAW). Silakan verifikasi dan submit manual.', 'ok');
  }

  function renderQueue(rows, filterText) {
    filterText = (filterText || '').toLowerCase();
    var filtered = rows.filter(function (r) {
      if (!filterText) return true;
      var hay = [r.branch_name, r.staff_name, r.driver_name, r.driver_login, r.request_no].join(' ').toLowerCase();
      return hay.indexOf(filterText) !== -1;
    });

    var panel = document.getElementById('__menala_aist_panel__');
    if (!panel) return;
    var body = panel.querySelector('[data-aist-body]');
    if (!body) return;
    body.innerHTML = '';

    if (!filtered.length) {
      body.appendChild(el('div', null, 'Tidak ada antrian yang memenuhi filter.'));
      return;
    }

    var table = el('table', TABLE_CSS);
    var thead = el('thead');
    var tr = el('tr');
    ['Waktu', 'Cabang', 'Staff', 'Nama Driver', 'Login', 'Saldo', 'Invoice'].forEach(function (h) {
      tr.appendChild(el('th', TH_CSS, h));
    });
    thead.appendChild(tr);
    table.appendChild(thead);

    var tbody = el('tbody');
    filtered.forEach(function (r) {
      var rowEl = el('tr');
      rowEl.style.cssText = TD_CSS;
      rowEl.onmouseenter = function () { this.style.background = '#f0f7ff'; };
      rowEl.onmouseleave = function () { this.style.background = 'transparent'; };
      rowEl.onclick = function () { fillFromRow(r); closeModal(); };
      rowEl.innerHTML = [
        '<td>' + (r.submitted_at_wib || '') + '<br><span style="' + STATUS_CSS + '">' + r.status + '</span></td>',
        '<td>' + (r.branch_name || '') + '</td>',
        '<td>' + (r.staff_name || '') + '</td>',
        '<td>' + (r.driver_name || '') + '</td>',
        '<td><b>' + (r.driver_login || '') + '</b></td>',
        '<td>' + money(r.saldo_nominal) + '</td>',
        '<td>' + money(r.invoice_nominal) + '</td>'
      ].join('');
      tbody.appendChild(rowEl);
    });
    table.appendChild(tbody);
    body.appendChild(table);
  }

  function closeModal() {
    var m = document.getElementById('__menala_aist_modal__');
    if (m) m.remove();
  }

  function showError(msg) {
    var m = document.getElementById('__menala_aist_modal__');
    if (!m) {
      m = el('div', CSS);
      m.id = '__menala_aist_modal__';
      document.body.appendChild(m);
    }
    m.innerHTML = '';
    var p = el('div', PANEL_CSS);
    p.appendChild(el('div', HEADER_CSS, 'Fill AIST - Pengisian Saldo'));
    var b = el('div', BODY_CSS);
    b.textContent = ' ' + msg;
    p.appendChild(b);
    m.appendChild(p);
  }

  function showQueue(rows) {
    closeModal();
    var m = el('div', CSS);
    m.id = '__menala_aist_modal__';
    var p = el('div', PANEL_CSS);
    p.id = '__menala_aist_panel__';

    var header = el('div', HEADER_CSS);
    header.innerHTML = '<span>Fill AIST - Pengisian Saldo</span>';
    var closeBtn = el('button', BTN_CSS, 'Tutup');
    closeBtn.onclick = closeModal;
    header.appendChild(closeBtn);
    p.appendChild(header);

    var body = el('div', BODY_CSS);
    body.setAttribute('data-aist-body', '');
    p.appendChild(body);

    var footer = el('div', FOOTER_CSS);
    var search = el('input', SEARCH_CSS);
    search.placeholder = 'Cari cabang / driver / login…';
    search.oninput = function () { renderQueue(rows, this.value); };
    var refresh = el('button', BTN_CSS, 'Refresh');
    refresh.onclick = function () { startOneClickHandoff(); };
    footer.appendChild(search);
    footer.appendChild(refresh);
    p.appendChild(footer);

    m.appendChild(p);
    document.body.appendChild(m);
    renderQueue(rows, '');
  }

  function isJsonContentType(r) {
    var ct = r.headers.get('Content-Type') || '';
    return ct.indexOf('application/json') !== -1;
  }

  function validateQueuePayload(data) {
    var rawRows = null;
    if (Array.isArray(data)) rawRows = data;
    else if (data && typeof data === 'object' && Array.isArray(data.rows)) rawRows = data.rows;
    else if (data && typeof data === 'object' && data.success === false) return { error: 'GAS melaporkan gagal: ' + (data.message || 'tidak diketahui'), rows: [] };
    else return { error: 'Antrian kosong atau bukan format JSON yang diharapkan.', rows: [] };
    if (rawRows.length === 0) return { error: null, rows: [] };
    var normalized = [];
    for (var i = 0; i < rawRows.length; i++) {
      var row = normalizeRow(rawRows[i]);
      if (!row) return { error: 'Baris ke-' + (i + 1) + ' tidak valid (login / nominal kosong atau tidak dikenali).', rows: [] };
      normalized.push(row);
    }
    return { error: null, rows: normalized };
  }

  function fetchQueueWithToken(token) {
    showError('Memuat antrian…');
    return fetch(QUEUE_URL + '?t=' + encodeURIComponent(token), { method: 'GET', credentials: 'omit', cache: 'no-store' })
      .then(function (r) {
        if (r.status === 401 || r.status === 403) throw new Error('Token AIST tidak valid, expired, atau belum aktif.');
        if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + r.statusText);
        if (!isJsonContentType(r)) throw new Error('Response bukan JSON (Content-Type: ' + (r.headers.get('Content-Type') || 'kosong') + '). Kemungkinan CORB.');
        return r.json();
      })
      .then(function (data) {
        var v = validateQueuePayload(data);
        if (v.error) throw new Error(v.error);
        showQueue(v.rows);
      });
  }

  function onHandoffMessage(event) {
    if (event.origin !== RIFIM_ORIGIN) return;
    var data = event.data;
    if (!data || data.type !== HANDOFF_TYPE || !data.token) return;
    window.removeEventListener('message', onHandoffMessage);
    clearTimeout(window.__menala_aist_handoff_timeout__);
    fetchQueueWithToken(data.token).catch(function (err) {
      showError('Gagal memuat antrian: ' + (err && err.message ? err.message : String(err)));
    });
  }

  function openHandoffWindow() {
    var w = 480, h = 420;
    var left = window.screenX + (window.innerWidth - w) / 2;
    var top = window.screenY + (window.innerHeight - h) / 2;
    var features = 'width=' + w + ',height=' + h + ',left=' + left + ',top=' + top + ',resizable=yes,scrollbars=yes';
    return window.open(HANDOFF_URL + '?origin=' + encodeURIComponent(window.location.origin), 'menala_aist_handoff', features);
  }

  function startOneClickHandoff() {
    if (window.location.origin !== 'https://aist-id.taxsee.com') {
      showError('Bookmarklet ini hanya untuk halaman AIST (https://aist-id.taxsee.com). Origin saat ini: ' + window.location.origin);
      return;
    }
    window.removeEventListener('message', onHandoffMessage);
    window.addEventListener('message', onHandoffMessage);
    var popup = openHandoffWindow();
    if (!popup) {
      showError('Popup AIST handoff diblokir. Izinkan popup untuk domain AIST, lalu ulangi.');
      return;
    }
    showError('Menunggu token dari RIFIM…');
    clearTimeout(window.__menala_aist_handoff_timeout__);
    window.__menala_aist_handoff_timeout__ = setTimeout(function () {
      window.removeEventListener('message', onHandoffMessage);
      showError('AIST handoff tidak menerima token dalam waktu 60 detik. Pastikan Anda login ke RIFIM dan popup tidak diblokir.');
    }, 60000);
  }

  startOneClickHandoff();
})();
