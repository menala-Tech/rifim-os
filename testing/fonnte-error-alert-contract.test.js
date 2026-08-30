// Phase 6 — Fonnte Error/System Alert contract + architect remediation.
// Verifies:
//   1. reuse shared fonnte-wa (no duplicate HTTP sender)
//   2. info severity NOT dispatched by default
//   3. warning/critical eligible
//   4. deterministic alert key (module + event_code + sorted context)
//   5. cooldown enforced via stored log records
//   6. secret redaction (JWT, apikey, password)
//   7. FONNTE_ENABLED=false safe
//   8. provider failure never propagates
//   9. function count <=12
//  10. NO reference to raos_ops_audit / rifim_ops_audit_log (canonical sink = system_logs)
//  11. audit insert goes to system_logs schema
//  12. cooldown does NOT fail-open when schema OK (stored record found → cooldown)
//  13. real consumer integration exists (finance-payroll compute_payroll_hard_failure)
//  14. consumer alert failure never breaks business flow
// Run: node testing/fonnte-error-alert-contract.test.js
'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');

function loadAlert(deps) {
  const resolves = [
    path.resolve(__dirname, '..', 'api', 'internal', '_modules', 'notifications', 'error-alert.js'),
    path.resolve(__dirname, '..', 'api', 'internal', '_modules', 'notifications', 'fonnte-wa.js'),
    path.resolve(__dirname, '..', 'api', 'internal', '_modules', 'notifications', 'system-log.js'),
  ];
  for (const p of resolves) { try { delete require.cache[require.resolve(p)]; } catch (_) {} }
  const create = require(path.resolve(__dirname, '..', 'api', 'internal', '_modules', 'notifications', 'error-alert.js'));
  return create(deps);
}

function makeSb({ sysLogRows = [], throwOnGet = false } = {}) {
  const calls = [];
  const inserts = [];
  const sb = async (url, opts = {}) => {
    calls.push({ url, method: opts.method || 'GET', body: opts.body });
    // Whitelist assertion — MUST NOT touch legacy audit tables
    assert.ok(!/raos_ops_audit|rifim_ops_audit_log/.test(url), 'alert must not query legacy audit tables (url=' + url + ')');
    if (throwOnGet && !opts.method) throw new Error('DB down');
    if (url.includes('system_logs') && !opts.method) return sysLogRows;
    if (url.includes('system_logs') && opts.method === 'POST') {
      let body; try { body = JSON.parse(opts.body); } catch (_) { body = {}; }
      inserts.push(body);
      return {};
    }
    return [];
  };
  return { sb, calls, inserts };
}

const failures = [];
const pass = n => console.log('  ok  ' + n);
const fail = (n, e) => { failures.push({ n, e }); console.log('  FAIL  ' + n + '\n        ' + (e && e.stack || e && e.message || e)); };

async function run() {
  process.env.FONNTE_TOKEN = process.env.FONNTE_TOKEN || 'test-token-xxx';
  process.env.ADMIN_WA_PHONES = process.env.ADMIN_WA_PHONES || '6281234567890';
  delete process.env.FONNTE_ENABLED;

  // T1 — reuse shared fonnte-wa, no direct HTTP
  try {
    const src = fs.readFileSync(path.resolve(__dirname, '..', 'api', 'internal', '_modules', 'notifications', 'error-alert.js'), 'utf8');
    assert.ok(/require\(['"]\.\/fonnte-wa['"]\)/.test(src), 'must require ./fonnte-wa');
    assert.ok(!/UrlFetchApp|https:\/\/api\.fonnte\.com|fetch\(['"]https?:\/\//.test(src), 'MUST NOT contain direct HTTP');
    pass('T1 reuse shared fonnte-wa');
  } catch (e) { fail('T1 reuse shared fonnte-wa', e); }

  // T2 — info not dispatched
  try {
    const { sb } = makeSb();
    const alert = loadAlert({ sb });
    const r = await alert.emit({ severity: 'info', module: 'test', event_code: 'trivial', message: 'ping' });
    assert.strictEqual(r.sent, false);
    assert.strictEqual(r.reason, 'info_not_dispatched');
    pass('T2 info not dispatched');
  } catch (e) { fail('T2 info not dispatched', e); }

  // T3 — warning/critical eligible (dispatch_disabled when env off)
  try {
    const { sb } = makeSb();
    const alert = loadAlert({ sb });
    const rw = await alert.emit({ severity: 'warning', module: 'aist-runner', event_code: 'aist_slow', message: 'slow' });
    const rc = await alert.emit({ severity: 'critical', module: 'aist-runner', event_code: 'aist_exhausted', message: 'fail' });
    assert.strictEqual(rw.reason, 'dispatch_disabled');
    assert.strictEqual(rc.reason, 'dispatch_disabled');
    pass('T3 warning/critical eligible');
  } catch (e) { fail('T3 warning/critical eligible', e); }

  // T4 — deterministic alert key
  try {
    const { sb } = makeSb();
    const alert = loadAlert({ sb });
    const k1 = alert._internals.computeAlertKey({ module: 'm1', event_code: 'e1', context: { branch_id: 'b1', run_id: 'r1' } });
    const k2 = alert._internals.computeAlertKey({ module: 'm1', event_code: 'e1', context: { run_id: 'r1', branch_id: 'b1' } });
    const k3 = alert._internals.computeAlertKey({ module: 'm1', event_code: 'e1', context: { branch_id: 'b2', run_id: 'r1' } });
    assert.strictEqual(k1, k2);
    assert.notStrictEqual(k1, k3);
    assert.strictEqual(k1.length, 64);
    pass('T4 deterministic alert key');
  } catch (e) { fail('T4 deterministic alert key', e); }

  // T5 + T12 — cooldown enforced via stored log records
  try {
    // Compute the expected alert_key first, then seed a mock system_logs row containing it.
    const preAlert = loadAlert({ sb: async () => [] });
    const alertKey = preAlert._internals.computeAlertKey({ module: 'test', event_code: 'dup', context: { branch_id: 'b1' } });
    const { sb, inserts } = makeSb({ sysLogRows: [{ id: 'log-1', detail: JSON.stringify({ alert_key: alertKey }), created_at: new Date().toISOString(), status: 'dispatched' }] });
    const alert = loadAlert({ sb });
    const r = await alert.emit({ severity: 'critical', module: 'test', event_code: 'dup', message: 'repeat', context: { branch_id: 'b1' } });
    assert.strictEqual(r.sent, false);
    assert.strictEqual(r.reason, 'cooldown');
    // Cooldown audit MUST still be written with status=cooldown
    const cooldownRow = inserts.find(i => i.type === 'system_alert' && i.status === 'cooldown');
    assert.ok(cooldownRow, 'cooldown must produce system_logs row with status=cooldown');
    pass('T5+T12 cooldown enforced via stored records (system_logs)');
  } catch (e) { fail('T5+T12 cooldown enforced via stored records', e); }

  // T6 — secret redaction
  try {
    const { sb } = makeSb();
    const alert = loadAlert({ sb });
    const msg = alert._internals.composeMessage({
      severity: 'critical', module: 'test', event_code: 'leak',
      message: 'bearer eyJhbGciOiJIUzI1NiJ9.abc123def to endpoint',
      action: 'Reset apikey=sk_live_abcdefghijklmnop and retry',
      context: { branch_id: 'b1' },
    });
    assert.ok(!/eyJhbGciOiJIUzI1NiJ9\.abc/.test(msg));
    assert.ok(!/sk_live_abcdefghij/.test(msg));
    assert.ok(/REDACTED/.test(msg));
    pass('T6 secret redaction');
  } catch (e) { fail('T6 secret redaction', e); }

  // T7 — FONNTE_ENABLED=false safe
  try {
    process.env.FONNTE_ENABLED = 'false';
    const { sb } = makeSb();
    const alert = loadAlert({ sb });
    const r = await alert.emit({ severity: 'critical', module: 'test', event_code: 'ee', message: 'x' });
    assert.strictEqual(r.sent, false);
    assert.strictEqual(r.reason, 'dispatch_disabled');
    delete process.env.FONNTE_ENABLED;
    pass('T7 FONNTE_ENABLED=false safe');
  } catch (e) { fail('T7 FONNTE_ENABLED=false safe', e); }

  // T8 — provider failure never propagates
  try {
    const sb = async () => { throw new Error('DB down'); };
    const alert = loadAlert({ sb });
    let r;
    try { r = await alert.emit({ severity: 'critical', module: 'test', event_code: 'fail', message: 'x' }); }
    catch (e) { throw new Error('emit propagated exception: ' + e.message); }
    assert.strictEqual(typeof r, 'object');
    assert.strictEqual(r.sent, false);
    pass('T8 provider failure not propagated');
  } catch (e) { fail('T8 provider failure not propagated', e); }

  // T9 — function count <=12
  try {
    const apiDir = path.resolve(__dirname, '..', 'api');
    function walk(d) {
      let out = [];
      for (const name of fs.readdirSync(d)) {
        const full = path.join(d, name);
        const st = fs.statSync(full);
        if (st.isDirectory()) { if (name === '_lib' || name === '_modules') continue; out = out.concat(walk(full)); }
        else if (name.endsWith('.js')) out.push(full);
      }
      return out;
    }
    const fns = walk(apiDir);
    assert.ok(fns.length <= 12, `function count ${fns.length} must be <= 12`);
    pass(`T9 function count ${fns.length} <= 12`);
  } catch (e) { fail('T9 function count <= 12', e); }

  // T10 — no reference to legacy audit tables in new module + shared helper
  try {
    const files = [
      path.resolve(__dirname, '..', 'api', 'internal', '_modules', 'notifications', 'error-alert.js'),
      path.resolve(__dirname, '..', 'api', 'internal', '_modules', 'notifications', 'broadcast.js'),
      path.resolve(__dirname, '..', 'api', 'internal', '_modules', 'notifications', 'system-log.js'),
    ];
    for (const f of files) {
      const src = fs.readFileSync(f, 'utf8');
      // Comments referencing "raos_ops_audit" in doc-string are allowed (documenting the fix);
      // detect actual code use via REST paths or template literal patterns.
      assert.ok(!/\/rest\/v1\/raos_ops_audit/.test(src), path.basename(f) + ' must NOT query /rest/v1/raos_ops_audit');
      assert.ok(!/\/rest\/v1\/rifim_ops_audit_log/.test(src), path.basename(f) + ' must NOT query /rest/v1/rifim_ops_audit_log');
    }
    pass('T10 no reference to raos_ops_audit / rifim_ops_audit_log in code path');
  } catch (e) { fail('T10 no legacy audit table refs', e); }

  // T11 — audit insert goes to system_logs schema (canonical sink)
  try {
    const { sb, inserts } = makeSb();
    const alert = loadAlert({ sb });
    await alert.emit({ severity: 'critical', module: 'test', event_code: 'ins_schema', message: 'x' });
    const row = inserts.find(i => i.type === 'system_alert');
    assert.ok(row, 'must insert into system_logs with type=system_alert');
    assert.ok(row.process && /^test:ins_schema$/.test(row.process));
    assert.ok(['dispatched', 'cooldown', 'dispatch_disabled', 'provider_failed', 'internal_error'].includes(row.status));
    assert.ok(typeof row.detail === 'string', 'detail must be JSON string');
    const parsed = JSON.parse(row.detail);
    assert.ok(parsed.alert_key && parsed.severity === 'critical' && parsed.module === 'test');
    pass('T11 audit insert uses system_logs canonical schema');
  } catch (e) { fail('T11 audit insert uses system_logs', e); }

  // T13 — real consumer integration exists (finance-payroll compute_payroll_hard_failure)
  try {
    const src = fs.readFileSync(path.resolve(__dirname, '..', 'api', 'internal', 'hris-contracts.js'), 'utf8');
    assert.ok(/require\(['"]\.\/_modules\/notifications\/error-alert['"]\)/.test(src), 'hris-contracts must require error-alert');
    assert.ok(/alert\.emit\(/.test(src), 'hris-contracts must call alert.emit at least once');
    assert.ok(/compute_payroll_hard_failure/.test(src), 'payroll consumer wiring event_code present');
    assert.ok(/module:\s*['"]finance-payroll['"]/.test(src), 'payroll module tag present');
    pass('T13 real consumer wired (finance-payroll compute_payroll_hard_failure)');
  } catch (e) { fail('T13 real consumer wired', e); }

  // T14 — behavioral: computePayroll AWAITS alert.emit before rethrowing
  //   original RPC error. Serverless handler tidak boleh fire-and-forget
  //   karena pending Promise bisa terminated setelah throw.
  //
  //   4 sub-assertions per architect final fix:
  //   14a. catch path AWAITS alert.emit (delayed promise resolves BEFORE reject)
  //   14b. original err is still re-thrown (not alert error)
  //   14c. alert.emit throwing cannot replace original error (defensive guard)
  //   14d. happy path does not call alert.emit
  try {
    // Extract computePayroll body from hris-contracts.js source and rebuild
    // as isolated async function with injected mocks. Behavioral, not grep.
    const src = fs.readFileSync(path.resolve(__dirname, '..', 'api', 'internal', 'hris-contracts.js'), 'utf8');
    const m = src.match(/async function computePayroll\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/);
    assert.ok(m, 'computePayroll body must be extractable');
    const body = m[1];
    const AsyncFunction = (async function(){}).constructor;
    // Rebuild with deps as parameters so we can inject mocks
    const rebuilt = new AsyncFunction('financeWrite', 'sb', 'monthDate', 'num', 'alert', 'req', 'p', body);

    // ── 14a + 14b: catch path awaits + re-throws original ────────────────
    {
      const events = [];
      const originalErr = new Error('RPC hard failure: raos_compute_payroll_month timeout');
      let alertResolved = false;
      const alert = {
        emit: (input) => new Promise((resolve) => {
          events.push({ t: 'alert_emit_called', input });
          // Delay 30ms — if code doesn't await, this resolves LONG after throw.
          setTimeout(() => {
            alertResolved = true;
            events.push({ t: 'alert_emit_resolved' });
            resolve({ sent: false, reason: 'dispatch_disabled', alert_key: 'k' });
          }, 30);
        }),
      };
      const mocks = {
        financeWrite: () => {},
        sb: async () => { events.push({ t: 'sb_throw' }); throw originalErr; },
        monthDate: () => '2026-09-01',
        num: (v, d = 0) => Number.isFinite(Number(v)) ? Number(v) : d,
      };
      let caught;
      try { await rebuilt(mocks.financeWrite, mocks.sb, mocks.monthDate, mocks.num, alert, { body: { month: '2026-09' }, headers: {} }, { id: 'admin-1', role: 'admin' }); }
      catch (e) { caught = e; events.push({ t: 'compute_reject', msg: e && e.message }); }

      assert.strictEqual(caught, originalErr, '14b: caught error must be the original RPC error identity');
      assert.strictEqual(alertResolved, true, '14a: alert.emit promise must have resolved BEFORE computePayroll rejects (proves await)');
      // Order check: alert_emit_resolved must appear BEFORE compute_reject
      const iResolved = events.findIndex(e => e.t === 'alert_emit_resolved');
      const iReject = events.findIndex(e => e.t === 'compute_reject');
      assert.ok(iResolved !== -1 && iReject !== -1 && iResolved < iReject, '14a: order events must be alert_resolved BEFORE compute_reject');
    }

    // ── 14c: alert.emit throwing cannot replace original error ────────────
    {
      const originalErr = new Error('RPC boom');
      const alert = { emit: async () => { throw new Error('ALERT INTERNAL BOOM (should be swallowed)'); } };
      const mocks = {
        financeWrite: () => {},
        sb: async () => { throw originalErr; },
        monthDate: () => '2026-09-01',
        num: (v, d = 0) => Number.isFinite(Number(v)) ? Number(v) : d,
      };
      let caught;
      try { await rebuilt(mocks.financeWrite, mocks.sb, mocks.monthDate, mocks.num, alert, { body: {}, headers: {} }, { id: 'a', role: 'admin' }); }
      catch (e) { caught = e; }
      assert.strictEqual(caught, originalErr, '14c: original err must survive even when alert.emit throws');
    }

    // ── 14d: happy path does not call alert.emit ─────────────────────────
    {
      let alertCallCount = 0;
      const alert = { emit: async () => { alertCallCount++; return { sent: true }; } };
      const mocks = {
        financeWrite: () => {},
        sb: async () => 42,   // RPC returns count
        monthDate: () => '2026-09-01',
        num: (v, d = 0) => Number.isFinite(Number(v)) ? Number(v) : d,
      };
      const r = await rebuilt(mocks.financeWrite, mocks.sb, mocks.monthDate, mocks.num, alert, { body: {}, headers: {} }, { id: 'a', role: 'admin' });
      assert.deepStrictEqual(r, { processed: 42, month: '2026-09-01' }, '14d: happy path returns normal result');
      assert.strictEqual(alertCallCount, 0, '14d: happy path must NEVER call alert.emit');
    }

    pass('T14 behavioral: await alert, preserve original err, happy path clean');
  } catch (e) { fail('T14 behavioral await + original err + happy path clean', e); }

  if (failures.length) { console.log('\nFAIL — ' + failures.length + ' assertion(s) failed'); process.exit(1); }
  else { console.log('\nALL PASSED'); }
}

run().catch(e => { console.error(e); process.exit(1); });
