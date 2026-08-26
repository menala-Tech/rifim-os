/**
 * finance-saldo-semi-v2.test.js
 * Kontrak semi-auto AIST V2 (Finance → clipboard payload → bookmarklet).
 *
 * Cakupan:
 *   - payload builder di shared/aist-finance-semi.js
 *   - decode + validate di bookmarklet aist-fill-v2.source.js
 *   - tidak ada secret dalam payload
 *   - TTL enforcement
 *   - versi + source guard
 *
 * Run:
 *   node testing/finance-saldo-semi-v2.test.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

const root = path.join(__dirname, '..');
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }

console.log('=== RIFIM OS Finance Saldo Semi-Auto V2 contract ===');

// ── Minimal DOM stub: cukup untuk semi.js decorate() skip (no /finance path)
// dan untuk hook __AIST_FINANCE_SEMI__ terekspos.
function loadSemi() {
  const src = read('shared/aist-finance-semi.js');
  const win = {
    location: { pathname: '/finance/' },
    navigator: { clipboard: { writeText: async () => {} } },
    document: {
      readyState: 'complete',
      addEventListener: () => {},
      body: { querySelectorAll: () => [] },
      querySelectorAll: () => [],
      createElement: () => ({ style: {}, addEventListener: () => {}, setAttribute: () => {} }),
    },
    MutationObserver: function () { this.observe = () => {}; },
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    unescape: global.unescape || ((s) => decodeURIComponent(s.replace(/%/g, '%25'))),
    encodeURIComponent: encodeURIComponent,
    console: console,
    alert: () => {},
  };
  win.window = win;
  win.globalThis = win;
  vm.createContext(win);
  vm.runInContext(src, win);
  return win.__AIST_FINANCE_SEMI__;
}

const semi = loadSemi();
assert.ok(semi && typeof semi.buildSemiPayload === 'function', 'semi module exports test hook');

// ── 1. Payload builder: happy path 45k ─────────────────────────────────
const row45 = {
  request_id: 'req-abc-123',
  driver_login: '200108666',
  nominal: 45000,
  driver_name: 'Mohammad Wahyudi',
  branch_name: 'CGK',
  staff_name: 'Bobby',
};
const p45 = semi.buildSemiPayload(row45);
assert.strictEqual(p45.version, 2, 'version=2');
assert.strictEqual(p45.request_id, 'req-abc-123');
assert.strictEqual(p45.driver_login, '200108666');
assert.strictEqual(p45.nominal, 45000, 'RAW nominal 45000, bukan invoice-rounded');
assert.strictEqual(p45.source, 'RIFIM_FINANCE_SALDO_RAOS');
assert.ok(!('access_token' in p45), 'tidak boleh mengandung access_token');
assert.ok(!('token' in p45),        'tidak boleh mengandung token');
assert.ok(!('bearer' in p45),       'tidak boleh mengandung bearer');
assert.ok(!('pin' in p45),          'tidak boleh mengandung pin');
console.log('  ok  builder 45k valid + no-secret guard');

// ── 2. Nominal RAW 95k / 200k ──────────────────────────────────────────
assert.strictEqual(semi.buildSemiPayload({ ...row45, nominal: 95000 }).nominal, 95000);
assert.strictEqual(semi.buildSemiPayload({ ...row45, nominal: 200000 }).nominal, 200000);
console.log('  ok  builder 95k + 200k RAW preserved');

// ── 3. Validasi negatif ────────────────────────────────────────────────
assert.throws(() => semi.buildSemiPayload({ ...row45, request_id: '' }),  /request_id/, 'reject empty request_id');
assert.throws(() => semi.buildSemiPayload({ ...row45, driver_login: '' }), /driver_login/, 'reject empty login');
assert.throws(() => semi.buildSemiPayload({ ...row45, driver_login: 'A1B2C3' }), /digit-only/, 'reject non-digit login');
assert.throws(() => semi.buildSemiPayload({ ...row45, nominal: 0 }),       /nominal/, 'reject zero nominal');
assert.throws(() => semi.buildSemiPayload({ ...row45, nominal: -100 }),    /nominal/, 'reject negative nominal');
console.log('  ok  builder validation rules');

// ── 4. parseNominal helper: strip "Rp" + separators ───────────────────
assert.strictEqual(semi.parseNominal('Rp45.000'), 45000);
assert.strictEqual(semi.parseNominal('Rp 200.000'), 200000);
assert.strictEqual(semi.parseNominal('45,000'), 45000);
assert.strictEqual(semi.parseNominal(''),        0);
assert.strictEqual(semi.parseNominal(null),      0);
console.log('  ok  parseNominal strips Rp + separators');

// ── 5. encodePayload roundtrip via bookmarklet decoder ────────────────
const encoded = semi.encodePayload(p45);
assert.ok(encoded.indexOf('MENALA_AIST_V2:') === 0, 'clipboard prefix present');

// Bookmarklet decodeAndValidate diekstrak lewat regex + eval bertopeng.
const bookmarkletSrc = read('automation/aist-bookmarklet/aist-fill-v2.source.js');
// Ambil hanya fungsi decodeAndValidate + eksekusi dalam sandbox.
// CRLF-tolerant: bookmarklet file may be checked out with \r\n on Windows.
const fnMatch = bookmarkletSrc.match(/function decodeAndValidate\([\s\S]*?\r?\n  \}\r?\n/);
assert.ok(fnMatch, 'decodeAndValidate ditemukan di bookmarklet');

const ctx = {
  atob: (b64) => Buffer.from(b64, 'base64').toString('binary'),
  escape: global.escape || ((s) => encodeURIComponent(s).replace(/%(?![0-9A-F]{2})/g, '%25')),
  decodeURIComponent: decodeURIComponent,
  JSON: JSON,
  Number: Number,
  Date: Date,
  Object: Object,
  Error: Error,
  String: String,
};
vm.createContext(ctx);
vm.runInContext(fnMatch[0] + '\nglobalThis.__decode = decodeAndValidate;', ctx);

// Set konstanta yang dipakai fungsi:
vm.runInContext('var PREFIX = "MENALA_AIST_V2:"; var TTL_MS = 10*60*1000;', ctx);
// Re-eval agar closure baru menangkap konstanta:
vm.runInContext(fnMatch[0] + '\nglobalThis.__decode = decodeAndValidate;', ctx);

const decoded = ctx.__decode(encoded);
assert.strictEqual(decoded.driver_login, '200108666');
assert.strictEqual(decoded.nominal, 45000);
assert.strictEqual(decoded.version, 2);
assert.strictEqual(decoded.source, 'RIFIM_FINANCE_SALDO_RAOS');
console.log('  ok  encode → decode roundtrip preserves login + nominal + version');

// ── 6. TTL enforcement (payload kedaluwarsa) ──────────────────────────
const stale = { ...p45, prepared_at: new Date(Date.now() - 11 * 60 * 1000).toISOString() };
const staleEncoded = semi.encodePayload(stale);
assert.throws(() => ctx.__decode(staleEncoded), /kedaluwarsa/i, 'reject payload >10 menit');
console.log('  ok  TTL enforced (10 menit)');

// ── 7. Prefix wrong / bukan MENALA_AIST_V2 ────────────────────────────
assert.throws(() => ctx.__decode(''),                     /kosong/,           'reject empty clipboard');
assert.throws(() => ctx.__decode('SOMETHING_ELSE:abc'),   /MENALA_AIST_V2/,   'reject wrong prefix');
console.log('  ok  prefix guard');

// ── 8. Unknown field guard (anti-secret smuggling) ─────────────────────
const smuggled = {
  ...p45,
  access_token: 'eyJ.evil.token',
  prepared_at: new Date().toISOString(),
};
const smuggledEncoded = 'MENALA_AIST_V2:' + Buffer.from(JSON.stringify(smuggled), 'utf8').toString('base64');
assert.throws(() => ctx.__decode(smuggledEncoded), /tidak dikenal/, 'reject field access_token');
console.log('  ok  unknown-field guard (secret smuggling blocked)');

// ── 9. Version guard ──────────────────────────────────────────────────
const v1 = { ...p45, version: 1, prepared_at: new Date().toISOString() };
const v1Encoded = 'MENALA_AIST_V2:' + Buffer.from(JSON.stringify(v1), 'utf8').toString('base64');
assert.throws(() => ctx.__decode(v1Encoded), /tidak didukung/, 'reject version != 2');
console.log('  ok  version guard');

// ── 10. Bookmarklet code must NOT contain forbidden strings ──────────
// (strip comments dulu — dokblock header memang mencantumkan hal-hal yang
// TIDAK dilakukan bookmarklet; yang dilarang adalah pemakaian di kode.)
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}
const bookmarkletCode = stripComments(bookmarkletSrc);
const forbidden = [
  'aistQueue',
  'aistConsume',
  'aistClearQueue',
  'finance_saldo_raos_mark_paid',
  'finance_saldo_raos_list',
  'rifim_auth',
  'access_token',
];
forbidden.forEach((needle) => {
  assert.ok(bookmarkletCode.indexOf(needle) === -1,
    'bookmarklet code TIDAK boleh mengandung "' + needle + '"');
});
console.log('  ok  bookmarklet bebas dari GAS queue / auth / mark_paid');

// ── 11. Bookmarklet: no auto-submit ──────────────────────────────────
[
  /form\.submit\s*\(/,
  /click\s*\(\s*\)/,
].forEach((rx) => {
  assert.ok(!rx.test(bookmarkletSrc),
    'bookmarklet TIDAK boleh auto-submit / click: ' + rx);
});
console.log('  ok  bookmarklet tidak submit / click otomatis');

// ── 12. shared/aist-finance-semi.js: no backend mutation ──────────────
const semiSrc = read('shared/aist-finance-semi.js');
[
  'aist-runner',
  'aist-agent/manual-request',
  'finance_saldo_raos_mark_paid',
  'raos_saldo_mark_paid',
  'markPaid',
].forEach((needle) => {
  assert.ok(semiSrc.indexOf(needle) === -1,
    'aist-finance-semi.js TIDAK boleh mengandung "' + needle + '"');
});
console.log('  ok  Finance semi module bebas backend mutation');

// ── 13. Item 1 (2026-08-26): readRowFromButton prefers RAW saldo nominal
//        (data-saldo-nominal) over invoice-rounded data-nominal.
// Regression untuk field-UAT: 45k → invoice 50k, payload harus tetap 45000.
assert.ok(typeof semi.readRowFromButton === 'function', 'readRowFromButton exposed');
function mkBtnStub(ds) {
  return {
    dataset: ds,
    closest: () => ({ cells: [{}, { textContent: 'CGK' }, { textContent: 'Bobby' }] }),
  };
}
[
  { raw: 45000,  invoice: 50000  },
  { raw: 95000,  invoice: 100000 },
  { raw: 140000, invoice: 150000 },
  { raw: 195000, invoice: 200000 },
  { raw: 200000, invoice: 200000 },
].forEach(({ raw, invoice }) => {
  const btn = mkBtnStub({
    markSaldo: 'req-' + raw,
    driverLogin: '200108666',
    driverName: 'Wahyudi',
    requestNo: 'A-1',
    nominal: String(invoice),        // display invoice (bug source)
    saldoNominal: String(raw),       // RAW saldo (fix)
  });
  const row = semi.readRowFromButton(btn);
  assert.strictEqual(row.nominal, raw,
    `raw ${raw} / invoice ${invoice} → readRowFromButton.nominal=${row.nominal} (expected ${raw})`);
  const payload = semi.buildSemiPayload(row);
  assert.strictEqual(payload.nominal, raw,
    `payload.nominal must be RAW ${raw}, got ${payload.nominal}`);
});
console.log('  ok  Item 1 — RAW saldo nominal preserved end-to-end (45k/95k/140k/195k/200k)');

// Fallback: legacy button tanpa data-saldo-nominal → tetap pakai data-nominal
// (jangan sampai patch me-null-kan value baris lama saat progressive rollout).
const legacyBtn = mkBtnStub({
  markSaldo: 'req-legacy',
  driverLogin: '200108666',
  driverName: 'X',
  requestNo: 'A-2',
  nominal: '77000',
});
assert.strictEqual(semi.readRowFromButton(legacyBtn).nominal, 77000,
  'fallback ke data-nominal saat data-saldo-nominal belum tersedia');
console.log('  ok  Item 1 — fallback ke data-nominal untuk baris legacy');

console.log('\nAll semi-V2 contract assertions PASS.');
