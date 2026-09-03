/**
 * shared/session-fetch.js — Session-aware fetch wrapper + expired banner
 *
 * Problem yang di-fix (2026-09-03):
 * Beberapa modul (finance/hris/crm) panggil `fetch(SB_URL + ...)` langsung ke
 * Supabase REST tanpa lewat portal-session.js. Ketika access_token expired
 * (~1 jam idle), Supabase balas 401. Modul silently swallow error → cache-first
 * render tetap tampil, dropdown kosong tanpa peringatan. Owner tidak tahu
 * sesi mati sampai coba mutation dan gagal.
 *
 * Solusi Phase 1:
 * 1. Auto-patch window.fetch: kalau URL mengarah ke Supabase host, refresh
 *    session via RifimPortalSession pada 401 dan retry sekali.
 * 2. Kalau retry masih 401 (refresh_token juga mati), pasang sticky banner
 *    di top page dengan tombol "Login Ulang".
 * 3. `RifimSessionFetch.fetch()` public API untuk modul yang mau opt-in secara
 *    eksplisit (bypass monkey-patch, misalnya untuk endpoint non-Supabase).
 *
 * Depends on: shared/portal-session.js (dimuat oleh fixed-module-shell.js).
 * Idempoten: aman di-load berkali-kali (guard `__rifimSessionFetchInstalled`).
 */
(function (global) {
  'use strict'

  if (global.__rifimSessionFetchInstalled) return
  global.__rifimSessionFetchInstalled = true

  var SUPABASE_HOSTS = new Set([
    'vlievtojpmrbsmzlqswl.supabase.co',
    'cdlkujllqnrurgecoaur.supabase.co',
  ])

  var BANNER_ID = 'rifim-session-banner'
  var bannerShown = false

  function urlHost(input) {
    try {
      var s = typeof input === 'string' ? input : (input && input.url) || ''
      if (!s) return ''
      // Absolute URL
      if (/^https?:\/\//i.test(s)) return new URL(s).hostname.toLowerCase()
      return ''
    } catch (_) { return '' }
  }

  function isSupabaseUrl(input) {
    return SUPABASE_HOSTS.has(urlHost(input))
  }

  function isAuthEndpoint(input) {
    var s = typeof input === 'string' ? input : (input && input.url) || ''
    return /\/auth\/v1\//.test(s)
  }

  function showBanner() {
    if (bannerShown) return
    bannerShown = true
    try {
      var existing = document.getElementById(BANNER_ID)
      if (existing) existing.remove()
      var el = document.createElement('div')
      el.id = BANNER_ID
      el.setAttribute('role', 'alert')
      el.style.cssText = [
        'position:fixed', 'top:0', 'left:0', 'right:0',
        'z-index:99999',
        'background:#b91c1c', 'color:#fff',
        'padding:10px 16px',
        'font:600 14px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
        'display:flex', 'align-items:center', 'justify-content:center',
        'gap:12px',
        'box-shadow:0 2px 8px rgba(0,0,0,.25)',
      ].join(';')
      el.innerHTML =
        '<span>⚠️ Sesi Anda telah berakhir. Data yang tampil mungkin tidak terbaru.</span>' +
        '<button id="rifim-session-banner-btn" style="' +
        'background:#fff;color:#b91c1c;border:0;padding:6px 14px;border-radius:6px;' +
        'font:600 13px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;' +
        'cursor:pointer">Login Ulang</button>'
      document.body.appendChild(el)
      var btn = document.getElementById('rifim-session-banner-btn')
      if (btn) btn.onclick = function () {
        try { global.RifimPortalSession && global.RifimPortalSession.clear && global.RifimPortalSession.clear() } catch (_) {}
        global.location.href = '/portal'
      }
    } catch (e) {
      // Fallback: kalau body belum ada, retry sekali setelah DOM ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
          bannerShown = false; showBanner()
        }, { once: true })
      }
    }
  }

  function hideBanner() {
    bannerShown = false
    var el = document.getElementById(BANNER_ID)
    if (el) el.remove()
  }

  // Injects Authorization header dari session terkini (setelah refresh).
  // Hanya patch kalau caller tidak set Authorization sendiri ATAU pakai Bearer.
  function patchAuthHeader(init) {
    var session = null
    try { session = global.RifimPortalSession && global.RifimPortalSession.read() } catch (_) {}
    if (!session || !session.access_token) return init
    var out = init ? Object.assign({}, init) : {}
    var hdrs = new Headers(out.headers || {})
    var existing = hdrs.get('Authorization')
    if (existing && !/^Bearer\s+/i.test(existing)) return init
    hdrs.set('Authorization', 'Bearer ' + session.access_token)
    out.headers = hdrs
    return out
  }

  var nativeFetch = global.fetch.bind(global)

  async function sessionAwareFetch(input, init) {
    // Non-Supabase URL → passthrough, no touching.
    if (!isSupabaseUrl(input)) return nativeFetch(input, init)

    // Auth endpoint itself (login/refresh/logout) → passthrough, jangan
    // rekursif inject header atau refresh; portal-session yang urus.
    if (isAuthEndpoint(input)) return nativeFetch(input, init)

    // Pre-flight: pastikan session masih hidup. validate() akan refresh
    // otomatis kalau token near-expiry.
    if (global.RifimPortalSession && typeof global.RifimPortalSession.validate === 'function') {
      try { await global.RifimPortalSession.validate() } catch (_) { /* non-fatal */ }
    }

    var patched = patchAuthHeader(init)
    var res = await nativeFetch(input, patched)

    // Recovery: 401 pertama = coba refresh + retry sekali.
    if (res.status !== 401) {
      // Sukses non-401: kalau banner masih nempel dari kegagalan sebelumnya,
      // biarkan (user harus manual login ulang). Jangan auto-hide.
      return res
    }

    if (!global.RifimPortalSession) { showBanner(); return res }

    try { global.RifimPortalSession.invalidate() } catch (_) {}
    var refreshed = null
    try { refreshed = await global.RifimPortalSession.validate() } catch (_) {}

    if (!refreshed || !refreshed.access_token) {
      // Refresh gagal / refresh_token invalid → terminal auth failure.
      showBanner()
      return res
    }

    // Retry sekali dengan token baru.
    var patched2 = patchAuthHeader(init)
    var res2 = await nativeFetch(input, patched2)
    if (res2.status === 401) showBanner()
    return res2
  }

  // Global monkey-patch: semua fetch ke Supabase host lewat wrapper.
  global.fetch = function (input, init) {
    try { return sessionAwareFetch(input, init) }
    catch (e) { return nativeFetch(input, init) }
  }

  global.RifimSessionFetch = {
    version: '1.0.0',
    fetch: sessionAwareFetch,
    showBanner: showBanner,
    hideBanner: hideBanner,
    isSupabaseUrl: isSupabaseUrl,
  }
})(window)
