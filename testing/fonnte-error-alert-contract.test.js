// Phase 6 — Fonnte Error/System Alert contract.
// Verifies:
//   1. reuse shared fonnte-wa (no duplicate HTTP sender)
//   2. info severity NOT dispatched by default
//   3. warning/critical eligible
//   4. deterministic alert key (module + event_code + normalized_context)
//   5. cooldown enforced (10 min)
//   6. secret redaction (JWT, sb_secret_, apikey, password)
//   7. FONNTE_ENABLED=false safe (no dispatch, no throw)
//   8. provider failure never propagates
//   9. function count <=12
// Run: node testing/fonnte-error-alert-contract.test.js
'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');

// Fresh require to reset state per test — no shared caching mistakes.
function loadAlert(deps) {
  delete require.cache[require.resolve(path.resolve(__dirname, '..', 'api', 'internal', '_modules', 'notifications', 'error-alert.js'))];
  delete require.cache[require.resolve(path.resolve(__dirname, '..', 'api', 'internal', '_modules', 'notifications', 'fonnte-wa.js'))];
  const create = require(path.resolve(__dirname, '..', 'api', 'internal', '_modules', 'notifications', 'error-alert.js'));
  return create(deps);
}

function makeSb({ auditRows = [] } = {}) {
  const calls = [];
  const sb = async (url, opts = {}) => {
    calls.push({ url, method: opts.method || 'GET', body: opts.body });
    if (url.includes('raos_ops_audit') && !opts.method) return auditRows;
    if (url.includes('raos_ops_audit') && opts.method === 'POST') return {};
    return [];
  };
  return { sb, calls };
}

const failures = [];
const pass = n => console.log('  ok  ' + n);
const fail = (n, e) => { failures.push({ n, e }); console.log('  FAIL  ' + n + '\n        ' + (e && e.stack || e && e.message || e)); };

async function run() {
  // Baseline env — ensure predictable defaults
  process.env.FONNTE_TOKEN = process.env.FONNTE_TOKEN || 'test-token-xxx';
  process.env.ADMIN_WA_PHONES = process.env.ADMIN_WA_PHONES || '6281234567890';
  delete process.env.FONNTE_ENABLED; // default: OFF

  // T1 — reuse shared fonnte-wa (no duplicate HTTP sender)
  try {
    const src = fs.readFileSync(path.resolve(__dirname, '..', 'api', 'internal', '_modules', 'notifications', 'error-alert.js'), 'utf8');
    assert.ok(/require\(['"]\.\/fonnte-wa['"]\)/.test(src), 'error-alert must require ./fonnte-wa');
    assert.ok(!/UrlFetchApp|https:\/\/api\.fonnte\.com|fetch\(['"]https?:\/\//.test(src), 'error-alert MUST NOT contain direct HTTP sender');
    pass('T1 reuse shared fonnte-wa, no duplicate HTTP sender');
  } catch (e) { fail('T1 reuse shared fonnte-wa', e); }

  // T2 — info NOT dispatched by default
  try {
    const { sb } = makeSb();
    const alert = loadAlert({ sb });
    const r = await alert.emit({ severity: 'info', module: 'test', event_code: 'trivial', message: 'ping' });
    assert.strictEqual(r.sent, false);
    assert.strictEqual(r.reason, 'info_not_dispatched');
    pass('T2 info severity not dispatched');
  } catch (e) { fail('T2 info severity not dispatched', e); }

  // T3 — warning/critical eligible (attempts dispatch — FONNTE_ENABLED off → dispatch_disabled)
  try {
    const { sb } = makeSb();
    const alert = loadAlert({ sb });
    const rw = await alert.emit({ severity: 'warning', module: 'aist-runner', event_code: 'aist_slow', message: 'AIST slow' });
    const rc = await alert.emit({ severity: 'critical', module: 'aist-runner', event_code: 'aist_exhausted', message: 'AIST 5x retry fail' });
    assert.notStrictEqual(rw.reason, 'info_not_dispatched');
    assert.notStrictEqual(rc.reason, 'info_not_dispatched');
    // With FONNTE_ENABLED unset → reason 'dispatch_disabled' (safe)
    assert.strictEqual(rw.reason, 'dispatch_disabled');
    assert.strictEqual(rc.reason, 'dispatch_disabled');
    pass('T3 warning/critical eligible, dispatch_disabled when FONNTE_ENABLED=false');
  } catch (e) { fail('T3 warning/critical eligible', e); }

  // T4 — deterministic alert key
  try {
    const { sb } = makeSb();
    const alert = loadAlert({ sb });
    const k1 = alert._internals.computeAlertKey({ module: 'm1', event_code: 'e1', context: { branch_id: 'b1', run_id: 'r1' } });
    const k2 = alert._internals.computeAlertKey({ module: 'm1', event_code: 'e1', context: { run_id: 'r1', branch_id: 'b1' } });
    const k3 = alert._internals.computeAlertKey({ module: 'm1', event_code: 'e1', context: { branch_id: 'b2', run_id: 'r1' } });
    assert.strictEqual(k1, k2, 'same context (order-independent) → same hash');
    assert.notStrictEqual(k1, k3, 'different context → different hash');
    assert.strictEqual(k1.length, 64, 'sha256 hex = 64 chars');
    pass('T4 deterministic alert key');
  } catch (e) { fail('T4 deterministic alert key', e); }

  // T5 — cooldown enforced (mock audit returns a recent row)
  try {
    const { sb } = makeSb({ auditRows: [{ id: 'existing-alert' }] });
    const alert = loadAlert({ sb });
    const r = await alert.emit({ severity: 'critical', module: 'test', event_code: 'dup', message: 'repeat' });
    assert.strictEqual(r.sent, false);
    assert.strictEqual(r.reason, 'cooldown');
    pass('T5 cooldown enforced when recent audit row exists');
  } catch (e) { fail('T5 cooldown enforced', e); }

  // T6 — secret redaction
  try {
    const { sb } = makeSb();
    const alert = loadAlert({ sb });
    const msg = alert._internals.composeMessage({
      severity: 'critical', module: 'test', event_code: 'leak_test',
      message: 'Failed request bearer eyJhbGciOiJIUzI1NiJ9.abc123 to endpoint',
      action: 'Reset apikey=sk_live_abcdefghijklmnop12345 and try again',
      context: { branch_id: 'b1' },
    });
    assert.ok(!/eyJhbGciOiJIUzI1NiJ9\.abc/.test(msg), 'JWT bearer must be redacted');
    assert.ok(!/sk_live_abcdefghij/.test(msg), 'apikey pattern must be redacted');
    assert.ok(/REDACTED/.test(msg), 'redaction marker present');
    pass('T6 secret redaction');
  } catch (e) { fail('T6 secret redaction', e); }

  // T7 — FONNTE_ENABLED=false safe (no throw, no dispatch)
  try {
    process.env.FONNTE_ENABLED = 'false';
    const { sb } = makeSb();
    const alert = loadAlert({ sb });
    const r = await alert.emit({ severity: 'critical', module: 'test', event_code: 'ee', message: 'test' });
    assert.strictEqual(r.sent, false);
    assert.strictEqual(r.reason, 'dispatch_disabled');
    delete process.env.FONNTE_ENABLED;
    pass('T7 FONNTE_ENABLED=false safe');
  } catch (e) { fail('T7 FONNTE_ENABLED=false safe', e); }

  // T8 — provider failure never propagates (sb throws — emit returns not throws)
  try {
    const sb = async () => { throw new Error('DB down'); };
    const alert = loadAlert({ sb });
    let r;
    try { r = await alert.emit({ severity: 'critical', module: 'test', event_code: 'fail', message: 'x' }); }
    catch (e) { throw new Error('emit propagated exception: ' + e.message); }
    // With sb throwing on cooldown check → fail-open path returns dispatch attempt.
    // Then fonnte.send with unset FONNTE_ENABLED → dispatch_disabled, sent=false.
    assert.strictEqual(typeof r, 'object');
    assert.strictEqual(r.sent, false);
    pass('T8 provider failure does not propagate');
  } catch (e) { fail('T8 provider failure does not propagate', e); }

  // T9 — function count <= 12 (no new Vercel function file)
  try {
    const apiDir = path.resolve(__dirname, '..', 'api');
    function walk(d) {
      let out = [];
      for (const name of fs.readdirSync(d)) {
        const full = path.join(d, name);
        const st = fs.statSync(full);
        if (st.isDirectory()) {
          if (name === '_lib' || name === '_modules') continue;
          out = out.concat(walk(full));
        } else if (name.endsWith('.js')) {
          out.push(full);
        }
      }
      return out;
    }
    const fns = walk(apiDir);
    assert.ok(fns.length <= 12, `function count ${fns.length} must be <= 12`);
    pass(`T9 function count ${fns.length} <= 12`);
  } catch (e) { fail('T9 function count <= 12', e); }

  if (failures.length) { console.log('\nFAIL — ' + failures.length + ' assertion(s) failed'); process.exit(1); }
  else { console.log('\nALL PASSED'); }
}

run().catch(e => { console.error(e); process.exit(1); });
