(function(global){
  'use strict';
  if (!global || typeof global.fetch !== 'function' || global.__rifimGasFetchProxyInstalled) return;
  global.__rifimGasFetchProxyInstalled = true;

  var nativeFetch = global.fetch.bind(global);
  var allowedIds = new Set([
    'AKfycbzzK75gxawaylaUZpoC1zp_hq5ktznlN7scIl24HkdEgR2l3cVmpUSLck0potcMZZtw',
    // Legacy RAOS deployment is intentionally kept recognized only so old pages
    // fail deterministically. System V3 no longer invokes it for canonical syncs.
    'AKfycbxrgQ_MWvsdA_bsbNF4deIALWATDCspYvY47fakpuXMZeAtGAd4baeVVe1dPGDAi1tZJA'
  ]);

  function sourceUrl(input) {
    try { return typeof input === 'string' ? input : (input && input.url) || String(input || ''); }
    catch (_) { return ''; }
  }

  function deploymentId(url) {
    var m = String(url || '').match(/^https:\/\/script\.google\.com\/macros\/s\/([^/]+)\/exec(?:\?.*)?$/i);
    return m ? m[1] : '';
  }

  function proxiedUrl(input) {
    var url = sourceUrl(input);
    var id = deploymentId(url);
    if (!id || !allowedIds.has(id)) return '';
    return '/api/gas-proxy?url=' + encodeURIComponent(url);
  }

  function requestInit(input, init) {
    if (!(typeof Request !== 'undefined' && input instanceof Request) || init) return init || {};
    return {
      method: input.method,
      headers: input.headers,
      body: (input.method === 'GET' || input.method === 'HEAD') ? undefined : input.body,
      signal: input.signal,
      cache: input.cache,
      redirect: 'follow'
    };
  }

  function directInit(base) {
    var out = Object.assign({}, base || {});
    // Google Apps Script deployments that require the user's Google session
    // cannot be authenticated by a server-side Vercel fetch. A browser retry
    // may use the already logged-in Google session instead.
    out.credentials = 'include';
    out.redirect = 'follow';
    return out;
  }

  // 2026-08-18 fix: the browser-session fallback below existed already (for
  // GAS deployments that require the caller's own Google session, which a
  // server-side Vercel fetch can never have) but fired completely silently —
  // on any proxy failure it re-routed straight to script.google.com with no
  // trace in Vercel's logs, quietly reintroducing the direct browser->GAS
  // path P1.1 was written to eliminate. Behavior is unchanged; every
  // fallback is now console.warn'd and counted on RifimGasFetchProxy so a
  // real proxy outage is visible instead of invisible.
  var fallbackCount = 0;
  function logFallback(reason, url, detail) {
    fallbackCount++;
    try {
      console.warn('[RifimGasFetchProxy] falling back to direct browser->GAS fetch (' + reason + '):', url, detail || '');
    } catch (_) {}
  }

  global.fetch = async function(input, init) {
    var p = proxiedUrl(input);
    if (!p) return nativeFetch(input, init);

    var originalUrl = sourceUrl(input);
    var normalizedInit = requestInit(input, init);
    var proxyResponse;

    try {
      proxyResponse = await nativeFetch(p, normalizedInit);
    } catch (proxyErr) {
      // Network failure on the same-origin proxy: try the canonical browser path.
      logFallback('proxy network error', originalUrl, proxyErr && proxyErr.message);
      try { return await nativeFetch(originalUrl, directInit(normalizedInit)); }
      catch (_) { throw proxyErr; }
    }

    // 401/403 means Google rejected the server-side proxy identity; 404 is also
    // used by stale/private Apps Script deployments. Retry once from the browser
    // so the user's Google session can be used. If CORS blocks that retry, keep
    // the original proxy response so the caller receives the real status.
    if ([401, 403, 404].includes(proxyResponse.status)) {
      logFallback('proxy status ' + proxyResponse.status, originalUrl);
      try {
        var directResponse = await nativeFetch(originalUrl, directInit(normalizedInit));
        if (directResponse && ![401, 403, 404].includes(directResponse.status)) return directResponse;
      } catch (_) {}
    }

    return proxyResponse;
  };

  global.RifimGasFetchProxy = {
    version: '2.1.0-browser-auth-fallback-logged',
    allowedIds: Array.from(allowedIds),
    get fallbackCount() { return fallbackCount; }
  };
})(window);
