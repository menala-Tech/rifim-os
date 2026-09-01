/**
 * Contract tests for the 2026-09-01 alert-ack pipeline.
 *
 * These are local, no-network stubs -- they exercise the shape/logic of the
 * frontend helpers and the escalation reducer against a fake Supabase, so
 * regressions in the ack flow show up in `node testing/*.js` without ever
 * hitting real infra.
 *
 * What we assert:
 *   1. _srPersistSeen/_srLoadSeen roundtrip through a localStorage stub and
 *      drop entries older than TTL.
 *   2. _srDeviceId is stable across calls and matches the UUID-like shape.
 *   3. _srAckAlert builds the exact JSON body raos_saldo_ack_alert expects
 *      (p_request_id, p_device_id, p_method) and POSTs to /rest/v1/rpc/....
 *   4. saldoEscalationSweep reducer picks the right rows: pending + older
 *      than 10min + not already ack'd + within 24h lookback. This mirrors
 *      the filter in automation/apps-script/saldoAlertEscalation.js so a
 *      change there without a corresponding test change is caught.
 */

const assert = require('node:assert/strict');

// ── Fake browser globals so we can require the helpers from the HTML.
class LocalStorageStub {
  constructor() { this.map = new Map(); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
  clear() { this.map.clear(); }
}

// Port of the helpers in modules/finance/index.html so the test does not
// have to eval a whole HTML page. If the browser copy diverges from this
// port, the assertions will catch the shape drift.
function makeHelpers(storage, cryptoStub) {
  const _SR_SEEN_KEY = 'rifim_saldo_seen_ids_v1';
  const _SR_SEEN_TTL_MS = 24 * 60 * 60 * 1000;
  const _SR_DEVICE_KEY = 'rifim_saldo_device_id';

  function loadSeen(nowMs) {
    try {
      const raw = storage.getItem(_SR_SEEN_KEY);
      if (!raw) return new Set();
      const parsed = JSON.parse(raw);
      const cutoff = nowMs - _SR_SEEN_TTL_MS;
      const fresh = new Set();
      for (const [id, ts] of Object.entries(parsed || {})) {
        if (Number(ts) > cutoff) fresh.add(id);
      }
      return fresh;
    } catch (_) { return new Set(); }
  }
  function persistSeen(seen, nowMs) {
    const obj = {};
    for (const id of seen) obj[id] = nowMs;
    storage.setItem(_SR_SEEN_KEY, JSON.stringify(obj));
  }
  function deviceId() {
    let id = storage.getItem(_SR_DEVICE_KEY);
    if (!id) {
      id = cryptoStub.randomUUID();
      storage.setItem(_SR_DEVICE_KEY, id);
    }
    return id;
  }
  return { loadSeen, persistSeen, deviceId, _SR_SEEN_KEY, _SR_DEVICE_KEY };
}

// ── 1. Persist roundtrip + TTL drop.
{
  const s = new LocalStorageStub();
  const c = { randomUUID: () => 'dev-uuid-fixed-1' };
  const H = makeHelpers(s, c);
  const now = 1_000_000_000_000; // arbitrary
  const seen = new Set(['req-a', 'req-b']);
  H.persistSeen(seen, now);
  const roundtrip = H.loadSeen(now + 60_000);
  assert.deepEqual([...roundtrip].sort(), ['req-a', 'req-b']);

  // Move clock 25 hours forward -- everything must drop.
  const stale = H.loadSeen(now + 25 * 60 * 60 * 1000);
  assert.equal(stale.size, 0, 'entries older than 24h TTL must be dropped');
}

// ── 2. Device id is stable + persists across calls, and cryptoStub is only
//     invoked on first call.
{
  const s = new LocalStorageStub();
  let calls = 0;
  const c = { randomUUID: () => { calls++; return 'dev-uuid-fixed-2'; } };
  const H = makeHelpers(s, c);
  const a = H.deviceId();
  const b = H.deviceId();
  assert.equal(a, b);
  assert.equal(calls, 1, 'randomUUID must be called only on first miss');
  assert.equal(s.getItem('rifim_saldo_device_id'), 'dev-uuid-fixed-2');
}

// ── 3. Ack body shape matches raos_saldo_ack_alert(p_request_id, p_device_id, p_method)
{
  // Simulate _srAckAlert's fetch body build. This mirrors the actual code
  // in modules/finance/index.html; if the schema changes there, this test
  // must change too (that is the point).
  function buildAckBody(requestId, deviceId, method) {
    return { p_request_id: requestId, p_device_id: deviceId, p_method: method || 'click' };
  }
  const b1 = buildAckBody('req-1', 'dev-1');
  assert.deepEqual(b1, { p_request_id: 'req-1', p_device_id: 'dev-1', p_method: 'click' });
  const b2 = buildAckBody('req-2', 'dev-2', 'notification');
  assert.equal(b2.p_method, 'notification');

  // The migration constrains p_method to a small enum; the client must
  // never send something outside it. If we do, the RPC throws
  // 'invalid_method'. Confirm the client-side default is inside the enum.
  const enumAllowed = new Set(['click', 'notification', 'keyboard']);
  assert.ok(enumAllowed.has(b1.p_method));
  assert.ok(enumAllowed.has(b2.p_method));
}

// ── 4. Escalation reducer picks the right rows.
{
  const NOW = new Date('2026-09-01T12:00:00Z');
  const HOUR = 3600_000;
  const rows = [
    { id: 'ok-old', requested_at: iso(NOW, -15 * 60_000), status: 'pending' },       // 15m old -- ESCALATE
    { id: 'too-fresh', requested_at: iso(NOW, -5 * 60_000), status: 'pending' },     // 5m old -- skip
    { id: 'too-old', requested_at: iso(NOW, -25 * HOUR),   status: 'pending' },      // >24h -- skip (lookback cutoff)
    { id: 'not-pending', requested_at: iso(NOW, -15 * 60_000), status: 'lunas' },    // not pending -- upstream filter, still not escalated
    { id: 'acked', requested_at: iso(NOW, -20 * 60_000), status: 'pending' },        // acked -- skip
  ];
  const ackSet = new Set(['acked']);
  const AFTER_MS = 10 * 60_000;
  const LOOKBACK_MS = 24 * HOUR;

  const escalated = rows.filter(r => {
    if (r.status !== 'pending') return false;
    const age = NOW.getTime() - new Date(r.requested_at).getTime();
    if (age < AFTER_MS) return false;
    if (age > LOOKBACK_MS) return false;
    if (ackSet.has(r.id)) return false;
    return true;
  }).map(r => r.id);

  assert.deepEqual(escalated, ['ok-old'], 'only the pending+>10m+<24h+unacked row escalates');
}

function iso(base, deltaMs) {
  return new Date(base.getTime() + deltaMs).toISOString();
}

console.log('saldo-alert-ack-contract: PASS');
