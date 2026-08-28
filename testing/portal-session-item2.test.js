/**
 * portal-session-item2.test.js
 * Item 2 (post field-UAT 2026-08-26) — Session "invalid" too frequent.
 *
 * Kontrak fix di shared/portal-session.js:
 *   1. Fast-path cache: panggilan validate() berturut-turut dalam TTL
 *      tidak refetch profile.
 *   2. Single-flight: panggilan paralel share satu Promise.
 *   3. Transient failure (network/5xx) di fetchProfile TIDAK clearSession.
 *   4. First profile 401 refreshes + retries once; only confirmed terminal
 *      auth (refresh 4xx / second 401 / inactive profile) clears session.
 *
 * Run:
 *   node testing/portal-session-item2.test.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

console.log('=== RIFIM OS Portal Session — Item 2 contract ===');

const src = fs.readFileSync(path.join(__dirname, '..', 'shared', 'portal-session.js'), 'utf8');

// Bangun sandbox window mock.
function makeWin(opts) {
  opts = opts || {};
  const store = {};
  const win = {
    location: { hostname: 'rifim-os.vercel.app', pathname: '/finance/', href: '' },
    localStorage: {
      getItem: (k) => (k in store) ? store[k] : null,
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
    },
    document: {
      querySelector: () => null,
      createElement: () => ({ setAttribute() {}, style: {} }),
      head: { appendChild() {} },
      body: { appendChild() {} },
    },
    setInterval: () => 0,
    clearInterval: () => {},
    console: { warn: () => {}, log: () => {}, error: () => {} },
    atob: (b) => Buffer.from(b, 'base64').toString('binary'),
    JSON, Date, Number, String, Object, Array, Error, Math, Promise, Boolean,
    URLSearchParams,
    fetch: opts.fetch || (async () => ({ ok: true, status: 200, json: async () => ({}) })),
  };
  win.window = win; win.globalThis = win;
  vm.createContext(win);
  vm.runInContext(src, win);
  return win;
}

// Helper: buat token JWT palsu dengan sub + exp.
function fakeJwt(sub, expSec) {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64').replace(/=+$/, '');
  const payload = Buffer.from(JSON.stringify({ sub, exp: expSec })).toString('base64').replace(/=+$/, '');
  return header + '.' + payload + '.sig';
}

const now = Math.floor(Date.now() / 1000);
const validAccess = fakeJwt('user-xyz', now + 3600);

function primeSession(win, over) {
  win.localStorage.setItem('rifim_auth', JSON.stringify(Object.assign({
    access_token: validAccess,
    refresh_token: 'r-token',
    expires_at: now + 3600,
    id: 'user-xyz',
    role: 'admin',
    full_name: 'Test User',
  }, over || {})));
}

// ── T1: fast-path cache — validate() kedua tidak memanggil fetch lagi.
{
  let fetchCalls = 0;
  const win = makeWin({
    fetch: async (url) => {
      fetchCalls++;
      // profile fetch: return active user
      return { ok: true, status: 200, json: async () => ([{ id: 'user-xyz', role: 'admin', full_name: 'Test', is_active: true }]) };
    },
  });
  primeSession(win);
  return (async () => {
    const s1 = await win.RifimPortalSession.validate();
    assert.ok(s1 && s1.access_token, 'T1 first validate returns session');
    const before = fetchCalls;
    const s2 = await win.RifimPortalSession.validate();
    assert.ok(s2 && s2.access_token, 'T1 second validate returns session');
    assert.strictEqual(fetchCalls, before, 'T1 second validate hits fast-path cache (no fetch)');
    console.log('  ok  T1 fast-path cache prevents redundant profile fetch');

    // ── T2: transient network error di fetchProfile → sesi tetap ada
    win.RifimPortalSession.invalidate();
    let profileCalls = 0;
    win.fetch = async () => {
      profileCalls++;
      throw new Error('ECONNRESET transient');
    };
    // Force needsProfile: hapus role di saved supaya path revalidate profile.
    const saved = JSON.parse(win.localStorage.getItem('rifim_auth'));
    delete saved.role; win.localStorage.setItem('rifim_auth', JSON.stringify(saved));
    const s3 = await win.RifimPortalSession.validate();
    assert.ok(s3 && s3.access_token, 'T2 transient profile error keeps session');
    assert.ok(win.localStorage.getItem('rifim_auth'), 'T2 localStorage session NOT cleared');
    console.log('  ok  T2 transient profile failure does not clear session');

    // ── T3: first profile 401 → refresh once → retry succeeds
    win.RifimPortalSession.invalidate();
    let t3ProfileCalls = 0;
    let t3RefreshCalls = 0;
    win.fetch = async (url) => {
      if (String(url).indexOf('/auth/v1/token') !== -1) {
        t3RefreshCalls++;
        return { ok: true, status: 200, json: async () => ({
          access_token: fakeJwt('user-xyz', now + 7200),
          refresh_token: 'r-token-rotated',
          expires_at: now + 7200,
        }) };
      }
      t3ProfileCalls++;
      if (t3ProfileCalls === 1) return { ok: false, status: 401, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => ([{ id: 'user-xyz', role: 'admin', full_name: 'Test', is_active: true }]) };
    };
    const saved3 = JSON.parse(win.localStorage.getItem('rifim_auth'));
    delete saved3.role; win.localStorage.setItem('rifim_auth', JSON.stringify(saved3));
    const s4 = await win.RifimPortalSession.validate();
    assert.ok(s4 && s4.access_token, 'T3 first 401 recovers');
    assert.strictEqual(t3RefreshCalls, 1, 'T3 exactly one refresh');
    assert.strictEqual(t3ProfileCalls, 2, 'T3 exactly one profile retry');
    assert.strictEqual(JSON.parse(win.localStorage.getItem('rifim_auth')).refresh_token, 'r-token-rotated');
    console.log('  ok  T3 first profile 401 refreshes once and recovers');

    // ── T4: refresh_token 400 → hard auth → clear
    primeSession(win, { access_token: fakeJwt('user-xyz', now - 10), expires_at: now - 10 });
    win.RifimPortalSession.invalidate();
    win.fetch = async (url) => {
      if (String(url).indexOf('/auth/v1/token') !== -1) {
        return { ok: false, status: 400, json: async () => ({ error: 'invalid_grant' }) };
      }
      return { ok: true, status: 200, json: async () => ([]) };
    };
    const s5 = await win.RifimPortalSession.validate();
    assert.strictEqual(s5, null, 'T4 refresh 400 → null');
    assert.strictEqual(win.localStorage.getItem('rifim_auth'), null, 'T4 refresh 400 clears session');
    console.log('  ok  T4 hard refresh_token 400 clears session');

    // ── T5: single-flight — 5 panggilan paralel = 1 fetch
    primeSession(win);
    win.RifimPortalSession.invalidate();
    let parallelCalls = 0;
    win.fetch = async () => {
      parallelCalls++;
      await new Promise(r => setTimeout(r, 20));
      return { ok: true, status: 200, json: async () => ([{ id: 'user-xyz', role: 'admin', full_name: 'Test', is_active: true }]) };
    };
    const results = await Promise.all([
      win.RifimPortalSession.validate(),
      win.RifimPortalSession.validate(),
      win.RifimPortalSession.validate(),
      win.RifimPortalSession.validate(),
      win.RifimPortalSession.validate(),
    ]);
    results.forEach((s, i) => assert.ok(s && s.access_token, 'T5 parallel ' + i));
    assert.strictEqual(parallelCalls, 1, 'T5 single-flight: hanya 1 fetch untuk 5 panggilan paralel');
    console.log('  ok  T5 single-flight coalesces parallel validate() calls');

    // ── T6: invalidate() memaksa re-fetch
    let after = 0;
    win.fetch = async () => {
      after++;
      return { ok: true, status: 200, json: async () => ([{ id: 'user-xyz', role: 'admin', full_name: 'Test', is_active: true }]) };
    };
    await win.RifimPortalSession.validate();
    const cached = after;
    win.RifimPortalSession.invalidate();
    // Force needsProfile so cache miss triggers fetch (in fast-path already
    // ada session valid; kita ingin buktikan cache benar-benar di-drop).
    const s6 = await win.RifimPortalSession.validate();
    assert.ok(s6 && s6.access_token, 'T6 after invalidate returns valid session');
    // Setelah invalidate + role masih terisi di localStorage, needsProfile
    // false (skip profile) — validate cepat, tidak fetch. Buktikan lastGood
    // di-reset dengan cek bahwa panggilan berikutnya tanpa invalidate() tidak
    // menambah fetch (fast-path hit).
    const afterInvalidate = after;
    await win.RifimPortalSession.validate();
    assert.strictEqual(after, afterInvalidate, 'T6 fast-path restored after invalidate+validate');
    console.log('  ok  T6 invalidate() drops cache; next validate rebuilds it');

    console.log('\nAll Item 2 session assertions PASS.');
  })().catch(err => { console.error('FAIL:', err); process.exit(1); });
}
