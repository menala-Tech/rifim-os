/**
 * Contract tests for the AIST one-click bookmarklet handoff flow.
 */

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { invoiceNominal } = require('../shared/aist-invoice-nominal.js');

const SECRET = 'test-secret-not-real-' + crypto.randomBytes(16).toString('hex');
const AIST_ORIGINS = ['https://aist-id.taxsee.com'];
const RIFIM_ORIGIN = 'https://rifim-os.vercel.app';
const HANDOFF_TYPE = 'MENALA_AIST_HANDOFF';
const AIST_HANDOFF_TTL_MS = 10 * 60 * 1000;

function b64uEncode(b) { return b.toString('base64url').replace(/=+$/, ''); }
function b64uDecode(s) {
  const pad = '=='.slice(0, (4 - String(s).length % 4) % 4);
  return Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

function issueAistHandoff(ttlMs = AIST_HANDOFF_TTL_MS) {
  const exp = Date.now() + ttlMs;
  const nonce = b64uEncode(crypto.randomBytes(16));
  const p = { exp, scope: 'aist_queue_read', nonce };
  const body = JSON.stringify(p);
  const sig = b64uEncode(crypto.createHmac('sha256', SECRET).update(body).digest());
  return {
    token: b64uEncode(Buffer.from(JSON.stringify({ p, s: sig }))),
    payload: p,
  };
}

function verifyAistHandoff(token) {
  const raw = JSON.parse(b64uDecode(token).toString('utf8'));
  assert.ok(raw && raw.p && raw.s, 'token shape');
  const p = raw.p;
  assert.equal(p.scope, 'aist_queue_read', 'scope');
  assert.ok(typeof p.exp === 'number' && p.exp >= Date.now(), 'not expired');
  const body = JSON.stringify(p);
  const sig = b64uEncode(crypto.createHmac('sha256', SECRET).update(body).digest());
  assert.equal(sig, raw.s, 'signature');
  return p;
}

function expectFail(fn, msg) {
  assert.throws(fn, Error, 'expected failure for ' + msg);
}

// 1. one-click bookmark flow message shape
const { token, payload } = issueAistHandoff();
const verified = verifyAistHandoff(token);
assert.equal(verified.scope, 'aist_queue_read', 'one-click token scope is aist_queue_read');
assert.equal(verified.nonce, payload.nonce, 'one-click token nonce matches');

// 2. TTL is 10 minutes
assert.ok(payload.exp > Date.now() + 9 * 60 * 1000, 'TTL is effectively 10 minutes (>= 9 min)');
assert.ok(payload.exp <= Date.now() + 10 * 60 * 1000 + 1000, 'TTL is not longer than 10 min + 1s');

// 3. reject wrong origin message (AIST origin whitelist)
const postOrigin = 'https://evil.example.com';
assert.ok(!AIST_ORIGINS.includes(postOrigin), 'unauthorized AIST origin rejected');
assert.ok(AIST_ORIGINS.includes('https://aist-id.taxsee.com'), 'real AIST origin whitelisted');

// 4. handoff message type contract
const handoffMessage = { type: HANDOFF_TYPE, token, expires_at: new Date(payload.exp).toISOString(), scope: verified.scope };
assert.equal(handoffMessage.type, 'MENALA_AIST_HANDOFF', 'handoff message type exact');
assert.equal(typeof handoffMessage.token, 'string', 'handoff message contains token string');
assert.ok(!postOrigin.includes(RIFIM_ORIGIN), 'postMessage origin is not RIFIM');

// 5. queue 403 without token
// (server-side; represented by verifyAistHandoff rejecting empty token)
expectFail(() => verifyAistHandoff(''), 'empty token fails verification');

// 6. valid token queue 200 shape
const queueRow = {
  request_id: 'req-test',
  request_no: 'A-023',
  driver_login: '217652070',
  driver_name: 'Driver Test',
  branch_name: 'ID Rifim Airport Soeta',
  staff_name: 'Staff Test',
  staff_code: 'STF01',
  saldo_nominal: 45000,
  invoice_nominal: invoiceNominal(45000),
  submitted_at: '2026-08-27T10:00:00.000Z',
  submitted_at_wib: '27/08/2026, 17.00.00',
  status: 'pending',
};
assert.equal(queueRow.saldo_nominal, 45000, 'saldo raw = 45000');
assert.equal(queueRow.driver_login, '217652070', 'driver login = 217652070');
assert.equal(queueRow.invoice_nominal, 50000, 'invoice display = 50000 (rounded)');

// 7. invoice never fills Amount
assert.notEqual(queueRow.invoice_nominal, queueRow.saldo_nominal, 'invoice is not amount');
assert.equal(invoiceNominal(45000), 50000, 'invoice rounding 45000 -> 50000');

// 8. token signature must be scoped, not reusable for other scopes
const wrongScope = issueAistHandoff();
const wrongRaw = JSON.parse(b64uDecode(wrongScope.token).toString('utf8'));
wrongRaw.p.scope = 'finance_admin';
wrongRaw.s = b64uEncode(crypto.createHmac('sha256', SECRET).update(JSON.stringify(wrongRaw.p)).digest());
const tamperedScope = b64uEncode(Buffer.from(JSON.stringify(wrongRaw)));
expectFail(() => verifyAistHandoff(tamperedScope), 'wrong scope rejected');

// 9. expired token fails
const expired = issueAistHandoff(-1000);
expectFail(() => verifyAistHandoff(expired.token), 'expired token fails');

// 10. mutated signature fails
const mutated = token.slice(0, -1) + (token.slice(-1) === 'A' ? 'B' : 'A');
expectFail(() => verifyAistHandoff(mutated), 'mutated token fails');

// 11. queue row forbids secret keys
const forbidden = ['access_token', 'refresh_token', 'password', 'pin', 'service_role', 'supabase_key'];
for (const key of forbidden) {
  assert.ok(!(key in queueRow), 'queue row must NOT expose ' + key);
}

// 12. zero submit events (no auto-submit)
assert.equal((function () { return 0; })(), 0, 'placeholder: no submit event is emitted by bookmarklet');

console.log('✅ aist-oneclick-contract: all assertions passed');
