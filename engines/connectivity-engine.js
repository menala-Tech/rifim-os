// Connectivity Engine — RIFIM OS
// Handles: network detection, offline queue (IndexedDB), retry with exponential backoff

const ConnectivityEngine = (() => {
  const DB_NAME    = 'rifim-offline-queue';
  const DB_VERSION = 1;
  const STORE_NAME = 'requests';
  const MAX_RETRIES   = 3;
  const RETRY_DELAYS  = [2000, 4000, 8000];

  let db       = null;
  let isOnline = navigator.onLine;
  const listeners = {};

  // ── IndexedDB ──────────────────────────────────────────────
  function initDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const store = e.target.result.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('status',    'status',    { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      };
      req.onsuccess = (e) => { db = e.target.result; resolve(db); };
      req.onerror   = () => reject(req.error);
    });
  }

  // ── Network Monitor ────────────────────────────────────────
  function setupNetworkMonitor() {
    window.addEventListener('online', () => {
      isOnline = true;
      emit('online');
      showBanner('online');
      syncQueue();
    });
    window.addEventListener('offline', () => {
      isOnline = false;
      emit('offline');
      showBanner('offline');
    });
  }

  // ── Status Banner ──────────────────────────────────────────
  function showBanner(status) {
    let el = document.getElementById('rifim-connectivity-banner');
    if (!el) {
      el = document.createElement('div');
      el.id = 'rifim-connectivity-banner';
      el.style.cssText = [
        'position:fixed;top:0;left:0;right:0;z-index:99999',
        'padding:10px 20px;text-align:center',
        'font-family:Arial,sans-serif;font-size:13px;font-weight:700',
        'transition:transform .3s ease;transform:translateY(-100%)',
        'box-shadow:0 2px 12px rgba(0,0,0,.2)'
      ].join(';');
      document.body.prepend(el);
    }
    if (status === 'offline') {
      el.style.background = '#C40000';
      el.style.color      = '#fff';
      el.textContent      = '⚠️ Koneksi terputus — Data disimpan, akan dikirim saat online';
      el.style.transform  = 'translateY(0)';
    } else {
      el.style.background = '#1a7a1a';
      el.style.color      = '#fff';
      el.textContent      = '✅ Koneksi kembali — Menyinkronkan data...';
      el.style.transform  = 'translateY(0)';
      setTimeout(() => { el.style.transform = 'translateY(-100%)'; }, 3000);
    }
  }

  // ── Event Emitter ──────────────────────────────────────────
  function on(event, cb) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(cb);
  }
  function emit(event, data) {
    (listeners[event] || []).forEach(cb => cb(data));
  }

  // ── Smart Fetch (auto-queue when offline) ──────────────────
  async function smartFetch(url, options = {}) {
    if (!isOnline) {
      await enqueue({ url, options });
      return { queued: true, message: 'Disimpan offline, akan dikirim saat online' };
    }
    return fetchWithRetry(url, options);
  }

  // ── Fetch with Retry ───────────────────────────────────────
  async function fetchWithRetry(url, options = {}, attempt = 0) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response;
    } catch (err) {
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAYS[attempt]);
        return fetchWithRetry(url, options, attempt + 1);
      }
      await enqueue({ url, options });
      throw err;
    }
  }

  // ── Offline Queue (IndexedDB) ──────────────────────────────
  async function enqueue(request) {
    if (!db) await initDB();
    return new Promise((resolve, reject) => {
      const tx    = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.add({ ...request, status: 'pending', createdAt: Date.now(), retries: 0 });
      tx.oncomplete = resolve;
      tx.onerror    = () => reject(tx.error);
    });
  }

  async function getPendingRequests() {
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).index('status').getAll('pending');
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
  }

  async function updateRecord(id, changes) {
    return new Promise((resolve, reject) => {
      const tx    = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const get   = store.get(id);
      get.onsuccess = () => { store.put({ ...get.result, ...changes }); };
      tx.oncomplete = resolve;
      tx.onerror    = () => reject(tx.error);
    });
  }

  // ── Sync Queue when back online ────────────────────────────
  async function syncQueue() {
    if (!db) await initDB();
    const pending = await getPendingRequests();
    if (pending.length === 0) return;

    emit('sync-start', { count: pending.length });
    let synced = 0;

    for (const req of pending) {
      try {
        await fetchWithRetry(req.url, req.options);
        await updateRecord(req.id, { status: 'done' });
        synced++;
        emit('sync-progress', { synced, total: pending.length });
      } catch (e) {
        const retries = (req.retries || 0) + 1;
        const status  = retries >= MAX_RETRIES ? 'failed' : 'pending';
        await updateRecord(req.id, { retries, status });
        emit('sync-failed', { req, error: e.message });
      }
    }
    emit('sync-done', { synced, total: pending.length });
  }

  // ── Service Worker Registration ────────────────────────────
  async function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      console.log('[RIFIM] Service Worker registered:', reg.scope);
    } catch (err) {
      console.warn('[RIFIM] Service Worker failed:', err.message);
    }
  }

  // ── Utils ──────────────────────────────────────────────────
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  function getStatus() {
    return { online: isOnline, timestamp: Date.now() };
  }

  // ── Init ───────────────────────────────────────────────────
  async function init() {
    await initDB();
    setupNetworkMonitor();
    await registerSW();
    if (isOnline) await syncQueue();
    console.log('[RIFIM] Connectivity Engine ready | online:', isOnline);
  }

  return { init, fetch: smartFetch, on, emit, getStatus, syncQueue };
})();
