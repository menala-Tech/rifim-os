const fs = require('fs');
const assert = require('assert');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');

function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }

function functionBody(src, name) {
  const start = src.indexOf(`async function ${name}(`);
  assert.ok(start >= 0, `function ${name} not found`);
  let depth = 0, i = start, foundOpen = false;
  for (; i < src.length; i++) {
    if (src[i] === '{') { depth++; foundOpen = true; }
    else if (src[i] === '}') { depth--; }
    if (foundOpen && depth === 0) break;
  }
  return src.slice(start, i + 1);
}

function resMock() {
  return {
    _status: null,
    _headers: {},
    _body: null,
    status(s) { this._status = s; return this; },
    setHeader(k, v) { this._headers[k] = v; return this; },
    end(body) { this._body = body; }
  };
}

console.log('=== RIFIM OS Finance canonical mutation routing contract ===');

// ---------------------------------------------------------------------------
// Behavioral server-side tagihan handler tests (api/internal/hris-contracts.js)
// ---------------------------------------------------------------------------

process.env.SUPABASE_URL = 'https://supabase.example';
process.env.SUPABASE_PUBLISHABLE_KEY = 'pub';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc';
process.env.GAS_URL = 'https://gas.example/exec';
process.env.FINANCE_LEGACY_GAS_TIMEOUT_MS = '100';

const originalFetch = global.fetch;
const hrisHandler = require(path.join(root, 'api/internal/hris-contracts.js'));

async function runHrisTest({ role, mode, body }) {
  const gasCalls = [];
  global.fetch = async (url, init) => {
    const u = String(url);
    if (u.includes('/auth/v1/user')) {
      return { ok: true, status: 200, text: async () => JSON.stringify({ id: 'u1', email: 'admin@rifim.id' }) };
    }
    if (u.includes('/rest/v1/user_profiles')) {
      return { ok: true, status: 200, text: async () => JSON.stringify([{ id: 'u1', role, is_active: true, branch_id: 'b1' }]) };
    }
    if (u.includes('gas.example') || u.includes('script.google.com')) {
      gasCalls.push({ url: u, init });
      return {
        ok: true,
        status: 200,
        url: u,
        headers: { get: (h) => h.toLowerCase() === 'content-type' ? 'application/json' : '' },
        text: async () => JSON.stringify({ success: true, no_tagihan: 'T-001', row: 2 })
      };
    }
    return { ok: false, status: 404, text: async () => 'not found' };
  };

  const req = {
    method: 'POST',
    headers: { authorization: 'Bearer callertoken' },
    query: {},
    body: Object.assign({ mode, access_token: 'evil-token', action: 'hacked-action' }, body || {})
  };
  const res = resMock();
  await hrisHandler(req, res);
  global.fetch = originalFetch;
  return { res, gasCalls };
}

(async () => {
  // Admin can add tagihan; payload is rebuilt server-side.
  {
    const { res, gasCalls } = await runHrisTest({
      role: 'admin',
      mode: 'finance_tagihan_add',
      body: { jenis: 'Listrik', no_tagihan: 'T-001', instansi: 'PLN', bulan: 'Agustus 2026', jumlah: 100000, no_rekening: '123' }
    });
    assert.strictEqual(res._status, 200, 'admin tagihan add should return 200');
    const body = JSON.parse(res._body);
    assert.strictEqual(body.success, true, 'admin tagihan add should succeed');
    assert.strictEqual(gasCalls.length, 1, 'exactly one GAS call must be made');
    const posted = JSON.parse(gasCalls[0].init.body);
    assert.strictEqual(posted.action, 'finance_tagihan_add', 'GAS action must be server-derived');
    assert.strictEqual(posted.access_token, 'callertoken', 'GAS must receive only the header-derived bearer');
    assert.strictEqual(posted.access_token, 'callertoken', 'client-supplied access_token must not be trusted');
    assert.ok(!posted.hacked, 'client action override must be removed');
    assert.strictEqual(posted.jenis, 'Listrik', 'business payload jenis must be preserved');
    assert.strictEqual(posted.no_tagihan, 'T-001', 'business payload no_tagihan must be preserved');
  }

  // Admin can mark tagihan paid.
  {
    const { res, gasCalls } = await runHrisTest({
      role: 'admin',
      mode: 'finance_tagihan_mark_paid',
      body: { no_tagihan: 'T-001', tgl_bayar: '2026-08-22' }
    });
    assert.strictEqual(res._status, 200, 'admin tagihan mark-paid should return 200');
    const body = JSON.parse(res._body);
    assert.strictEqual(body.success, true, 'admin tagihan mark-paid should succeed');
    assert.strictEqual(gasCalls.length, 1, 'exactly one GAS call must be made');
    const posted = JSON.parse(gasCalls[0].init.body);
    assert.strictEqual(posted.action, 'finance_tagihan_mark_paid', 'GAS action must be server-derived mark-paid');
    assert.strictEqual(posted.access_token, 'callertoken', 'GAS must receive only the header-derived bearer');
    assert.strictEqual(posted.no_tagihan, 'T-001', 'business payload no_tagihan must be preserved');
  }

  // Non-write role (staff) is rejected before GAS.
  {
    const { res, gasCalls } = await runHrisTest({
      role: 'staff',
      mode: 'finance_tagihan_add',
      body: { jenis: 'Listrik', no_tagihan: 'T-001', instansi: 'PLN' }
    });
    assert.strictEqual(res._status, 403, 'staff tagihan add must be rejected');
    const body = JSON.parse(res._body);
    assert.strictEqual(body.success, false, 'staff tagihan add must return success:false');
    assert.ok(/Hanya|Admin\/Direksi|mengubah/i.test(body.message), 'staff rejection must mention Finance write guard');
    assert.strictEqual(gasCalls.length, 0, 'staff must not reach GAS');
  }

  // Unknown tagihan mode is rejected (handler returns 405, no GAS reached).
  {
    const { res, gasCalls } = await runHrisTest({
      role: 'admin',
      mode: 'finance_tagihan_delete',
      body: { no_tagihan: 'T-001' }
    });
    assert.strictEqual(res._status, 405, 'unknown tagihan mode must be rejected as not allowed');
    const body = JSON.parse(res._body);
    assert.strictEqual(body.success, false, 'unknown tagihan mode must fail');
    assert.strictEqual(gasCalls.length, 0, 'unknown tagihan mode must not reach GAS');
  }

  // ---------------------------------------------------------------------------
  // Behavioral router mapping tests (shared/finance-data-router.js)
  // ---------------------------------------------------------------------------

  const routerSrc = read('shared/finance-data-router.js');
  const routerApiCalls = [];
  const routerSandbox = {
    _gasCall: async () => { throw new Error('FALLBACK'); },
    location: { pathname: '/finance' },
    localStorage: { getItem: (k) => k === 'rifim_auth' ? JSON.stringify({ access_token: 'browsertoken' }) : null, setItem: () => {}, removeItem: () => {} },
    document: {
      readyState: 'complete',
      write: () => {},
      head: { appendChild: () => {} },
      body: { appendChild: () => {} },
      addEventListener: () => {},
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => []
    },
    setTimeout: () => {},
    setInterval: () => {},
    console: { warn: () => {}, log: () => {} },
    fetch: async (url, init) => {
      routerApiCalls.push({ url: String(url), init });
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true })
      };
    }
  };
  routerSandbox.window = routerSandbox;
  vm.runInNewContext(routerSrc, routerSandbox);
  const routerCtx = routerSandbox;

  assert.ok(routerCtx.FinanceDataRouter, 'FinanceDataRouter must be exposed');
  assert.strictEqual(routerCtx.FinanceDataRouter.install(), true, 'install() must succeed in test sandbox');

  await routerCtx._gasCall('finance_tagihan_add', { jenis: 'Listrik', no_tagihan: 'T-001' });
  assert.strictEqual(routerApiCalls.length, 1, 'finance_tagihan_add must produce one internal API call');
  assert.ok(routerApiCalls[0].url.includes('/api/internal/hris-contracts'), 'tagihan add must call internal API');
  assert.strictEqual(routerApiCalls[0].init.method, 'POST', 'tagihan add must be POST');
  let rBody = JSON.parse(routerApiCalls[0].init.body);
  assert.strictEqual(rBody.mode, 'finance_tagihan_add', 'router must map finance_tagihan_add canonical mode');
  assert.strictEqual(rBody.access_token, undefined, 'browser must not send raw access_token in JSON body to server');

  routerApiCalls.length = 0;
  await routerCtx._gasCall('finance_tagihan_mark_paid', { no_tagihan: 'T-001', tgl_bayar: '2026-08-22' });
  assert.strictEqual(routerApiCalls.length, 1, 'finance_tagihan_mark_paid must produce one internal API call');
  rBody = JSON.parse(routerApiCalls[0].init.body);
  assert.strictEqual(rBody.mode, 'finance_tagihan_mark_paid', 'router must map finance_tagihan_mark_paid canonical mode');

  routerApiCalls.length = 0;
  await routerCtx._gasCall('finance_saldo_raos_mark_paid', { id: 'req-1' });
  assert.strictEqual(routerApiCalls.length, 1, 'finance_saldo_raos_mark_paid must produce one internal API call');
  rBody = JSON.parse(routerApiCalls[0].init.body);
  assert.strictEqual(rBody.mode, 'finance_saldo_mark_paid', 'router must preserve saldo mark-paid canonical mapping');
  assert.strictEqual(rBody.id, 'req-1', 'saldo mark-paid id must be preserved');

  // ---------------------------------------------------------------------------
  // Behavioral _gasCall fallback fail-closed test (modules/finance/index.html)
  // ---------------------------------------------------------------------------

  const htmlSrc = read('modules/finance/index.html');
  const gasCallSource = functionBody(htmlSrc, '_gasCall');
  const fallbackCtx = vm.createContext({
    _FIN_LEGACY_READ_ACTIONS: ['finance_list', 'finance_cabang_list', 'finance_tagihan_list', 'finance_rekap_harian', 'finance_rekap_bulanan', 'finance_log_list'],
    _finActionIsMutation: (action) => /(?:_mark_paid$|_upsert$|_compute$|_assign_random$|_add$|_update$|_delete$|_remove$|_set$)/.test(String(action || '')),
    _finCanMutate: () => true,
    _finGetAccessToken: async () => 'browsertoken',
    _finGetUserEmail: () => 'admin@rifim.id',
    GAS_URL: 'https://gas.example/exec',
    rifimCalls: [],
    gasFetchCalls: [],
    RifimAPI: {
      post: async (body) => { fallbackCtx.rifimCalls.push({ type: 'post', body }); return {}; },
      get: async (action, params) => { fallbackCtx.rifimCalls.push({ type: 'get', action, params }); return {}; }
    },
    fetch: async (url, opts) => { fallbackCtx.gasFetchCalls.push({ url, opts }); return { json: async () => ({}), text: async () => '' }; }
  });

  fallbackCtx.window = fallbackCtx;

  const wrapped = `(function(){
    ${gasCallSource}
    return { _gasCall };
  })()`;
  const gasCall = vm.runInNewContext(wrapped, fallbackCtx);

  // Mutation actions must fail closed without calling direct GAS transport.
  for (const mutation of ['finance_tagihan_add', 'finance_tagihan_mark_paid', 'finance_saldo_raos_mark_paid', 'finance_kpi_target_branch_upsert']) {
    let threw = false;
    try { await gasCall._gasCall(mutation, { foo: 'bar' }); } catch (e) { threw = true; }
    assert.ok(threw, `mutation ${mutation} must throw in fallback _gasCall`);
  }
  assert.strictEqual(fallbackCtx.rifimCalls.length, 0, 'fallback must not invoke RifimAPI for mutations');
  assert.strictEqual(fallbackCtx.gasFetchCalls.length, 0, 'fallback must not invoke fetch(GAS_URL) for mutations');

  // Legacy reads must still fail loud (not silently call fallback).
  for (const legacy of ['finance_list', 'finance_tagihan_list']) {
    let threw = false;
    try { await gasCall._gasCall(legacy, {}); } catch (e) { threw = true; }
    assert.ok(threw, `legacy read ${legacy} must throw in fallback _gasCall`);
  }
  assert.strictEqual(fallbackCtx.rifimCalls.length, 0, 'legacy reads must not invoke RifimAPI fallback');
  assert.strictEqual(fallbackCtx.gasFetchCalls.length, 0, 'legacy reads must not invoke fetch fallback');

  // A benign non-mutation non-legacy read may still reach the RifimAPI.get fallback.
  // This proves we did not over-restrict every action, only the critical ones.
  await gasCall._gasCall('finance_drivers_list', { branch_id: 'b1' });
  assert.strictEqual(fallbackCtx.gasFetchCalls.length, 0, 'non-legacy drivers list must not fetch GAS directly');
  assert.strictEqual(fallbackCtx.rifimCalls.length, 1, 'non-legacy drivers list may reach RifimAPI.get fallback');

  console.log('PASS');
})().catch((e) => {
  console.error('FAIL:', e.message);
  process.exit(1);
});
