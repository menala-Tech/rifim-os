(function(global){
  'use strict';
  if (!global || typeof global.fetch !== 'function' || global.__rifimGasFetchProxyInstalled) return;
  global.__rifimGasFetchProxyInstalled = true;

  var nativeFetch = global.fetch.bind(global);
  var allowedIds = new Set([
    'AKfycbzzK75gxawaylaUZpoC1zp_hq5ktznlN7scIl24HkdEgR2l3cVmpUSLck0potcMZZtw',
    'AKfycbxrgQ_MWvsdA_bsbNF4deIALWATDCspYvY47fakpuXMZeAtGAd4baeVVe1dPGDAi1tZJA'
  ]);

  function proxiedUrl(input) {
    var url = '';
    try { url = typeof input === 'string' ? input : (input && input.url) || String(input || ''); }
    catch (_) { return ''; }
    var m = url.match(/^https:\/\/script\.google\.com\/macros\/s\/([^/]+)\/exec(?:\?.*)?$/i);
    if (!m || !allowedIds.has(m[1])) return '';
    return '/api/gas-proxy?url=' + encodeURIComponent(url);
  }

  global.fetch = function(input, init) {
    var p = proxiedUrl(input);
    if (!p) return nativeFetch(input, init);
    if (typeof Request !== 'undefined' && input instanceof Request && !init) {
      init = {
        method: input.method,
        headers: input.headers,
        body: (input.method === 'GET' || input.method === 'HEAD') ? undefined : input.body,
        signal: input.signal,
        credentials: 'same-origin',
        cache: input.cache,
        redirect: 'follow'
      };
    }
    return nativeFetch(p, init);
  };
})(window);
