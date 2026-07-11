/**
 * RIFIM Staff PWA — Service Worker
 * Cache shell app saja; data API selalu network (real-time).
 */
var CACHE_NAME = 'rifim-staff-v1';
var SHELL = ['./index.html', './manifest.json', './icon-512.png'];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(c) { return c.addAll(SHELL); })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.map(function(k) {
        if (k !== CACHE_NAME) return caches.delete(k);
      }));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(e) {
  // API GAS selalu network — jangan cache data transaksional
  if (e.request.url.indexOf('script.google.com') > -1) return;

  e.respondWith(
    caches.match(e.request).then(function(cached) {
      return cached || fetch(e.request);
    })
  );
});
