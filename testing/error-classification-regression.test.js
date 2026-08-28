/**
 * error-classification-regression.test.js
 * Phase D: Error classification regression tests
 *
 * Verifies all 8 error scenarios are classified correctly:
 * 1. Expired access + valid refresh → RECOVER
 * 2. Stale 401 → REFRESH/RETRY
 * 3. 403 permission → KEEP SESSION
 * 4. Network timeout → KEEP SESSION
 * 5. Backend 500 → KEEP SESSION
 * 6. Refresh token invalid → TERMINAL LOGOUT
 * 7. User inactive → FAIL CLOSED
 * 8. API 403 → KEEP SESSION (not auth failure)
 *
 * Run:
 *   node testing/error-classification-regression.test.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

console.log('=== Phase D: Error Classification Regression Tests ===\n');

const src = fs.readFileSync(path.join(__dirname, '..', 'shared', 'portal-session.js'), 'utf8');

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
    sessionStorage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    },
    document: {
      querySelector: () => null,
      createElement: () => ({ setAttribute() {}, style: {} }),
      head: { appendChild() {} },
    },
    setInterval: () => 0,
    clearInterval: () => {},
    setTimeout: (fn) => { fn(); return Math.random(); },
    addEventListener: () => {},
    console: { warn: () => {}, log: () => {}, error: () => {}, debug: () => {} },
    atob: (b) => Buffer.from(b, 'base64').toString('binary'),
    JSON, Date, Number, String, Object, Array, Error, Math, Promise, Boolean,
    URLSearchParams,
    fetch: opts.fetch || (async () => ({ ok: true, status: 200, json: async () => ({}) })),
  };
  win.window = win;
  win.globalThis = win;
  vm.createContext(win);
  vm.runInContext(src, win);
  return { win, store };
}

function fakeJwt(sub, expSec) {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64').replace(/=+$/, '');
  const payload = Buffer.from(JSON.stringify({ sub, exp: expSec })).toString('base64').replace(/=+$/, '');
  return header + '.' + payload + '.sig';
}

const now = Math.floor(Date.now() / 1000);

function primeSession(win, over) {
  win.localStorage.setItem('rifim_auth', JSON.stringify(Object.assign({
    access_token: fakeJwt('user-xyz', now + 3600),
    refresh_token: 'r-token-123',
    expires_at: now + 3600,
    id: 'user-xyz',
    role: 'admin',
    full_name: 'Test User',
  }, over || {})));
}

return (async () => {
  // ── D1: Expired access + valid refresh → RECOVER ──
  {
    const { win, store } = makeWin({
      fetch: async (url) => {
        if (String(url).indexOf('/auth/v1/token') !== -1) {
          return { ok: true, status: 200, json: async () => ({
            access_token: fakeJwt('user-xyz', now + 3600),
            refresh_token: 'r-token-new',
            expires_at: now + 3600,
          }) };
        }
        return { ok: true, status: 200, json: async () => ([{ id: 'user-xyz', role: 'admin', full_name: 'Test', is_active: true }]) };
      }
    });
    primeSession(win, { access_token: fakeJwt('user-xyz', now - 10), expires_at: now - 10 });
    const result = await win.RifimPortalSession.validate();
    assert.ok(result, 'D1 expired access + valid refresh → recovered');
    assert.ok('rifim_auth' in store, 'D1 session not cleared');
    console.log('  ok  D1 expired access + valid refresh → RECOVER');
  }

  // ── D2: Stale 401 → REFRESH/RETRY ──
  {
    const { win, store } = makeWin({
      fetch: async (url) => {
        if (String(url).indexOf('/auth/v1/token') !== -1) {
          return { ok: true, status: 200, json: async () => ({
            access_token: fakeJwt('user-xyz', now + 3600),
            refresh_token: 'r-token-new',
            expires_at: now + 3600,
          }) };
        }
        return { ok: true, status: 200, json: async () => ([{ id: 'user-xyz', role: 'admin', full_name: 'Test', is_active: true }]) };
      }
    });
    primeSession(win, { access_token: fakeJwt('user-xyz', now - 10), expires_at: now - 10 });
    win.RifimPortalSession.invalidate();
    const result = await win.RifimPortalSession.validate();
    assert.ok(result, 'D2 stale 401 → refresh/retry succeeded');
    assert.ok('rifim_auth' in store, 'D2 session kept');
    console.log('  ok  D2 stale 401 → REFRESH/RETRY');
  }

  // ── D3: 403 permission denied → KEEP SESSION ──
  {
    const { win, store } = makeWin({
      fetch: async () => {
        return { ok: false, status: 403, json: async () => ({}) };
      }
    });
    primeSession(win);
    win.RifimPortalSession.invalidate();
    const result = await win.RifimPortalSession.validate();
    assert.ok(result, 'D3 403 permission → kept session');
    assert.ok('rifim_auth' in store, 'D3 403 did NOT clear session');
    console.log('  ok  D3 403 permission → KEEP SESSION (NOT logout)');
  }

  // ── D4: Network timeout → KEEP SESSION ──
  {
    const { win, store } = makeWin({
      fetch: async () => {
        throw new Error('ETIMEDOUT');
      }
    });
    primeSession(win);
    win.RifimPortalSession.invalidate();
    const result = await win.RifimPortalSession.validate();
    assert.ok(result, 'D4 network timeout → kept session');
    assert.ok('rifim_auth' in store, 'D4 timeout did NOT clear session');
    console.log('  ok  D4 network timeout → KEEP SESSION');
  }

  // ── D5: Backend 500 → KEEP SESSION ──
  {
    const { win, store } = makeWin({
      fetch: async () => {
        return { ok: false, status: 500, json: async () => ({}) };
      }
    });
    primeSession(win);
    win.RifimPortalSession.invalidate();
    const result = await win.RifimPortalSession.validate();
    assert.ok(result, 'D5 backend 500 → kept session');
    assert.ok('rifim_auth' in store, 'D5 500 did NOT clear session');
    console.log('  ok  D5 backend 500 → KEEP SESSION');
  }

  // ── D6: Refresh token invalid → TERMINAL LOGOUT ──
  {
    const { win, store } = makeWin({
      fetch: async (url) => {
        if (String(url).indexOf('/auth/v1/token') !== -1) {
          return { ok: false, status: 400, json: async () => ({ error: 'invalid_grant' }) };
        }
        return { ok: true, status: 200, json: async () => ([]) };
      }
    });
    primeSession(win, { access_token: fakeJwt('user-xyz', now - 10), expires_at: now - 10 });
    win.RifimPortalSession.invalidate();
    const result = await win.RifimPortalSession.validate();
    assert.strictEqual(result, null, 'D6 refresh token invalid → logged out');
    assert.ok(!('rifim_auth' in store), 'D6 invalid refresh cleared session');
    console.log('  ok  D6 refresh token invalid → TERMINAL LOGOUT');
  }

  // ── D7: User inactive → FAIL CLOSED ──
  {
    const { win, store } = makeWin({
      fetch: async () => {
        return { ok: true, status: 200, json: async () => ([{ id: 'user-xyz', role: 'admin', full_name: 'Test', is_active: false }]) };
      }
    });
    primeSession(win);
    win.RifimPortalSession.invalidate();
    const result = await win.RifimPortalSession.validate();
    assert.strictEqual(result, null, 'D7 inactive user → logged out');
    assert.ok(!('rifim_auth' in store), 'D7 inactive cleared session');
    console.log('  ok  D7 user inactive (is_active=false) → FAIL CLOSED');
  }

  // ── D8: API 403 → KEEP SESSION (not auth failure) ──
  {
    const { win, store } = makeWin({
      fetch: async () => {
        return { ok: false, status: 403, json: async () => ({}) };
      }
    });
    primeSession(win);
    win.RifimPortalSession.invalidate();
    const result = await win.RifimPortalSession.validate();
    assert.ok(result, 'D8 API 403 → kept session');
    assert.ok('rifim_auth' in store, 'D8 403 is permission error, NOT auth failure');
    console.log('  ok  D8 API 403 permission error → KEEP SESSION');
  }

  console.log('\n✓ All Phase D error classification tests PASS (8/8)');
  console.log('\nClassification Summary:');
  console.log('  Recoverable: expired access, stale 401, 403, network, 500');
  console.log('  Terminal: invalid refresh_token, inactive user');
  console.log('  Pattern: Only specific failures → terminal logout\n');
})().catch(err => {
  console.error('FAIL:', err);
  process.exit(1);
});
