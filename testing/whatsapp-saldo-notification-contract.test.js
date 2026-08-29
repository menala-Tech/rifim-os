// Phase 4 — WhatsApp Admin saldo notification outbox contract.
// Verifies deterministic, idempotent, retry-safe event creation and the
// provider_not_configured safe path. WA failure must not rollback saldo.
// Run: node testing/whatsapp-saldo-notification-contract.test.js
'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const createFinanceSaldo = require(path.resolve(__dirname, '..', 'api', 'internal', '_modules', 'finance-saldo.js'));

const calls = [];
const postCalls = [];

function makeDeps({ noAdmins = false } = {}) {
  calls.length = 0;
  postCalls.length = 0;
  return {
    q: (v) => encodeURIComponent(String(v == null ? '' : v)),
    sb: async (url, opts = {}) => {
      const call = { url, method: opts.method || 'GET', body: opts.body };
      calls.push(call);
      if (url.includes('raos_saldo_requests?id=eq.s1') && call.method === 'GET') {
        return [{
          id: 's1', request_no: 'SLD-20260829-0001', branch_id: 'b1', nominal: 50000,
          requested_at: '2026-08-29T00:00:00Z', driver_name: 'Andi', driver_login_id: 'DRV-001', staff_id: 'u-staff'
        }];
      }
      if (url.includes('user_profiles?id=eq.u-staff')) return [{ full_name: 'Budi' }];
      if (url.includes('branches?id=eq.b1')) return [{ name: 'Batam', slug: 'BTH' }];
      if (url.includes('user_profiles?role=in.(admin,direksi)')) return noAdmins ? [] : [{ id: 'u-admin', full_name: 'Admin', phone: '628123456789' }];
      if (url.includes('raos_create_notification')) {
        postCalls.push({ type: 'create_notification', body: opts.body });
        return ['notif-1'];
      }
      if (url.includes('notification_delivery_log')) {
        postCalls.push({ type: 'delivery_log', body: opts.body });
        return {};
      }
      if (url.includes('raos_ops_audit')) return [];
      return [];
    },
    sbAsActor: async () => { throw new Error('not expected'); },
    opsAudit: async (...args) => { calls.push({ type: 'opsAudit', args }); }
  };
}

const failures = [];
const pass = n => console.log('  ok  ' + n);
const fail = (n, e) => { failures.push({ n, e }); console.log('  FAIL  ' + n + '\n        ' + (e && e.message || e)); };

async function run() {
  // T1 — module wiring: dispatcher exposes finance_saldo_notify.
  try {
    const src = fs.readFileSync(path.resolve(__dirname, '..', 'api', 'internal', 'hris-contracts.js'), 'utf8');
    assert.ok(/finance_saldo_notify/.test(src), 'dispatcher must have finance_saldo_notify mode');
    assert.ok(/financeSaldo\.notifySaldo/.test(src), 'dispatcher must call financeSaldo.notifySaldo');
    pass('T1 dispatcher exposes finance_saldo_notify');
  } catch (e) { fail('T1 dispatcher exposes finance_saldo_notify', e); }

  // T2 — notifySaldo returns queued with deterministic dedup key.
  try {
    const financeSaldo = createFinanceSaldo(makeDeps());
    const req = { body: { request_id: 's1' } };
    const p = { id: 'u-staff', role: 'staff' };
    const r = await financeSaldo.notifySaldo(req, p);
    assert.strictEqual(r.status, 'queued');
    assert.strictEqual(r.delivery.reason, 'provider_not_configured', 'WA provider is not configured in test env');
    const create = postCalls.find(c => c.type === 'create_notification');
    assert.ok(create, 'raos_create_notification must be called');
    const payload = JSON.parse(create.body);
    assert.strictEqual(payload.p_dedup_key, 'saldo_wa_s1', 'dedup key must be deterministic');
    assert.strictEqual(payload.p_channel, 'whatsapp');
    assert.deepStrictEqual(payload.p_user_ids, ['u-admin']);
    pass('T2 notifySaldo queues deterministic WhatsApp event');
  } catch (e) { fail('T2 notifySaldo queues deterministic WhatsApp event', e); }

  // T3 — no admins → fail-closed, no notification mutation.
  try {
    const financeSaldo = createFinanceSaldo(makeDeps({ noAdmins: true }));
    const req = { body: { request_id: 's1' } };
    const p = { id: 'u-staff', role: 'staff' };
    const r = await financeSaldo.notifySaldo(req, p);
    assert.strictEqual(r.status, 'no_admin_recipient');
    const create = postCalls.find(c => c.type === 'create_notification');
    assert.ok(!create, 'no notification must be created without admin recipients');
    pass('T3 missing admin recipients fail-closed');
  } catch (e) { fail('T3 missing admin recipients fail-closed', e); }

  // T4 — provider_not_configured does not throw and logs delivery attempt.
  try {
    const financeSaldo = createFinanceSaldo(makeDeps());
    const req = { body: { request_id: 's1' } };
    const p = { id: 'u-staff', role: 'staff' };
    const r = await financeSaldo.notifySaldo(req, p);
    assert.strictEqual(r.delivery.reason, 'provider_not_configured');
    const logs = postCalls.filter(c => c.type === 'delivery_log');
    assert.strictEqual(logs.length, 1, 'delivery attempt must be logged');
    const log = JSON.parse(logs[0].body);
    assert.strictEqual(log.status, 'provider_not_configured');
    pass('T4 provider_not_configured logs auditable attempt');
  } catch (e) { fail('T4 provider_not_configured logs auditable attempt', e); }

  // T5 — missing request_id rejected up-front.
  try {
    const financeSaldo = createFinanceSaldo(makeDeps());
    const req = { body: {} };
    const p = { id: 'u-staff', role: 'staff' };
    await financeSaldo.notifySaldo(req, p);
    fail('T5 missing request_id must be rejected', new Error('did not throw'));
  } catch (e) {
    if (/request_id wajib/i.test(e.message)) pass('T5 missing request_id rejected up-front');
    else fail('T5 missing request_id rejected up-front', e);
  }

  // T6 — no new Vercel function for notification.
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
    assert.ok(routes.length <= 12, 'function count must remain <= 12 (found ' + routes.length + ')');
    pass('T6 no new Vercel function for WA notification (found ' + routes.length + ')');
  } catch (e) { fail('T6 no new Vercel function for WA notification', e); }

  console.log('');
  if (failures.length) { console.log('FAIL — ' + failures.length + ' assertion(s) failed'); process.exit(1); }
  console.log('ALL PASSED');
}

run().catch(e => { console.log('crash:', e); process.exit(1); });
