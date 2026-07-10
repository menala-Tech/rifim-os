// RIFIM OS — Service Worker v1
// Cache First: assets | Network First: GAS API calls

const CACHE_NAME = 'rifim-os-v1';

const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html',
  '/engines/connectivity-engine.js',
];

// ── Install: cache app shell ──────────────────────────────────
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: clean old caches ───────────────────────────────
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch: routing strategy ───────────────────────────────────
self.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;

  // GAS API — Network First with JSON offline fallback
  if (url.hostname.includes('script.google.com')) {
    e.respondWith(networkFirst(request, true));
    return;
  }

  // Same-origin assets — Cache First
  if (url.origin === self.location.origin) {
    e.respondWith(cacheFirst(request));
  }
});

// ── Network First ─────────────────────────────────────────────
async function networkFirst(request, isApi = false) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(timer);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (isApi) {
      return new Response(JSON.stringify({ error: 'offline', queued: true, message: 'Tidak ada koneksi' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return caches.match('/offline.html');
  }
}

// ── Cache First ───────────────────────────────────────────────
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return caches.match('/offline.html')
      || new Response('RIFIM OS — Offline', { status: 503 });
  }
}
