/**
 * aist-finance-semi.js — Semi-auto AIST handoff (Finance → Bookmarklet)
 *
 * Menambahkan 3 tombol di tiap baris Finance → Isi Saldo (RAOS):
 *
 *   [Copy Login]   → clipboard = driver_login_id (raw digit)
 *   [Copy Nominal] → clipboard = nominal RAW (integer, no "Rp", no separator)
 *   [🪄 Fill AIST]  → clipboard = "MENALA_AIST_V2:<base64json>" payload,
 *                    lalu operator pindah ke AIST + jalankan bookmarklet.
 *
 * Kontrak Non-Auto (spec 2026-08-26):
 *   - TIDAK memutasi status backend (no Lunas, no mark_paid, no aist_job).
 *   - TIDAK menyentuh Finance GAS.
 *   - TIDAK berisi secret di payload (no bearer, no rifim_auth token).
 *   - Coexist berdampingan dengan Auto-Fill (Worker/Agent) — bukan pengganti.
 *
 * Payload format:
 *   {
 *     version: 2,
 *     request_id: string,
 *     driver_login: string,           // digit-only, sesuai kolom AIST "Driver login"
 *     nominal: number,                // RAW saldo (bukan invoice)
 *     driver_name?: string,
 *     branch_name?: string,
 *     staff_name?: string,
 *     prepared_at: string,            // ISO-8601
 *     source: 'RIFIM_FINANCE_SALDO_RAOS'
 *   }
 *
 * TTL default: 10 menit (dienforce di bookmarklet, bukan di sini).
 */
(function (global) {
  'use strict';
  if (!/\/finance(?:\/|$)/.test(location.pathname)) return;

  var CLIPBOARD_PREFIX = 'MENALA_AIST_V2:';
  var SOURCE_TAG = 'RIFIM_FINANCE_SALDO_RAOS';
  var decorated = new WeakSet();

  // ── Helpers ────────────────────────────────────────────────────────────

  function toast(msg, kind) {
    if (typeof global.showToast === 'function') global.showToast(msg, kind || 'ok');
    else console.log('[aist-finance-semi]', kind || 'info', msg);
  }

  function b64encode(str) {
    // btoa needs binary; JSON is ASCII-safe when we escape unicode first.
    return btoa(unescape(encodeURIComponent(str)));
  }

  function safeStr(v) { return v == null ? '' : String(v).trim(); }

  function parseNominal(raw) {
    var digits = String(raw == null ? '' : raw).replace(/[^0-9]/g, '');
    return Number(digits || 0);
  }

  function writeClipboard(text) {
    if (global.navigator && global.navigator.clipboard && global.navigator.clipboard.writeText) {
      return global.navigator.clipboard.writeText(text);
    }
    // Fallback: textarea + execCommand (works in older/permissioned contexts).
    return new Promise(function (resolve, reject) {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.top = '-1000px';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        var ok = document.execCommand && document.execCommand('copy');
        document.body.removeChild(ta);
        ok ? resolve() : reject(new Error('execCommand copy gagal'));
      } catch (e) { reject(e); }
    });
  }

  // ── Payload builder (exposed for tests) ────────────────────────────────

  function buildSemiPayload(row) {
    var requestId = safeStr(row && row.request_id);
    var driverLogin = safeStr(row && row.driver_login);
    var nominal = Number(row && row.nominal);
    if (!requestId) throw new Error('request_id kosong');
    if (!driverLogin) throw new Error('driver_login kosong');
    if (!Number.isFinite(nominal) || nominal <= 0) throw new Error('nominal tidak valid');
    if (!/^[0-9]+$/.test(driverLogin)) throw new Error('driver_login harus digit-only');
    var payload = {
      version: 2,
      request_id: requestId,
      driver_login: driverLogin,
      nominal: nominal,
      prepared_at: new Date().toISOString(),
      source: SOURCE_TAG,
    };
    if (row.driver_name) payload.driver_name = safeStr(row.driver_name);
    if (row.branch_name) payload.branch_name = safeStr(row.branch_name);
    if (row.staff_name) payload.staff_name = safeStr(row.staff_name);
    return payload;
  }

  function encodePayload(payload) {
    return CLIPBOARD_PREFIX + b64encode(JSON.stringify(payload));
  }

  // Extract row data from the manual-mark button's data-* attributes
  // (already emitted by loadSaldoRaos in modules/finance/index.html).
  function readRowFromButton(manualButton) {
    var tr = manualButton.closest('tr');
    // Item 1 (2026-08-26): payload nominal MUST come from RAW saldo request
    // (data-saldo-nominal), not the invoice-rounded value displayed in the
    // Finance table (data-nominal). See modules/finance/index.html
    // loadSaldoRaos row template + shared/finance-data-router.saldoList.
    // Fallback ke data-nominal hanya untuk kompat lama seandainya tombol
    // ter-render sebelum patch attribute; contract test menegakkan RAW.
    var rawNominal = manualButton.dataset.saldoNominal;
    if (rawNominal == null || rawNominal === '') rawNominal = manualButton.dataset.nominal;
    return {
      request_id: manualButton.dataset.markSaldo || '',
      driver_login: safeStr(manualButton.dataset.driverLogin).replace(/^-$/, ''),
      driver_name: safeStr(manualButton.dataset.driverName).replace(/^-$/, ''),
      nominal: parseNominal(rawNominal),
      branch_name: tr && tr.cells[1] ? safeStr(tr.cells[1].textContent) : '',
      staff_name: tr && tr.cells[2] ? safeStr(tr.cells[2].textContent.split('\n')[0]) : '',
      request_no: manualButton.dataset.requestNo || '',
    };
  }

  // ── UI construction ────────────────────────────────────────────────────

  function mkBtn(label, title) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn small';
    b.style.marginRight = '4px';
    b.textContent = label;
    b.title = title || '';
    return b;
  }

  function onCopyLogin(row) {
    return function () {
      if (!row.driver_login) { toast('❌ Login driver kosong', 'err'); return; }
      writeClipboard(row.driver_login).then(function () {
        toast('ID Driver disalin: ' + row.driver_login, 'ok');
      }).catch(function (e) {
        toast('❌ Gagal menyalin: ' + e.message, 'err');
      });
    };
  }

  function onCopyNominal(row) {
    return function () {
      if (!(row.nominal > 0)) { toast('❌ Nominal invalid', 'err'); return; }
      writeClipboard(String(row.nominal)).then(function () {
        toast('Nominal disalin: ' + row.nominal, 'ok');
      }).catch(function (e) {
        toast('❌ Gagal menyalin: ' + e.message, 'err');
      });
    };
  }

  function onFillAist(row) {
    return function () {
      var payload;
      try { payload = buildSemiPayload(row); }
      catch (e) { toast('❌ ' + e.message, 'err'); return; }
      var encoded = encodePayload(payload);
      writeClipboard(encoded).then(function () {
        var lines = [
          'Data AIST sudah disiapkan.',
          '',
          'Login: ' + payload.driver_login,
          'Nominal: Rp' + payload.nominal.toLocaleString('id-ID'),
          '',
          'Sekarang buka form Balance replenishment di AIST,',
          'lalu klik bookmark "Fill AIST Saldo".',
          '',
          'Transaksi BELUM dianggap Lunas.'
        ].join('\n');
        // Prefer alert (blocking) so operator confirms sebelum switch tab.
        if (typeof global.alert === 'function') global.alert(lines);
        else toast('Payload AIST disalin ke clipboard', 'ok');
      }).catch(function (e) {
        toast('❌ Clipboard ditolak browser: ' + e.message + '. Gunakan Copy Login + Copy Nominal.', 'err');
      });
    };
  }

  function decorate() {
    var buttons = document.querySelectorAll('button[data-mark-saldo]');
    Array.prototype.forEach.call(buttons, function (manualButton) {
      if (decorated.has(manualButton)) return;
      var cell = manualButton.parentElement;
      if (!cell) return;
      decorated.add(manualButton);

      var row = readRowFromButton(manualButton);
      var hasLogin = !!row.driver_login;
      var hasNominal = row.nominal > 0;

      var copyLogin = mkBtn('📋 Login', 'Salin ID Driver ke clipboard');
      copyLogin.disabled = !hasLogin;
      copyLogin.addEventListener('click', onCopyLogin(row));

      var copyNominal = mkBtn('📋 Nominal', 'Salin nominal RAW ke clipboard');
      copyNominal.disabled = !hasNominal;
      copyNominal.addEventListener('click', onCopyNominal(row));

      var fillBtn = mkBtn('🪄 Fill AIST', 'Siapkan payload AIST via clipboard');
      fillBtn.className = 'btn info small';
      fillBtn.style.marginRight = '6px';
      fillBtn.disabled = !(hasLogin && hasNominal);
      fillBtn.addEventListener('click', onFillAist(row));

      // Sisipkan sebelum tombol manual "Konfirmasi AIST Berhasil" agar urutan:
      // [Auto-Fill (agent)] [Copy Login] [Copy Nominal] [Fill AIST] [Konfirmasi manual].
      cell.insertBefore(fillBtn, manualButton);
      cell.insertBefore(copyNominal, fillBtn);
      cell.insertBefore(copyLogin, copyNominal);
    });
  }

  function start() {
    decorate();
    new MutationObserver(decorate).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }

  // Test hook (tidak digunakan di runtime browser normal).
  global.__AIST_FINANCE_SEMI__ = {
    buildSemiPayload: buildSemiPayload,
    encodePayload: encodePayload,
    parseNominal: parseNominal,
    readRowFromButton: readRowFromButton,
    CLIPBOARD_PREFIX: CLIPBOARD_PREFIX,
    SOURCE_TAG: SOURCE_TAG,
  };
})(typeof window !== 'undefined' ? window : globalThis);
