var CACHE_NAME = 'rifim-monitor-saldo-v1';
var SKIP_CACHE = ['script.google.com'];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(c) {
      return c.addAll(['/', '/index.html', '/manifest.json', '/icon-512.png']);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k) { return k !== CACHE_NAME; }).map(function(k) { return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(e) {
  var url = e.request.url;
  if (SKIP_CACHE.some(function(p) { return url.indexOf(p) > -1; })) return;
  e.respondWith(
    fetch(e.request).then(function(r) {
      var clone = r.clone();
      caches.open(CACHE_NAME).then(function(c) { c.put(e.request, clone); });
      return r;
    }).catch(function() { return caches.match(e.request); })
  );
});
