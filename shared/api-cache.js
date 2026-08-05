/**
 * RIFIM OS - Shared API + Cache helper
 * ==========================================================================
 * Dipakai bareng oleh semua module Rifim-OS Portal (finance, hris, crm,
 * sistem, smart-office). Loaded via <script src="/shared/api-cache.js"></script>
 * di masing-masing <head>.
 *
 * Fitur:
 *   - RifimAPI.get(action, params)   -> GAS GET, auto-inject user email + retry HTML
 *   - RifimAPI.post(body)            -> GAS POST, auto-inject + retry HTML
 *   - RifimCache.get(key)            -> baca cache localStorage (TTL check)
 *   - RifimCache.set(key, data)      -> tulis cache
 *   - RifimCache.clear(key)          -> hapus 1 key
 *   - RifimCache.clearAll()          -> hapus semua cache (mis. saat logout)
 *   - RifimCache.cacheFirst(key, fetcher, opts)
 *       -> pattern: render cache dulu (instant), background refresh update
 *
 * Cara pakai di module (contoh):
 *   const res = await RifimAPI.get('finance_kpi_target_branch_list', { month });
 *   const rows = await RifimCache.cacheFirst('target_branch_' + month,
 *     () => RifimAPI.get('finance_kpi_target_branch_list', { month }),
 *     { ttl: 30 * 60 * 1000, onData: renderTable });
 *
 * TTL default per key type:
 *   - master data (staff, driver, cabang): 1 jam
 *   - transactional (attendance, saldo, order): 15-30 menit
 *   - config (sistem_config): 6 jam
 *   - Override via opts.ttl
 *
 * Terkait deploy: file ini static, tidak butuh build. Update = git push.
 * Jangan taruh secret di sini - source terlihat di browser.
 * ==========================================================================
 */
(function (global) {
  'use strict';

  // GAS Web App URL — kalau berubah, update di sini + di masing-masing module
  var GAS_URL = 'https://script.google.com/macros/s/AKfycbzzK75gxawaylaUZpoC1zp_hq5ktznlN7scIl24HkdEgR2l3cVmpUSLck0potcMZZtw/exec';

  // TTL default per key prefix (ms). Override per-call via opts.ttl.
  var DEFAULT_TTL = {
    staff:      60 * 60 * 1000,   // 1 jam
    employees:  30 * 60 * 1000,   // 30 menit
    branches:   60 * 60 * 1000,   // 1 jam
    drivers:    60 * 60 * 1000,   // 1 jam
    attendance: 60 * 60 * 1000,   // 1 jam (sesuai request user 2026-08-05)
    payroll:    30 * 60 * 1000,   // 30 menit
    saldo:      15 * 60 * 1000,   // 15 menit (transactional cepat berubah)
    target:     30 * 60 * 1000,   // 30 menit
    ledger:     15 * 60 * 1000,   // 15 menit
    tagihan:    15 * 60 * 1000,   // 15 menit
    sistem:     6  * 60 * 60000,  // 6 jam (config jarang berubah) — 6*60*60*1000 salah, fix di bawah
    log:        60 * 1000,        // 1 menit (real-time-ish)
    _default:   30 * 60 * 1000,   // 30 menit fallback
  };
  DEFAULT_TTL.sistem = 6 * 60 * 60 * 1000; // fix typo di object literal (JS parse OK, tapi jelas: 6 jam)

  function _getUserEmail() {
    try {
      var raw = localStorage.getItem('rifim_auth');
      if (!raw) return '';
      return (JSON.parse(raw).email || '').toString();
    } catch (e) { return ''; }
  }

  /**
   * Fetch JSON dengan retry kalau GAS return HTML (throttled).
   * Retry 1x default, delay 900ms.
   */
  async function _fetchJson(url, initOpts, retry) {
    if (retry == null) retry = 1;
    var lastMsg = '';
    for (var attempt = 0; attempt <= retry; attempt++) {
      try {
        var res = await fetch(url, initOpts);
        var txt = await res.text();
        // GAS throttled → return HTML "Halaman Tidak Ditemukan"
        if (txt.trim().startsWith('<')) {
          lastMsg = 'GAS backend throttled (HTML response)';
          if (attempt < retry) {
            await new Promise(function (r) { setTimeout(r, 900); });
            continue;
          }
          return { success: false, message: 'GAS backend sedang throttled. Coba lagi dalam 10 detik.' };
        }
        try { return JSON.parse(txt); }
        catch (e) { return { success: false, message: 'Response bukan JSON: ' + txt.substring(0, 100) }; }
      } catch (e) {
        lastMsg = e.message;
        if (attempt < retry) {
          await new Promise(function (r) { setTimeout(r, 900); });
          continue;
        }
        return { success: false, message: 'Koneksi gagal: ' + e.message };
      }
    }
    return { success: false, message: 'Gagal setelah retry: ' + lastMsg };
  }

  // ─── Public API ─────────────────────────────────────────────────────
  var RifimAPI = {
    get: async function (action, params) {
      var p = Object.assign({ action: action }, params || {});
      if (!p.user) p.user = _getUserEmail();
      var url = GAS_URL + '?' + new URLSearchParams(p).toString();
      return _fetchJson(url, undefined, 1);
    },

    // Post: body JSON. Content-Type text/plain untuk hindari CORS preflight.
    post: async function (body) {
      var b = Object.assign({}, body || {});
      if (!b.user && !b.performed_by) b.user = _getUserEmail();
      return _fetchJson(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(b),
      }, 1);
    },

    // Convenience: extract ttl dari cache prefix
    _pickTTL: function (key) {
      var prefix = String(key).split('_')[0].toLowerCase();
      return DEFAULT_TTL[prefix] || DEFAULT_TTL._default;
    },

    // Expose GAS_URL supaya module bisa override kalau butuh (jarang)
    _gasUrl: GAS_URL,
    _getUserEmail: _getUserEmail,
  };

  // ─── Cache helpers ─────────────────────────────────────────────────
  var CACHE_PREFIX = 'rifim_cache_';

  function _cachePut(key, data) {
    try {
      localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({
        at: Date.now(),
        data: data,
      }));
    } catch (e) { /* localStorage full — silent */ }
  }

  function _cacheRead(key, ttl) {
    try {
      var raw = localStorage.getItem(CACHE_PREFIX + key);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (!obj.at) return null;
      var effectiveTTL = ttl || RifimAPI._pickTTL(key);
      if ((Date.now() - obj.at) > effectiveTTL) return null;
      return obj.data;
    } catch (e) { return null; }
  }

  var RifimCache = {
    get: _cacheRead,
    set: _cachePut,
    clear: function (key) {
      try { localStorage.removeItem(CACHE_PREFIX + key); } catch (e) {}
    },
    clearAll: function () {
      try {
        var keys = [];
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i);
          if (k && k.indexOf(CACHE_PREFIX) === 0) keys.push(k);
        }
        keys.forEach(function (k) { localStorage.removeItem(k); });
        return keys.length;
      } catch (e) { return 0; }
    },

    /**
     * Cache-first pattern:
     *   1. Baca cache. Kalau ada + fresh (dalam TTL), fire onData(cached) langsung.
     *   2. Background fetch. Kalau berhasil + data berubah, fire onData(fresh).
     *   3. Return promise ke hasil terakhir (cached kalau fetch gagal).
     *
     * Params:
     *   key      - cache key unik (rekomendasi include filter/param di key)
     *   fetcher  - async function () => Promise<{success, data}>
     *   opts     - { ttl?: ms, onData?: function(data), forceRefresh?: boolean }
     *
     * fetcher HARUS return object dengan {success, ...} atau raw data.
     * Kalau res.success === false, cache tidak di-update.
     */
    cacheFirst: async function (key, fetcher, opts) {
      opts = opts || {};
      var onData = opts.onData || function () {};
      var ttl = opts.ttl;

      var cached = opts.forceRefresh ? null : _cacheRead(key, ttl);
      if (cached != null) {
        try { onData(cached, { fromCache: true }); } catch (e) { console.warn('[Cache] onData error:', e); }
        // Kick background refresh
        _backgroundRefresh(key, fetcher, cached, onData);
        return cached;
      }

      // Tidak ada cache: fetch fresh
      var fresh = await fetcher();
      if (fresh && (fresh.success == null || fresh.success === true)) {
        _cachePut(key, fresh);
        try { onData(fresh, { fromCache: false }); } catch (e) {}
      } else {
        // Error - kasih ke onData supaya bisa tampil di UI
        try { onData(fresh, { fromCache: false, error: true }); } catch (e) {}
      }
      return fresh;
    },
  };

  async function _backgroundRefresh(key, fetcher, prevData, onData) {
    var fresh = await fetcher();
    if (!fresh || fresh.success === false) {
      console.warn('[RifimCache] Background refresh gagal untuk key=' + key, fresh && fresh.message);
      return;
    }
    _cachePut(key, fresh);
    // Skip re-render kalau data tidak berubah (avoid flicker)
    try {
      var prevStr = JSON.stringify(prevData).substring(0, 500);
      var freshStr = JSON.stringify(fresh).substring(0, 500);
      if (prevStr === freshStr) return; // no diff
      onData(fresh, { fromCache: false, backgroundUpdate: true });
    } catch (e) {}
  }

  /**
   * Auto-refresh interval visibility-aware.
   * Fire cb setiap `intervalMs` kalau document.visibilityState === 'visible'
   * DAN tab dengan id yang match aktif (opsional).
   *
   * Usage:
   *   RifimCache.autoRefresh(60 * 60 * 1000, function() { loadAbsensi(true); },
   *                          { activeTabId: 'tab-absensi' });
   */
  RifimCache.autoRefresh = function (intervalMs, cb, opts) {
    opts = opts || {};
    return setInterval(function () {
      if (document.visibilityState !== 'visible') return;
      if (opts.activeTabId) {
        var el = document.getElementById(opts.activeTabId);
        if (!el || !el.classList.contains('active')) return;
      }
      try { cb(); } catch (e) { console.warn('[RifimCache] autoRefresh cb error:', e); }
    }, intervalMs);
  };

  // ─── Expose global ─────────────────────────────────────────────────
  global.RifimAPI = RifimAPI;
  global.RifimCache = RifimCache;

  // Tag versi untuk debug (F12 console: RifimAPI._version)
  RifimAPI._version = '1.0.0';
  RifimAPI._loadedAt = new Date().toISOString();
})(typeof window !== 'undefined' ? window : globalThis);
