/**
 * Contract tests for the AIST handoff token.
 */

const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const SECRET = 'test-secret-not-real-' + crypto.randomBytes(16).toString('hex');

function b64uEncode(b) { return b.toString('base64url').replace(/=+$/, ''); }
function b64uDecode(s) {
  const pad = '=='.slice(0, (4 - String(s).length % 4) % 4);
  return Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

function issueAistHandoff(ttlMs = 10 * 60 * 1000) {
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

const { token, payload } = issueAistHandoff();
assert.equal(typeof token, 'string', 'token is string');
assert.ok(token.length >= 32, 'token is long enough');
const verified = verifyAistHandoff(token);
assert.equal(verified.scope, 'aist_queue_read', 'verified scope');
assert.equal(verified.nonce, payload.nonce, 'verified nonce');
assert.equal(verified.exp, payload.exp, 'verified exp');

const bad = issueAistHandoff();
const mutated = token.slice(0, -1) + (token.slice(-1) === 'A' ? 'B' : 'A');
expectFail(() => verifyAistHandoff(mutated), 'bad token');

const expired = issueAistHandoff(-1000);
expectFail(() => verifyAistHandoff(expired.token), 'expired token');

const otherSecret = issueAistHandoff(10000);
const otherRaw = JSON.parse(b64uDecode(otherSecret.token).toString('utf8'));
otherRaw.s = b64uEncode(crypto.createHmac('sha256', 'wrong-secret').update(JSON.stringify(otherRaw.p)).digest());
const tampered = b64uEncode(Buffer.from(JSON.stringify(otherRaw)));
expectFail(() => verifyAistHandoff(tampered), 'wrong secret signature');

console.log('✅ aist-handoff-contract: all assertions passed');
