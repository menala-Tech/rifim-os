/**
 * Shared GAS transport for legacy CRM / config actions.
 *
 * Root cause hotfix 2026-08-29 (R5):
 *   modules/crm/index.html called _gasCall(...) 8 times but no CRM script ever
 *   defined it — Finance had a private inline copy; CRM had nothing → real
 *   Production ReferenceError on Audit Log and User Supabase RAOS. Fix is to
 *   provide ONE canonical transport that any module can include.
 *
 * Contract (backward-compatible with Finance's private _gasCall):
 *   _gasCall(action, extra) -> Promise<{ success, ... }>
 *   - Goes through window.RifimAPI when available (canonical proxy path,
 *     same-origin, auth cookie/header handled server-side).
 *   - Falls back to direct GAS GET (query-string) only if RifimAPI is absent
 *     AND the action is a read (no known write suffix). Writes fail closed —
 *     they must go via same-origin canonical route.
 *   - Never throws ReferenceError; always returns a value with success:false
 *     when the transport itself is missing.
 *
 * Do NOT redefine _gasCall inside module HTML anymore. If a module needs a
 * specialized wrapper (e.g. Finance mutation guard), wrap this one instead of
 * shadowing it.
 */
(function (global) {
  'use strict';
  if (typeof global._gasCall === 'function') return; // Respect a page-local override that loaded earlier.

  var GAS_URL_DEFAULT = 'https://script.google.com/macros/s/AKfycbzzK75gxawaylaUZpoC1zp_hq5ktznlN7scIl24HkdEgR2l3cVmpUSLck0potcMZZtw/exec';
  var PREVIEW_GAS_UNAVAILABLE = { success: false, code: 'PREVIEW_GAS_UNAVAILABLE', preview_notice: true, message: 'Fitur GAS tidak tersedia di Preview QA' };
  function _isPreview() {
    var host = String(global.location && global.location.hostname || '');
    if (window.RifimPortalSession && typeof window.RifimPortalSession.config === 'object' && window.RifimPortalSession.config.isPreview != null) {
      return !!window.RifimPortalSession.config.isPreview;
    }
    return /\.vercel\.app$/i.test(host) && host !== 'rifim-os.vercel.app';
  }
  function currentUserEmail() {
    try { return (JSON.parse(global.localStorage.getItem('rifim_auth') || '{}').email || ''); }
    catch (_) { return ''; }
  }
  function isMutationAction(action) {
    return /(?:_set$|_add$|_update$|_delete$|_upsert$|_remove$|_mark_paid$|_compute$|_assign_random$)/.test(String(action || ''));
  }

  global._gasCall = async function _gasCall(action, extra) {
    if (_isPreview()) return PREVIEW_GAS_UNAVAILABLE;
    var params = Object.assign({ action: action, user: currentUserEmail() }, extra || {});
    // Preferred path — canonical same-origin transport.
    if (global.RifimAPI) {
      try {
        // Writes go POST via RifimAPI.post so access_token / role guard runs server-side.
        if (isMutationAction(action) && typeof global.RifimAPI.post === 'function') {
          return await global.RifimAPI.post(params);
        }
        if (typeof global.RifimAPI.get === 'function') {
          return await global.RifimAPI.get(action, params);
        }
      } catch (err) {
        return { success: false, message: (err && err.message) || String(err) };
      }
    }
    // Fallback (RifimAPI not loaded) — reads only, best-effort, browser -> GAS direct.
    if (isMutationAction(action)) {
      return { success: false, message: 'Transport GAS kanonik tidak tersedia. Muat ulang halaman.' };
    }
    try {
      var qs = new URLSearchParams();
      Object.keys(params).forEach(function (k) {
        if (params[k] != null) qs.set(k, String(params[k]));
      });
      var res = await fetch(GAS_URL_DEFAULT + '?' + qs.toString(), { cache: 'no-store' });
      return await res.json();
    } catch (err) {
      return { success: false, message: (err && err.message) || String(err) };
    }
  };
})(window);
