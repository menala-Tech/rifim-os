/**
 * Finance Isi Saldo — cache-first / stale-while-revalidate
 * LOCAL STAGING ONLY — NO COMMIT / NO PUSH / NO DEPLOY.
 *
 * Tujuan:
 * - Saat tab Isi Saldo dibuka, tampilkan data terakhir dari localStorage seketika.
 * - Jangan kosongkan tabel dengan "Loading Supabase…" bila cache tersedia.
 * - Fetch data terbaru tetap berjalan di background.
 * - Filter status/cabang/search tetap menggunakan data fresh/cached yang sama.
 * - Realtime notifier existing tetap source untuk pengajuan baru.
 *
 * Integrasi minimal:
 * 1) load sebelum inline Finance script atau sesudah api-cache.js.
 * 2) ganti body loadSaldoRaos() menjadi:
 *      return FinanceSaldoCacheFirst.load({
 *        fetcher: () => _gasCall('finance_saldo_raos_list', {...}),
 *        render: renderSaldoRaosRows,
 *        status: ...,
 *        branch: ...,
 *        search: ...,
 *        tbody: document.getElementById('sr-body')
 *      })
 *
 * Adapter ini tidak melakukan mark-paid dan tidak mengubah data.
 */
(function (global) {
  'use strict';

  var PREFIX = 'rifim_finance_saldo_raos_v2:';
  var TTL = 15 * 60 * 1000;       // cache dianggap fresh 15 menit
  var MAX_STALE = 24 * 60 * 60 * 1000; // masih boleh tampil maksimal 24 jam sambil refresh

  function key(params) {
    params = params || {};
    return PREFIX + JSON.stringify({
      status: params.status || '',
      branch: params.branch || '',
    });
  }

  function read(params) {
    try {
      var raw = localStorage.getItem(key(params));
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.at || !parsed.payload) return null;
      var age = Date.now() - parsed.at;
      if (age > MAX_STALE) return null;
      return {
        payload: parsed.payload,
        at: parsed.at,
        age: age,
        fresh: age <= TTL,
      };
    } catch (_) {
      return null;
    }
  }

  function write(params, payload) {
    try {
      localStorage.setItem(key(params), JSON.stringify({
        at: Date.now(),
        payload: payload,
      }));
    } catch (_) {}
  }

  function clear() {
    try {
      var keys = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf(PREFIX) === 0) keys.push(k);
      }
      keys.forEach(function (k) { localStorage.removeItem(k); });
    } catch (_) {}
  }

  function showSoftState(tbody, text) {
    if (!tbody) return;
    var row = tbody.querySelector('[data-finance-saldo-soft-state]');
    if (!row) {
      row = document.createElement('tr');
      row.setAttribute('data-finance-saldo-soft-state', '1');
      row.innerHTML = '<td colspan="8" style="padding:7px 11px;font-size:10px;opacity:.55"></td>';
      tbody.insertBefore(row, tbody.firstChild);
    }
    row.firstElementChild.textContent = text;
  }

  function hideSoftState(tbody) {
    if (!tbody) return;
    var row = tbody.querySelector('[data-finance-saldo-soft-state]');
    if (row) row.remove();
  }

  /**
   * @param {{
   *   fetcher: function(): Promise<any>,
   *   render: function(any, {fromCache:boolean, background:boolean}): void,
   *   status?: string,
   *   branch?: string,
   *   tbody?: HTMLElement
   * }} opts
   */
  async function load(opts) {
    opts = opts || {};
    if (typeof opts.fetcher !== 'function') throw new Error('FinanceSaldoCacheFirst.fetcher wajib');
    if (typeof opts.render !== 'function') throw new Error('FinanceSaldoCacheFirst.render wajib');

    var params = { status: opts.status || '', branch: opts.branch || '' };
    var cached = read(params);

    if (cached) {
      opts.render(cached.payload, { fromCache: true, background: false });
      showSoftState(
        opts.tbody,
        cached.fresh ? 'Data tersimpan • memperbarui di background…'
                     : 'Menampilkan data terakhir • sinkronisasi terbaru berjalan…'
      );
    } else if (opts.tbody && !opts.tbody.children.length) {
      showSoftState(opts.tbody, 'Mengambil data pertama kali…');
    }

    try {
      var fresh = await opts.fetcher();
      if (!fresh || fresh.success === false) {
        throw new Error((fresh && fresh.message) || 'Gagal mengambil data terbaru');
      }
      write(params, fresh);
      hideSoftState(opts.tbody);
      opts.render(fresh, { fromCache: false, background: !!cached });
      return fresh;
    } catch (err) {
      if (cached) {
        showSoftState(opts.tbody, 'Offline/koneksi lambat • menampilkan data terakhir');
        console.warn('[FinanceSaldoCacheFirst] refresh gagal; cache dipertahankan', err);
        return cached.payload;
      }
      hideSoftState(opts.tbody);
      throw err;
    }
  }

  /**
   * Setelah mark-paid sukses, invalidasi cache supaya refresh berikutnya fresh.
   * UI caller sebaiknya tetap melakukan optimistic row update agar instant.
   */
  function invalidateAfterMutation() {
    clear();
  }

  global.FinanceSaldoCacheFirst = {
    load: load,
    read: read,
    write: write,
    clear: clear,
    invalidateAfterMutation: invalidateAfterMutation,
    version: 'staging-1.0.0',
  };
})(window);
