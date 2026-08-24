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

  global.fetch = async function(input, init) {
    var p = proxiedUrl(input);
    if (!p) return nativeFetch(input, init);

    var normalizedInit = requestInit(input, init);

    try {
      return await nativeFetch(p, normalizedInit);
    } catch (proxyErr) {
      throw proxyErr;
    }
  };

  global.RifimGasFetchProxy = {
    version: '2.2.0-server-proxy-only',
    allowedIds: Array.from(allowedIds)
  };
})(window);
