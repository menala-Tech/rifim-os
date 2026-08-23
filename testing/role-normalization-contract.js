const assert = require('assert');
const path = require('path');

process.env.SUPABASE_URL = 'https://supabase.example';
process.env.SUPABASE_PUBLISHABLE_KEY = 'pub';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc';
process.env.AIST_RUNNER_URL = 'https://runner.example';
process.env.AIST_RUNNER_SHARED_SECRET = 'runnersecret';
process.env.RIFIM_GAS_WEBAPP_URL = 'https://gas.example/exec';

const _shared = require(path.join(__dirname, '../api/internal/aist-agent/_shared.js'));
const hrisContractSync = require(path.join(__dirname, '../api/internal/hris-contract-sync.js'));
const aistRunner = require(path.join(__dirname, '../api/internal/aist-runner.js'));
const aistStatus = require(path.join(__dirname, '../api/internal/aist-agent/status.js'));
const aistManualRequest = require(path.join(__dirname, '../api/internal/aist-agent/manual-request.js'));

const originalFetch = global.fetch;

function resMock() {
  return {
    _status: null,
    _headers: {},
    _body: null,
    status(s) { this._status = s; return this; },
    setHeader(k, v) { this._headers[k] = v; return this; },
    end(b) { this._body = b; }
  };
}

function jsonBody(res) {
  return res._body ? JSON.parse(res._body) : null;
}

function mockFetchWithRole(role, extra) {
  return async (url, init) => {
    const u = String(url);
    if (u.includes('/auth/v1/user')) {
      return { ok: true, status: 200, text: async () => JSON.stringify({ id: 'u1', email: 'a@b' }) };
    }
    if (u.includes('/rest/v1/user_profiles')) {
      return { ok: true, status: 200, text: async () => JSON.stringify([{ id: 'u1', role, is_active: true, branch_id: 'b1' }]) };
    }
    if (u.includes('/rest/v1/aist_agents')) {
      return { ok: true, status: 200, text: async () => JSON.stringify([{ id: 'agent-1', last_seen_at: new Date().toISOString() }]) };
    }
    if (u.includes('/rest/v1/rpc/hris_sync_smart_office_contract')) {
      return { ok: true, status: 200, text: async () => JSON.stringify({ id: 'contract-1' }) };
    }
    if (u.includes('/rest/v1/rpc/aist_request_manual')) {
      return { ok: true, status: 200, text: async () => JSON.stringify([{ id: 'job-1' }]) };
    }
    if (extra === 'runner' && u.includes('/run')) {
      return { ok: true, status: 200, text: async () => JSON.stringify({ success: true, started_at: new Date().toISOString(), completed_at: new Date().toISOString() }) };
    }
    if (u.includes('runner.example') || u.includes('gas.example') || u.includes('script.google.com')) {
      return { ok: true, status: 200, text: async () => JSON.stringify({ success: true, status: 'updated' }) };
    }
    return { ok: false, status: 404, text: async () => 'not found' };
  };
}

function fetchForShared(profileRole) {
  return async (url) => {
    const u = String(url);
    if (u.includes('/rest/v1/user_profiles')) {
      return { ok: true, status: 200, text: async () => JSON.stringify([{ id: 'u1', email: 'x@rifim.id', role: profileRole, is_active: true, branch_id: 'b1' }]) };
    }
    return { ok: false, status: 404, text: async () => 'not found' };
  };
}

(async () => {
  console.log('=== RIFIM OS role normalization contract ===');

  // 1. Canonical roleOf alias mapping
  assert.strictEqual(_shared.roleOf('direktur'), 'direksi', 'direktur must normalize to direksi');
  assert.strictEqual(_shared.roleOf('DIREKTUR'), 'direksi', 'uppercase DIREKTUR must normalize to direksi');
  assert.strictEqual(_shared.roleOf('direksi'), 'direksi', 'canonical direksi must stay');
  assert.strictEqual(_shared.roleOf('koord'), 'koordinator', 'koord must normalize to koordinator');
  assert.strictEqual(_shared.roleOf('mgmt'), 'management', 'mgmt must normalize to management');
  assert.strictEqual(_shared.roleOf('management'), 'management', 'canonical management must stay');
  assert.strictEqual(_shared.roleOf('admin'), 'admin', 'canonical admin must stay');
  assert.strictEqual(_shared.roleOf('staff'), 'staff', 'unknown role must not become privileged');

  // 2. _shared.getOperatorByEmail: admin/direksi/direktur allowed, others rejected
  for (const allowed of ['admin', 'direksi', 'direktur']) {
    global.fetch = fetchForShared(allowed);
    const op = await _shared.getOperatorByEmail(`${allowed}@rifim.id`);
    assert.strictEqual(op.role, _shared.roleOf(allowed), `getOperatorByEmail must normalize and allow ${allowed}`);
  }
  for (const denied of ['staff', 'management', 'mgmt', 'direktur_boss']) {
    global.fetch = fetchForShared(denied);
    let deniedThrew = false;
    try { await _shared.getOperatorByEmail(`${denied}@rifim.id`); } catch (e) { deniedThrew = true; }
    assert.ok(deniedThrew, `getOperatorByEmail must reject ${denied}`);
  }

  // 3. hris-contract-sync: admin/direksi/direktur allowed; others rejected
  for (const allowed of ['admin', 'direksi', 'direktur']) {
    global.fetch = mockFetchWithRole(allowed);
    const res = resMock();
    await hrisContractSync({ method: 'POST', headers: { authorization: 'Bearer token' }, body: { employee_id: 'E001' } }, res);
    assert.strictEqual(res._status, 200, `hris-contract-sync must allow ${allowed}`);
    assert.strictEqual(jsonBody(res).success, true, `hris-contract-sync must succeed for ${allowed}`);
  }
  for (const denied of ['staff', 'management', 'mgmt', 'direktur_boss']) {
    global.fetch = mockFetchWithRole(denied);
    const res = resMock();
    await hrisContractSync({ method: 'POST', headers: { authorization: 'Bearer token' }, body: { employee_id: 'E001' } }, res);
    assert.strictEqual(res._status, 400, `hris-contract-sync must reject ${denied}`);
    assert.strictEqual(jsonBody(res).success, false, `hris-contract-sync must fail for ${denied}`);
  }

  // 4. aist-agent/status: admin/management/direksi/direktur/mgmt allowed; staff rejected
  for (const allowed of ['admin', 'direksi', 'direktur', 'management', 'mgmt']) {
    global.fetch = mockFetchWithRole(allowed);
    const res = resMock();
    await aistStatus({ method: 'GET', headers: { authorization: 'Bearer token' } }, res);
    assert.strictEqual(res._status, 200, `aist-agent/status must allow ${allowed}`);
  }
  for (const denied of ['staff', 'direktur_boss']) {
    global.fetch = mockFetchWithRole(denied);
    const res = resMock();
    await aistStatus({ method: 'GET', headers: { authorization: 'Bearer token' } }, res);
    assert.strictEqual(res._status, 403, `aist-agent/status must reject ${denied}`);
  }

  // 5. aist-agent/manual-request: admin/direksi/direktur allowed; others rejected
  for (const allowed of ['admin', 'direksi', 'direktur']) {
    global.fetch = mockFetchWithRole(allowed);
    const res = resMock();
    await aistManualRequest({ method: 'POST', headers: { authorization: 'Bearer token' }, body: { request_id: 'r1' } }, res);
    assert.strictEqual(res._status, 200, `aist-agent/manual-request must allow ${allowed}`);
  }
  for (const denied of ['staff', 'management', 'mgmt', 'direktur_boss']) {
    global.fetch = mockFetchWithRole(denied);
    const res = resMock();
    await aistManualRequest({ method: 'POST', headers: { authorization: 'Bearer token' }, body: { request_id: 'r1' } }, res);
    assert.strictEqual(res._status, 403, `aist-agent/manual-request must reject ${denied}`);
  }

  // 6. aist-runner: admin/direksi/direktur allowed; others rejected
  for (const allowed of ['admin', 'direksi', 'direktur']) {
    global.fetch = mockFetchWithRole(allowed, 'runner');
    const res = resMock();
    await aistRunner({ method: 'POST', headers: { authorization: 'Bearer token' }, body: { request_id: 'r1', driver_login: 'D001', nominal: 1000 } }, res);
    assert.strictEqual(res._status, 200, `aist-runner must allow ${allowed}`);
    assert.strictEqual(jsonBody(res).actor_role, _shared.roleOf(allowed), `aist-runner must expose normalized role for ${allowed}`);
  }
  for (const denied of ['staff', 'management', 'mgmt', 'direktur_boss']) {
    global.fetch = mockFetchWithRole(denied, 'runner');
    const res = resMock();
    await aistRunner({ method: 'POST', headers: { authorization: 'Bearer token' }, body: { request_id: 'r1', driver_login: 'D001', nominal: 1000 } }, res);
    assert.strictEqual(res._status, 403, `aist-runner must reject ${denied}`);
  }

  // 7. Client cannot override authenticated role via body/query
  const overrideCases = [
    ['hris-contract-sync body', (res) => hrisContractSync({ method: 'POST', headers: { authorization: 'Bearer token' }, body: { employee_id: 'E001', role: 'admin' } }, res)],
    ['aist-agent/status query', (res) => aistStatus({ method: 'GET', headers: { authorization: 'Bearer token' }, query: { role: 'admin' } }, res)],
    ['aist-agent/manual-request body', (res) => aistManualRequest({ method: 'POST', headers: { authorization: 'Bearer token' }, body: { request_id: 'r1', role: 'admin' } }, res)],
    ['aist-runner body', (res) => aistRunner({ method: 'POST', headers: { authorization: 'Bearer token' }, body: { request_id: 'r1', driver_login: 'D001', nominal: 1000, role: 'admin' } }, res)],
  ];
  for (const [label, call] of overrideCases) {
    global.fetch = mockFetchWithRole('staff'); // server-side profile is staff
    const res = resMock();
    await call(res);
    const ok = res._status === 400 || res._status === 403;
    assert.ok(ok, `${label} must reject client-supplied admin override when server profile is staff (${res._status})`);
  }

  global.fetch = originalFetch;
  console.log('PASS');
})().catch((e) => {
  global.fetch = originalFetch;
  console.error('FAIL:', e.message);
  process.exit(1);
});
