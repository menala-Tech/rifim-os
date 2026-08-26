/**
 * AIST Fill Saldo — Bookmarklet v2 (Semi-Auto, clipboard-driven)
 *
 * Arsitektur (spec 2026-08-26):
 *
 *   1. Operator sudah klik `🪄 Fill AIST` di RIFIM OS → Finance → Isi Saldo (RAOS).
 *      Payload `MENALA_AIST_V2:<base64json>` sudah tersimpan di clipboard.
 *   2. Operator pindah tab ke AIST → buka Document → Add → Balance replenishment.
 *   3. Setelah form terbuka, klik bookmark "Fill AIST Saldo".
 *   4. Bookmarklet:
 *        a. baca clipboard (butuh permission user gesture — klik bookmark = gesture)
 *        b. validasi format + TTL (10 menit)
 *        c. pastikan form Balance replenishment terbuka (Driver login + Amount visible)
 *        d. isi kedua field
 *        e. read-back untuk verifikasi exact match
 *        f. tampilkan pesan sukses (operator masih harus tekan OK di AIST manual)
 *
 * Bookmarklet ini TIDAK:
 *   - fetch list saldo dari GAS       (Finance UI yang pilih)
 *   - baca localStorage.rifim_auth    (no secrets cross-origin)
 *   - panggil finance_saldo_raos_mark_paid (no Lunas / no backend mutation)
 *   - submit form AIST otomatis       (operator verifikasi + OK manual)
 */
(function () {
  'use strict';

  var PREFIX = 'MENALA_AIST_V2:';
  var TTL_MS = 10 * 60 * 1000; // 10 menit

  var toast = mkToast();

  // ── 1. Baca clipboard ─────────────────────────────────────────────────
  readClipboard().then(function (raw) {
    var payload;
    try { payload = decodeAndValidate(raw); }
    catch (e) {
      alertLines([
        '❌ Payload Fill AIST tidak valid.',
        '',
        e.message,
        '',
        'Kembali ke RIFIM Finance → Isi Saldo (RAOS),',
        'pilih request, lalu klik 🪄 Fill AIST.'
      ]);
      return;
    }

    // ── 2. Deteksi form AIST Balance replenishment ─────────────────────
    var amountEl = findInputByLabel(['Amount', 'Jumlah', 'Nominal']);
    var loginEl  = findInputByLabel(['Driver login', 'Login ID', 'Driver ID', 'Login']);
    if (!amountEl || !loginEl) {
      alertLines([
        '❌ Form AIST tidak terdeteksi.',
        '',
        'Buka form AIST Balance replenishment terlebih dahulu,',
        'kemudian klik kembali "Fill AIST Saldo".'
      ]);
      return;
    }

    // ── 3. Konfirmasi eksplisit ke operator ────────────────────────────
    var ok = confirm([
      'Isi field AIST dengan data berikut?',
      '',
      'Driver login : ' + payload.driver_login,
      'Amount       : ' + payload.nominal.toLocaleString('id-ID'),
      (payload.driver_name ? 'Driver name  : ' + payload.driver_name : ''),
      (payload.branch_name ? 'Cabang       : ' + payload.branch_name : ''),
      (payload.staff_name  ? 'Staff        : ' + payload.staff_name  : ''),
      '',
      'Source: RIFIM Finance → Isi Saldo (RAOS)',
      '',
      'Field akan diisi TAPI tidak di-submit.',
      'Transaksi BELUM dianggap selesai.'
    ].filter(Boolean).join('\n'));
    if (!ok) return;

    // ── 4. Isi + read-back ─────────────────────────────────────────────
    setInputValue(loginEl,  String(payload.driver_login));
    setInputValue(amountEl, String(payload.nominal));

    var loginActual  = String(loginEl.value || '').trim();
    var amountActual = String(amountEl.value || '').replace(/[^\d]/g, '');
    if (loginActual !== payload.driver_login) {
      alertLines([
        '❌ Read-back Driver login TIDAK cocok.',
        '',
        'Diharapkan : ' + payload.driver_login,
        'Aktual     : ' + loginActual,
        '',
        'JANGAN submit. Perbaiki manual atau ulangi.'
      ]);
      return;
    }
    if (Number(amountActual) !== payload.nominal) {
      alertLines([
        '❌ Read-back Amount TIDAK cocok.',
        '',
        'Diharapkan : ' + payload.nominal,
        'Aktual     : ' + amountActual,
        '',
        'JANGAN submit. Perbaiki manual atau ulangi.'
      ]);
      return;
    }

    toast('✅ Field AIST berhasil diisi. Silakan verifikasi dan submit. Transaksi BELUM dianggap selesai.', 'ok');
  }).catch(function (err) {
    alertLines([
      '❌ Browser tidak mengizinkan membaca clipboard.',
      '',
      (err && err.message ? err.message : String(err)),
      '',
      'Kembali ke Finance dan gunakan Copy Login + Copy Nominal (manual paste).'
    ]);
  });

  // ══════════════════════════════════════════════════════════════════════
  // Helpers
  // ══════════════════════════════════════════════════════════════════════

  function readClipboard() {
    if (!navigator.clipboard || !navigator.clipboard.readText) {
      return Promise.reject(new Error('navigator.clipboard.readText tidak tersedia.'));
    }
    return navigator.clipboard.readText();
  }

  function decodeAndValidate(raw) {
    var text = String(raw || '').trim();
    if (!text) throw new Error('Clipboard kosong.');
    if (text.indexOf(PREFIX) !== 0) {
      throw new Error('Clipboard bukan payload MENALA_AIST_V2. Klik 🪄 Fill AIST di Finance dulu.');
    }
    var b64 = text.slice(PREFIX.length);
    var json;
    try {
      // Reverse encode: btoa(unescape(encodeURIComponent(str)))
      json = decodeURIComponent(escape(atob(b64)));
    } catch (e) { throw new Error('Base64 decode gagal.'); }
    var p;
    try { p = JSON.parse(json); } catch (e) { throw new Error('JSON parse gagal.'); }

    if (p.version !== 2) throw new Error('Versi payload tidak didukung (v=' + p.version + ').');
    if (p.source !== 'RIFIM_FINANCE_SALDO_RAOS') throw new Error('Source payload tidak dikenal.');
    if (!p.request_id) throw new Error('request_id kosong.');
    if (!p.driver_login || !/^[0-9]+$/.test(String(p.driver_login))) {
      throw new Error('driver_login invalid (harus digit).');
    }
    if (!(Number.isFinite(p.nominal) && p.nominal > 0)) {
      throw new Error('nominal invalid.');
    }
    var prepared = Date.parse(p.prepared_at);
    if (!prepared) throw new Error('prepared_at invalid.');
    var age = Date.now() - prepared;
    if (age > TTL_MS) {
      throw new Error('Payload Fill AIST sudah kedaluwarsa (>10 menit). Pilih ulang request dari Finance.');
    }
    if (age < -60000) throw new Error('prepared_at di masa depan (clock skew).');
    // Guard payload agar tidak menyelundupkan token/secret.
    var allowed = ['version','request_id','driver_login','nominal','driver_name','branch_name','staff_name','prepared_at','source'];
    Object.keys(p).forEach(function (k) {
      if (allowed.indexOf(k) === -1) throw new Error('Field payload tidak dikenal: ' + k);
    });
    return {
      version: 2,
      request_id: String(p.request_id),
      driver_login: String(p.driver_login),
      nominal: Number(p.nominal),
      driver_name: p.driver_name ? String(p.driver_name) : '',
      branch_name: p.branch_name ? String(p.branch_name) : '',
      staff_name:  p.staff_name  ? String(p.staff_name)  : '',
      prepared_at: p.prepared_at,
      source: p.source,
    };
  }

  function findInputByLabel(keywords) {
    var inputs = document.querySelectorAll('input[type="text"], input[type="number"], input:not([type])');
    for (var i = 0; i < inputs.length; i++) {
      var el = inputs[i];
      if (el.disabled || el.readOnly) continue;
      if (el.offsetParent === null) continue; // hidden
      var context = '';
      if (el.id) {
        var lbl = document.querySelector('label[for="' + el.id.replace(/"/g,'') + '"]');
        if (lbl) context += ' ' + lbl.textContent;
      }
      var wrap = el.closest('label');
      if (wrap) context += ' ' + wrap.textContent;
      var prev = el.previousElementSibling;
      var scan = 0;
      while (prev && scan < 4) {
        context += ' ' + (prev.textContent || '');
        prev = prev.previousElementSibling;
        scan++;
      }
      context += ' ' + (el.placeholder || '') + ' ' + (el.name || '') + ' ' + (el.getAttribute('aria-label') || '');
      var low = context.toLowerCase();
      for (var j = 0; j < keywords.length; j++) {
        if (low.indexOf(keywords[j].toLowerCase()) !== -1) return el;
      }
    }
    return null;
  }

  function setInputValue(el, val) {
    var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(el, val);
    el.dispatchEvent(new Event('input',  { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur',   { bubbles: true }));
  }

  function alertLines(lines) { alert(lines.join('\n')); }

  function mkToast() {
    var host = document.createElement('div');
    host.style.cssText = [
      'position:fixed','top:20px','right:20px','max-width:420px','padding:12px 16px',
      'background:#111','color:#fff','border-radius:8px','z-index:2147483647',
      'font-family:system-ui,Segoe UI,sans-serif','font-size:13px',
      'box-shadow:0 8px 24px rgba(0,0,0,.35)','display:none','white-space:pre-wrap'
    ].join(';');
    document.body.appendChild(host);
    var timer = null;
    return function (msg, kind) {
      host.textContent = msg;
      host.style.background = kind === 'err' ? '#dc2626' : (kind === 'ok' ? '#16a34a' : '#111');
      host.style.display = 'block';
      if (timer) clearTimeout(timer);
      timer = setTimeout(function () { host.style.display = 'none'; }, 6000);
    };
  }
})();
