/**
 * Executable 401 retry-once contract for the canonical Finance router.
 *
 * The router source is evaluated unchanged except for a test-only hook that
 * exposes its existing apiGet/apiPost closures. Retry behavior is not copied.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const root = path.join(__dirname, '..');
const routerSource = fs.readFileSync(
  path.join(root, 'shared/finance-data-router.js'),
  'utf8'
);

function loadRouter(fetchImpl, invalidate) {
  const storage = {
    getItem(key) {
      return key === 'rifim_auth'
        ? JSON.stringify({ access_token: 'router-test-token', email: 'test@rifim.id' })
        : null;
    },
    setItem() {},
    removeItem() {},
  };
  const sandbox = {
    location: { pathname: '/finance' },
    localStorage: storage,
    document: {
      readyState: 'complete',
      addEventListener() {},
      removeEventListener() {},
      getElementById() { return null; },
      querySelector() { return null; },
      querySelectorAll() { return []; },
    },
    setTimeout() {},
    setInterval() {},
    clearInterval() {},
    URLSearchParams,
    console: { warn() {}, log() {} },
    fetch: fetchImpl,
    RifimPortalSession: { invalidate },
    _gasCall: async () => { throw new Error('unexpected original _gasCall'); },
  };
  sandbox.window = sandbox;

  // Test-only exposure of the real functions inside their source closure.
  const instrumented = routerSource.replace(
    'global.FinanceDataRouter={',
    'global.__apiGet=apiGet;global.__apiPost=apiPost;global.FinanceDataRouter={'
  );
  vm.runInNewContext(instrumented, sandbox);
  assert.strictEqual(typeof sandbox.__apiGet, 'function', 'real apiGet exposed');
  assert.strictEqual(typeof sandbox.__apiPost, 'function', 'real apiPost exposed');
  return sandbox;
}

function response(status, body) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  };
}

async function main() {
  console.log('=== RIFIM OS Finance router 401 retry-once contract ===');

  {
    const calls = [];
    let invalidations = 0;
    const router = loadRouter(
      async (url, init) => {
        calls.push({ url: String(url), init });
        return calls.length === 1
          ? response(401, { success: false, message: 'expired token' })
          : response(200, { success: true, rows: [{ id: 'retry-get' }] });
      },
      () => { invalidations += 1; }
    );
    const body = await router.__apiGet('finance_saldo_list', { status: 'pending' });
    assert.strictEqual(calls.length, 2, 'GET 401 then 200 must fetch exactly twice');
    assert.strictEqual(invalidations, 1, 'GET retry must invalidate exactly once');
    assert.deepStrictEqual(body, { success: true, rows: [{ id: 'retry-get' }] },
      'GET caller receives the second parsed response body');
    console.log('  ok  GET 401 → invalidate once → retry once → parsed 200 body');
  }

  {
    const calls = [];
    let invalidations = 0;
    const router = loadRouter(
      async (url, init) => {
        calls.push({ url: String(url), init });
        return response(401, { success: false, message: 'still unauthorized' });
      },
      () => { invalidations += 1; }
    );
    await assert.rejects(
      () => router.__apiGet('finance_saldo_list', {}),
      /still unauthorized|Finance API gagal/,
      'GET second 401 must surface to the caller'
    );
    assert.strictEqual(calls.length, 2, 'GET two 401 responses must stop after two fetches');
    assert.strictEqual(invalidations, 1, 'GET two 401 responses must invalidate exactly once');
    console.log('  ok  GET two 401 responses stop after one retry and surface failure');
  }

  {
    const calls = [];
    let invalidations = 0;
    const router = loadRouter(
      async (url, init) => {
        calls.push({ url: String(url), init });
        return response(200, { success: true, rows: [] });
      },
      () => { invalidations += 1; }
    );
    await router.__apiGet('finance_saldo_list', {});
    assert.strictEqual(calls.length, 1, 'GET 200 must fetch exactly once');
    assert.strictEqual(invalidations, 0, 'GET 200 must not invalidate');
    console.log('  ok  GET 200 happy path performs no invalidation or refresh storm');
  }

  {
    const calls = [];
    let invalidations = 0;
    const router = loadRouter(
      async (url, init) => {
        calls.push({ url: String(url), init });
        return calls.length === 1
          ? response(401, { success: false, message: 'expired token' })
          : response(200, { success: true, updated: true });
      },
      () => { invalidations += 1; }
    );
    const body = await router.__apiPost('finance_saldo_mark_paid', { id: 'retry-post' });
    assert.strictEqual(calls.length, 2, 'POST 401 then 200 must fetch exactly twice');
    assert.strictEqual(invalidations, 1, 'POST retry must invalidate exactly once');
    assert.deepStrictEqual(body, { success: true, updated: true },
      'POST caller receives the second parsed response body');
    assert.strictEqual(calls[0].init.method, 'POST', 'POST retry path must use POST');
    console.log('  ok  POST 401 → invalidate once → retry once → parsed 200 body');
  }

  console.log('PASS: Finance router 401 retry-once contract');
}

main().catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exitCode = 1;
});
