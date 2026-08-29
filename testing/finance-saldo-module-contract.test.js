// Phase 2 — Internal finance-saldo module contract.
// Verifies that the saldo lifecycle is isolated into an internal module
// (not a new Vercel function) and that the dispatcher delegation preserves
// all canonical contracts.
// Run: node testing/finance-saldo-module-contract.test.js
'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const createFinanceSaldo = require(path.resolve(__dirname, '..', 'api', 'internal', '_modules', 'finance-saldo.js'));

const calls = [];
const patches = [];

function makeDeps({ profile = { id: 'user-admin', role: 'admin', is_active: true } } = {}) {
  calls.length = 0;
  patches.length = 0;
  return {
    q: (v) => encodeURIComponent(String(v == null ? '' : v)),
    sb: async (url, opts = {}) => {
      calls.push({ type: 'sb', url, method: opts.method || 'GET', body: opts.body });
      if (url.includes('raos_saldo_requests?id=eq.') && (opts.method || 'GET').toUpperCase() === 'GET') {
        return (url.includes('r1') || url.includes('r2')) ? [{ id: 'r1', status: 'pending', is_processed: false, is_archived: false }] : [];
      }
      if (url.includes('raos_saldo_requests?id=eq.') && (opts.method || '').toUpperCase() === 'PATCH') {
        patches.push({ url, body: opts.body });
        return [{}]; // minimal
      }
      if (url.includes('user_profiles') || url.includes('branches')) return [];
      if (url.includes('raos_ops_audit')) return [];
      return [];
    },
    sbAsActor: async (url, opts, bearer) => {
      calls.push({ type: 'sbAsActor', url, body: opts.body, bearer: bearer ? 'present' : 'missing' });
      return { status: 'updated' };
    },
    opsAudit: async (...args) => {
      calls.push({ type: 'opsAudit', args });
    }
  };
}

const failures = [];
const pass = n => console.log('  ok  ' + n);
const fail = (n, e) => { failures.push({ n, e }); console.log('  FAIL  ' + n + '\n        ' + (e && e.message || e)); };

async function run() {
  // T1 — module exists and is not a route.
  try {
    assert.ok(fs.existsSync(path.resolve(__dirname, '..', 'api', 'internal', '_modules', 'finance-saldo.js')), 'module file must exist');
    assert.ok(!fs.existsSync(path.resolve(__dirname, '..', 'api', 'internal', '_modules', 'finance-saldo') + '.html'), 'no route artifact');
    pass('T1 internal module file exists');
  } catch (e) { fail('T1 internal module file exists', e); }

  // T2 — missing deps fail-closed.
  try {
    assert.throws(() => createFinanceSaldo({}), /missing required dependencies/);
    pass('T2 missing dependencies fail-closed');
  } catch (e) { fail('T2 missing dependencies fail-closed', e); }

  // T3 — listSaldo delegates to the existing list contract (GET, no mutations).
  try {
    const financeSaldo = createFinanceSaldo(makeDeps());
    const req = { query: { status: 'pending' } };
    const p = { id: 'user-admin', role: 'admin' };
    const rows = await financeSaldo.listSaldo(req, p);
    assert.ok(Array.isArray(rows), 'listSaldo must return an array');
    const sbCalls = calls.filter(c => c.type === 'sb');
    assert.ok(sbCalls.some(c => c.method === 'GET' && c.url.includes('raos_saldo_requests?')), 'listSaldo must GET raos_saldo_requests');
    assert.ok(sbCalls.some(c => c.url.includes('&status=eq.pending')), 'listSaldo must preserve pending filter');
    pass('T3 listSaldo contract unchanged');
  } catch (e) { fail('T3 listSaldo contract unchanged', e); }

  // T4 — cancel remains canonical and idempotent.
  try {
    const financeSaldo = createFinanceSaldo(makeDeps());
    const req = { body: { id: 'r1' } };
    const p = { id: 'user-admin', role: 'admin' };
    const r = await financeSaldo.cancelSaldo(req, p);
    assert.strictEqual(r.status, 'cancelled');
    assert.strictEqual(patches.length, 1, 'exactly one PATCH');
    assert.ok(/status=eq\.pending/.test(patches[0].url), 'PATCH must scope status=pending');
    assert.ok(/is_processed=eq\.false/.test(patches[0].url), 'PATCH must scope is_processed=false');
    assert.ok(/is_archived=eq\.false/.test(patches[0].url), 'PATCH must scope is_archived=false');
    const payload = JSON.parse(patches[0].body);
    assert.strictEqual(payload.status, 'cancelled');
    pass('T4 cancel PATCH is canonical and race-safe');
  } catch (e) { fail('T4 cancel PATCH is canonical and race-safe', e); }

  // T5 — cancel blocked for non-pending.
  try {
    const deps = makeDeps();
    deps.sb = async (url, opts = {}) => {
      calls.push({ type: 'sb', url, method: opts.method || 'GET', body: opts.body });
      if (url.includes('raos_saldo_requests?id=eq.r3') && (opts.method || 'GET').toUpperCase() === 'GET') {
        return [{ id: 'r3', status: 'approved', is_processed: false, is_archived: false }];
      }
      return [];
    };
    const financeSaldo = createFinanceSaldo(deps);
    const req = { body: { id: 'r3' } };
    const p = { id: 'user-admin', role: 'admin' };
    await financeSaldo.cancelSaldo(req, p);
    fail('T5 approved cancel must be blocked', new Error('did not throw'));
  } catch (e) {
    if (/tidak dapat dibatalkan/i.test(e.message)) pass('T5 approved cancel blocked');
    else fail('T5 approved cancel blocked', e);
  }

  // T6 — markSaldo delegates RPC with actor token.
  try {
    const financeSaldo = createFinanceSaldo(makeDeps());
    const req = { body: { id: 'r1' }, headers: { authorization: 'Bearer TOKEN' } };
    const p = { id: 'user-admin', role: 'admin' };
    const r = await financeSaldo.markSaldo(req, p);
    assert.strictEqual(r.status, 'updated');
    const actorCalls = calls.filter(c => c.type === 'sbAsActor');
    assert.strictEqual(actorCalls.length, 1);
    assert.ok(actorCalls[0].url.includes('raos_saldo_mark_paid'), 'markSaldo must call RPC');
    pass('T6 markSaldo delegates RPC');
  } catch (e) { fail('T6 markSaldo delegates RPC', e); }

  // T7 — authorized role guard (financeWrite) inside module.
  try {
    const financeSaldo = createFinanceSaldo(makeDeps());
    const req = { body: { id: 'r1' } };
    const p = { id: 'user-staff', role: 'staff' };
    await financeSaldo.cancelSaldo(req, p);
    fail('T7 staff must not cancel', new Error('did not throw'));
  } catch (e) {
    if (/hanya admin\/direksi/i.test(e.message.toLowerCase())) pass('T7 staff cancel blocked');
    else fail('T7 staff cancel blocked', e);
  }

  // T8 — dispatcher wiring preserved: hris-contracts still branches modes.
  try {
    const src = fs.readFileSync(path.resolve(__dirname, '..', 'api', 'internal', 'hris-contracts.js'), 'utf8');
    assert.ok(src.includes("require('./_modules/finance-saldo')"), 'hris-contracts must require internal finance-saldo module');
    assert.ok(/financeSaldo\.listSaldo/.test(src), 'dispatcher must delegate listSaldo');
    assert.ok(/financeSaldo\.markSaldo/.test(src), 'dispatcher must delegate markSaldo');
    assert.ok(/financeSaldo\.cancelSaldo/.test(src), 'dispatcher must delegate cancelSaldo');
    pass('T8 dispatcher delegates to internal module');
  } catch (e) { fail('T8 dispatcher delegates to internal module', e); }

  // T9 — no new standalone route, function count <= 12.
  try {
    const apiDir = path.resolve(__dirname, '..', 'api');
    function walk(d, acc) {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p, acc);
        else if (/\.(js|ts|mjs|cjs)$/.test(e.name)) acc.push(p);
      }
      return acc;
    }
    const routes = walk(apiDir, []).filter(p => !p.includes(path.sep + '_lib' + path.sep) && !p.includes(path.sep + '_modules' + path.sep) && !/^_/.test(path.basename(p)));
    assert.ok(routes.length <= 12, 'Vercel function count must remain <= 12 (found ' + routes.length + ')');
    pass('T9 function count <= 12 (found ' + routes.length + ')');
  } catch (e) { fail('T9 function count <= 12', e); }

  // T10 — canonical status aliases preserved (cancelled ≠ rejected).
  try {
    const src = fs.readFileSync(path.resolve(__dirname, '..', 'api', 'internal', '_modules', 'finance-saldo.js'), 'utf8');
    assert.ok(/'cancelled'/.test(src), 'cancelled must remain a canonical status');
    assert.ok(!/'cancelled'\s*:\s*'rejected'/.test(src), 'cancelled must not alias to rejected');
    pass('T10 cancelled remains canonical');
  } catch (e) { fail('T10 cancelled remains canonical', e); }

  console.log('');
  if (failures.length) { console.log('FAIL — ' + failures.length + ' assertion(s) failed'); process.exit(1); }
  console.log('ALL PASSED');
}

run().catch(e => { console.log('crash:', e); process.exit(1); });
