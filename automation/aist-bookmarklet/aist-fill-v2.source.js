/**
 * AIST Fill Saldo — Bookmarklet v2
 * Sumber data: raos_saldo_requests (Supabase) via GAS Web App
 *              https://.../exec?action=finance_saldo_raos_list&status=approved
 *
 * Cara pakai:
 *   1. Login Rifim-OS dulu (email admin@menala.co.id / rifiminternationalgemilang@gmail.com)
 *      supaya localStorage.rifim_auth ter-set.
 *   2. Buka halaman AIST > Documents > Add > Balance replenishment.
 *      Pilih Subdivision + Currency manual di modal AIST.
 *   3. Klik bookmark "AIST Fill v2" → picker floating muncul.
 *   4. Klik row driver → input Amount + Driver login otomatis terisi di modal AIST.
 *      Row hilang dari picker (auto-mark is_processed=true di Supabase).
 *   5. Klik OK di modal AIST untuk kirim ke AIST.
 *
 * Bedanya dari bookmarklet lama (sheet Pengisian Saldo):
 *   - Source langsung dari Supabase raos_saldo_requests (bukan sheet Jawaban Formulir 1)
 *   - Mark processed via GAS Web App (bukan set checkbox kolom G di sheet)
 *   - Auto-refresh setiap 30 detik supaya pengajuan baru dari PWA RAOS langsung muncul
 *   - Filter status='approved' (koord/admin sudah setujui, tinggal admin isi di AIST)
 */
(function () {
  var GAS_URL = 'https://script.google.com/macros/s/AKfycbzzK75gxawaylaUZpoC1zp_hq5ktznlN7scIl24HkdEgR2l3cVmpUSLck0potcMZZtw/exec';

  // Cek auth: butuh localStorage.rifim_auth dari sesi Rifim-OS Portal
  var auth;
  try { auth = JSON.parse(localStorage.getItem('rifim_auth') || '{}'); } catch (e) { auth = {}; }
  if (!auth.access_token) {
    alert('Session token Rifim-OS tidak ada. Login ulang di Portal, lalu jalankan bookmarklet lagi.');
    window.open('https://rifim-os.vercel.app/portal', '_blank', 'noopener');
    return;
  }

  // Prevent double-inject
  var existing = document.getElementById('__aist_fill_v2_picker__');
  if (existing) existing.remove();

  var host = document.createElement('div');
  host.id = '__aist_fill_v2_picker__';
  host.style.cssText = [
    'position:fixed', 'top:20px', 'right:20px', 'width:520px', 'max-height:85vh',
    'background:#fff', 'color:#111', 'border-radius:12px',
    'box-shadow:0 8px 32px rgba(0,0,0,.35)', 'z-index:2147483647',
    'font-family:system-ui,Segoe UI,sans-serif', 'font-size:13px',
    'display:flex', 'flex-direction:column', 'overflow:hidden'
  ].join(';');
  host.innerHTML = [
    '<div id="__aist_hdr" style="padding:12px 14px;background:#C40000;color:#fff;display:flex;justify-content:space-between;align-items:center">',
    '  <div>',
    '    <div style="font-weight:800;font-size:14px">AIST Fill v2 — Pengajuan Saldo</div>',
    '    <div id="__aist_meta" style="font-size:11px;opacity:.85">Loading…</div>',
    '  </div>',
    '  <div style="display:flex;gap:6px">',
    '    <button id="__aist_refresh" style="background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.3);color:#fff;padding:5px 10px;border-radius:6px;cursor:pointer;font-size:11px">🔄</button>',
    '    <button id="__aist_close"   style="background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.3);color:#fff;padding:5px 10px;border-radius:6px;cursor:pointer;font-size:11px">✕</button>',
    '  </div>',
    '</div>',
    '<div id="__aist_filter" style="padding:8px 12px;background:#f5f5f5;border-bottom:1px solid #e5e5e5;display:flex;gap:6px;align-items:center">',
    '  <input id="__aist_search" placeholder="Cari nama/ID driver/staff…" style="flex:1;padding:6px 10px;border:1px solid #ddd;border-radius:6px;font-size:12px">',
    '  <select id="__aist_status" style="padding:6px 8px;border:1px solid #ddd;border-radius:6px;font-size:12px">',
    '    <option value="approved">Approved (siap isi)</option>',
    '    <option value="pending">Pending (belum approve)</option>',
    '  </select>',
    '</div>',
    '<div id="__aist_body" style="flex:1;overflow-y:auto;background:#fff"></div>',
    '<div id="__aist_toast" style="padding:6px 12px;background:#111;color:#fff;font-size:11px;display:none"></div>'
  ].join('');

  document.body.appendChild(host);

  function showToast(msg, kind) {
    var t = document.getElementById('__aist_toast');
    t.textContent = msg;
    t.style.background = kind === 'err' ? '#dc2626' : (kind === 'ok' ? '#16a34a' : '#111');
    t.style.display = 'block';
    setTimeout(function () { t.style.display = 'none'; }, 3500);
  }

  function fmtRp(n) { return 'Rp ' + (Number(n) || 0).toLocaleString('id-ID'); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]; }); }

  function gasPost(action, payload) {
    var body = Object.assign({ action: action, access_token: auth.access_token }, payload || {});
    return fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    }).then(function (r) { return r.json(); }).then(function (data) {
      if (data.code === 'TOKEN_INVALID' || data.code === 'TOKEN_REQUIRED') {
        throw new Error('Session Rifim-OS kedaluwarsa. Login ulang lalu jalankan bookmarklet lagi.');
      }
      return data;
    });
  }

  // Fetch dari Supabase via GAS Web App
  function fetchRows() {
    var status = document.getElementById('__aist_status').value;
    document.getElementById('__aist_meta').textContent = 'Loading dari Supabase…';
    return gasPost('finance_saldo_raos_list', { status: status }).then(function (data) {
      if (!data.success) throw new Error(data.message || 'Gagal load');
      return data.rows || [];
    });
  }

  var _cached = [];
  var _busy = {};
  function render(rows) {
    _cached = rows;
    var q = (document.getElementById('__aist_search').value || '').toLowerCase();
    var filtered = q ? rows.filter(function (r) {
      var hay = ((r.staff_name || '') + ' ' + (r.staff_code || '') + ' ' + (r.driver_name || '') + ' ' + (r.driver_login || '') + ' ' + (r.branch_name || '')).toLowerCase();
      return hay.indexOf(q) !== -1;
    }) : rows;

    var body = document.getElementById('__aist_body');
    document.getElementById('__aist_meta').textContent = filtered.length + ' pengajuan • ' + new Date().toLocaleTimeString('id-ID');
    if (!filtered.length) {
      body.innerHTML = '<div style="padding:40px 20px;text-align:center;color:#888">Tidak ada pengajuan cocok filter.</div>';
      return;
    }

    body.innerHTML = filtered.map(function (r, i) {
      return [
        '<div class="__aist_row" data-idx="' + i + '" data-id="' + esc(r.id) + '"',
        '     style="padding:10px 12px;border-bottom:1px solid #eee;cursor:' + (_busy[r.id] ? 'wait' : 'pointer') + ';display:flex;justify-content:space-between;align-items:center;opacity:' + (_busy[r.id] ? '.55' : '1') + ';pointer-events:' + (_busy[r.id] ? 'none' : 'auto') + '"',
        '     onmouseover="this.style.background=\'#fff3f3\'" onmouseout="this.style.background=\'#fff\'">',
        '  <div style="flex:1;min-width:0">',
        '    <div style="font-weight:700;font-size:13px">' + esc(r.staff_name || '?') + ' <span style="color:#888;font-weight:400">→</span> <span style="color:#C40000">' + esc(r.driver_name || r.driver_login || '?') + '</span></div>',
        '    <div style="font-size:11px;color:#666;margin-top:2px">',
        '      <b>' + esc(r.branch_name || '') + '</b> · Login <code style="background:#f0f0f0;padding:1px 5px;border-radius:3px">' + esc(r.driver_login || '—') + '</code> · ' + new Date(r.created_at).toLocaleString('id-ID'),
        '    </div>',
        '  </div>',
        '  <div style="font-weight:800;color:#C40000;font-size:15px;font-family:monospace;margin-left:12px">' + fmtRp(r.nominal) + '</div>',
        '</div>'
      ].join('');
    }).join('');

    Array.prototype.forEach.call(body.querySelectorAll('.__aist_row'), function (el) {
      el.addEventListener('click', function () {
        var idx = parseInt(el.dataset.idx);
        var row = filtered[idx];
        processRow(row);
      });
    });
  }

  // Fill AIST modal fields — heuristic locator (adjust selector kalau AIST DOM berbeda)
  function fillAistModal(row) {
    var amountEl = findInputByLabel(['Amount','Jumlah','Nominal']);
    var loginEl  = findInputByLabel(['Driver login','Login ID','Driver ID','Login']);

    if (!amountEl || !loginEl) {
      showToast('❌ Tidak nemu input Amount/Login di modal AIST. Buka modal Balance replenishment dulu.', 'err');
      return false;
    }

    setInputValue(amountEl, String(row.nominal));
    setInputValue(loginEl,  String(row.driver_login || row.driver_id || ''));

    showToast('Field terisi: ' + fmtRp(row.nominal) + ' → ' + (row.driver_login || row.driver_id) + '. Tekan OK di AIST; menunggu konfirmasi.', 'info');
    return true;
  }

  function processRow(row) {
    if (_busy[row.id]) return;
    if (!fillAistModal(row)) return;
    _busy[row.id] = true;
    render(_cached);

    waitForAistAcknowledgement(30000).then(function () {
      showToast('AIST terkonfirmasi. Menyimpan status lunas…', 'info');
      return gasPost('finance_saldo_raos_mark_paid', { id: row.id });
    }).then(function (res) {
      if (res.status === 'not_approved') throw new Error('Request berubah ke status ' + (res.current_status || 'bukan approved') + '.');
      if (res.status === 'not_found') throw new Error('Request tidak ditemukan.');
      if (!res.success) throw new Error(res.message || 'Mark-paid gagal.');

      delete _busy[row.id];
      _cached = _cached.filter(function (x) { return x.id !== row.id; });
      render(_cached);
      showToast(res.status === 'already_processed'
        ? 'Request ini sudah pernah diproses.'
        : 'AIST sukses dan request ditandai lunas.', 'ok');
    }).catch(function (err) {
      delete _busy[row.id];
      render(_cached);
      showToast(err.message + ' Row tetap approved; klik lagi untuk retry.', 'err');
    });
  }

  function waitForAistAcknowledgement(timeoutMs) {
    return new Promise(function (resolve, reject) {
      var settled = false;
      var successPattern = /\b(success|successful|successfully|sukses|berhasil|completed)\b/i;
      var errorPattern = /\b(error|failed|failure|gagal|batal|cancelled|canceled|invalid)\b/i;

      function finish(fn, value) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        observer.disconnect();
        fn(value);
      }

      function inspect(node) {
        if (!node || (node.nodeType !== 1 && node.nodeType !== 3)) return;
        var element = node.nodeType === 1 ? node : node.parentElement;
        if (element && element.closest && element.closest('#__aist_fill_v2_picker__')) return;
        var text = String(node.textContent || '').replace(/\s+/g, ' ').trim();
        if (!text) return;
        if (errorPattern.test(text)) finish(reject, new Error('AIST melaporkan gagal/batal.'));
        else if (successPattern.test(text)) finish(resolve, text);
      }

      var observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
          Array.prototype.forEach.call(mutation.addedNodes || [], inspect);
          if (mutation.type === 'characterData') inspect(mutation.target);
        });
      });
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
      var timer = setTimeout(function () {
        finish(reject, new Error('Timeout 30 detik menunggu konfirmasi AIST.'));
      }, timeoutMs);
    });
  }

  // Utility: find input by nearby label text (label[for], legend, or preceding sibling)
  function findInputByLabel(keywords) {
    var inputs = document.querySelectorAll('input[type="text"], input[type="number"], input:not([type])');
    for (var i = 0; i < inputs.length; i++) {
      var el = inputs[i];
      if (el.disabled || el.readOnly) continue;
      if (el.offsetParent === null) continue; // not visible
      var context = '';
      // 1. label[for=el.id]
      if (el.id) {
        var lbl = document.querySelector('label[for="' + el.id + '"]');
        if (lbl) context += ' ' + lbl.textContent;
      }
      // 2. Wrapping label
      var wrap = el.closest('label');
      if (wrap) context += ' ' + wrap.textContent;
      // 3. Previous sibling label
      var prev = el.previousElementSibling;
      while (prev) {
        if (/label|span|div/i.test(prev.tagName)) context += ' ' + prev.textContent;
        if (context.length > 200) break;
        prev = prev.previousElementSibling;
      }
      // 4. Placeholder / name / aria
      context += ' ' + (el.placeholder || '') + ' ' + (el.name || '') + ' ' + (el.getAttribute('aria-label') || '');

      var ctxLower = context.toLowerCase();
      for (var j = 0; j < keywords.length; j++) {
        if (ctxLower.indexOf(keywords[j].toLowerCase()) !== -1) return el;
      }
    }
    return null;
  }

  // Set input value + fire React-compatible events (banyak modern SPA butuh ini)
  function setInputValue(el, val) {
    var nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    nativeInputValueSetter.call(el, val);
    el.dispatchEvent(new Event('input',  { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.focus();
  }

  document.getElementById('__aist_refresh').addEventListener('click', function () {
    fetchRows().then(render).catch(function (err) { showToast('❌ ' + err.message, 'err'); });
  });
  document.getElementById('__aist_close').addEventListener('click', function () { host.remove(); if (window.__aist_interval) clearInterval(window.__aist_interval); });
  document.getElementById('__aist_search').addEventListener('input', function () { render(_cached); });
  document.getElementById('__aist_status').addEventListener('change', function () {
    fetchRows().then(render).catch(function (err) { showToast('❌ ' + err.message, 'err'); });
  });

  // Initial load + auto-refresh 30s
  fetchRows().then(render).catch(function (err) { showToast('❌ ' + err.message, 'err'); });
  if (window.__aist_interval) clearInterval(window.__aist_interval);
  window.__aist_interval = setInterval(function () {
    fetchRows().then(render).catch(function () {});
  }, 30000);
})();
