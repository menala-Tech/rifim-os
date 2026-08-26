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

// Evaluate the production invoice mapping; do not duplicate its map here.
const routerSrc = read('shared/finance-data-router.js');
const invoiceFnMatch = routerSrc.match(/function invoiceNominal\(rawValue\)\{[\s\S]*?return map\[raw\]\|\|raw;\s*\}/);
assert.ok(invoiceFnMatch, 'invoiceNominal helper found in finance-data-router.js');
const routerInternals = {};
vm.runInNewContext(invoiceFnMatch[0] + '\nglobalThis.__invoiceNominal = invoiceNominal;', routerInternals);
const invoiceNominal = routerInternals.__invoiceNominal;

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
    closest: () => ({ cells: [{}, { textContent: ds.branch || 'GENERAL' }, { textContent: 'Bobby' }] }),
  };
}
[
  { branch: 'MAKASSAR', raw: 190000, invoice: 200000 },
  { branch: 'MAKASSAR', raw: 140000, invoice: 150000 },
  { branch: 'BALIKPAPAN', raw: 145000, invoice: 150000 },
  { branch: 'PEKANBARU', raw: 145000, invoice: 150000 },
  { branch: 'GENERAL', raw: 195000, invoice: 200000 },
  { branch: 'GENERAL', raw: 45000, invoice: 50000 },
  { branch: 'GENERAL', raw: 95000, invoice: 100000 },
  { branch: 'GENERAL', raw: 200000, invoice: 200000 },
].forEach(({ branch, raw, invoice }) => {
  const btn = mkBtnStub({
    markSaldo: 'req-' + raw,
    driverLogin: '200108666',
    driverName: 'Wahyudi',
    requestNo: 'A-1',
    branch,
    nominal: String(invoice),        // display invoice (bug source)
    saldoNominal: String(raw),       // RAW saldo (fix)
  });
  const row = semi.readRowFromButton(btn);
  assert.strictEqual(row.nominal, raw,
    `${branch}: readRowFromButton must use RAW ${raw}, got ${row.nominal}`);
  const payload = semi.buildSemiPayload(row);
  assert.strictEqual(payload.nominal, raw,
    `${branch}: payload.nominal must be RAW ${raw}, got ${payload.nominal}`);
  assert.strictEqual(invoiceNominal(raw), invoice,
    `${branch}: invoiceNominal(${raw}) must be ${invoice}, got ${invoiceNominal(raw)}`);
});
console.log('  ok  owner raw nominal matrix uses raw AIST values and production invoice mapping');

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

// The router mapping is covered by source-text contract here because this
// test file has no live API harness for driving saldoList().
assert.match(routerSrc, /saldo_nominal:raw[\s\S]*?invoice_nominal:invoice[\s\S]*?nominal:invoice/,
  'saldoList mapping must preserve raw saldo_nominal and expose invoice as nominal');
console.log('  ok  saldoList source mapping preserves raw saldo_nominal and invoice nominal');

const financeHtmlSrc = read('modules/finance/index.html');
assert.match(financeHtmlSrc, /data-nominal=/, 'saldo row exposes data-nominal');
assert.match(financeHtmlSrc, /data-saldo-nominal=/, 'saldo row exposes data-saldo-nominal');
assert.match(financeHtmlSrc, /const rawSaldo = r\.saldo_nominal != null \? Number\(r\.saldo_nominal\) : Number\(r\.nominal \|\| 0\)/,
  'amount cell raw fallback must use saldo_nominal then nominal');
assert.match(financeHtmlSrc, /const amountCell = rawSaldo !== invoiceNominal[\s\S]*?: fmtRp\(invoiceNominal\);/,
  'amount cell must collapse to one invoice value when raw equals invoice');
assert.match(financeHtmlSrc, /Saldo: \$\{fmtRp\(rawSaldo\)\}/, 'amount cell labels raw value as Saldo');
assert.match(financeHtmlSrc, /Invoice: \$\{fmtRp\(invoiceNominal\)\}/, 'amount cell labels rounded value as Invoice');
assert.match(financeHtmlSrc, /Saldo \(AIST\): \$\{nominal\}/, 'confirmation dialog labels raw AIST value');
assert.match(financeHtmlSrc, /btn\.dataset\.saldoNominal != null \? btn\.dataset\.saldoNominal : \(btn\.dataset\.nominal \|\| 0\)/,
  'confirmation dialog sources raw AIST amount from data-saldo-nominal');
assert.match(financeHtmlSrc, /const invoiceLine = rawSaldoValue !== invoiceNominal \?[\s\S]*?: '';/,
  'confirmation dialog invoice line is conditional');
assert.match(financeHtmlSrc, /if \(!confirm\(confirmMsg\)\) return;/, 'mark-paid remains behind explicit confirmation');
assert.match(financeHtmlSrc, /confirmMsg[\s\S]*?_gasCall\('finance_saldo_raos_mark_paid'/,
  'mark-paid RPC remains in the explicit confirmation flow');
console.log('  ok  Finance dual-label render + explicit manual confirmation contract');

function runBookmarkletFill(payload) {
  return new Promise((resolve, reject) => {
    const amount = {
      type: 'text', name: 'amount', placeholder: 'Amount', id: 'aist-amount',
      disabled: false, readOnly: false, offsetParent: {},
      previousElementSibling: null, closest: () => null,
      getAttribute: () => '', dispatchEvent: () => {},
    };
    const login = {
      type: 'text', name: 'driver_login', placeholder: 'Driver login', id: 'aist-login',
      disabled: false, readOnly: false, offsetParent: {},
      previousElementSibling: null, closest: () => null,
      getAttribute: () => '', dispatchEvent: () => {},
    };
    let submitCalls = 0;
    let clickSubmitCalls = 0;
    let markLunasCalls = 0;
    const inputProto = {};
    Object.defineProperty(inputProto, 'value', {
      set(value) { this._value = String(value); },
      get() { return this._value || ''; },
    });
    Object.setPrototypeOf(amount, inputProto);
    Object.setPrototypeOf(login, inputProto);
    const ctx = {
      navigator: { clipboard: { readText: () => Promise.resolve(semi.encodePayload(payload)) } },
      document: {
        querySelectorAll: () => [amount, login],
        querySelector: () => null,
        createElement: () => ({ style: {}, textContent: '', appendChild: () => {} }),
        body: { appendChild: () => {} },
      },
      window: {},
      HTMLInputElement: function HTMLInputElement() {},
      Event: function Event(type) { this.type = type; },
      Promise, atob: (b64) => Buffer.from(b64, 'base64').toString('binary'),
      escape: global.escape || ((s) => encodeURIComponent(s)),
      decodeURIComponent, JSON, Number, Date, Object, Error, String,
      confirm: () => true,
      alert: (message) => { throw new Error('bookmarklet alert: ' + message); },
      setTimeout: () => 0,
      clearTimeout: () => {},
      console,
      submit: () => { submitCalls += 1; },
      clickSubmit: () => { clickSubmitCalls += 1; },
      markSaldoPaid: () => { markLunasCalls += 1; },
    };
    ctx.window = ctx;
    ctx.window.HTMLInputElement = ctx.HTMLInputElement;
    ctx.HTMLInputElement.prototype = inputProto;
    vm.createContext(ctx);
    try {
      vm.runInContext(bookmarkletSrc, ctx);
      Promise.resolve().then(() => Promise.resolve()).then(() => {
        resolve({
          login: login.value,
          amount: amount.value,
          submitCalls,
          clickSubmitCalls,
          markLunasCalls,
        });
      }, reject);
    } catch (err) {
      reject(err);
    }
  });
}

async function runBookmarkletRawRegression() {
  const cases = [
    { branch: 'MAKASSAR', raw: 190000 },
    { branch: 'MAKASSAR', raw: 140000 },
    { branch: 'BALIKPAPAN', raw: 145000 },
    { branch: 'GENERAL', raw: 195000 },
  ];
  for (const { branch, raw } of cases) {
    const payload = semi.buildSemiPayload({
      request_id: `bookmarklet-${branch}-${raw}`,
      driver_login: '200108666',
      nominal: raw,
      driver_name: 'Wahyudi',
      branch_name: branch,
      staff_name: 'Bobby',
    });
    const filled = await runBookmarkletFill(payload);
    assert.strictEqual(filled.amount, String(raw), `${branch}: bookmarklet Amount must be RAW ${raw}`);
    assert.strictEqual(filled.login, payload.driver_login, `${branch}: bookmarklet Driver login must be filled`);
    assert.strictEqual(filled.submitCalls, 0, `${branch}: bookmarklet must not submit`);
    assert.strictEqual(filled.clickSubmitCalls, 0, `${branch}: bookmarklet must not click-submit`);
    assert.strictEqual(filled.markLunasCalls, 0, `${branch}: bookmarklet must not mark Lunas`);
    console.log(`  ok  bookmarklet real fill path ${branch} raw=${raw} login=${payload.driver_login}`);
  }
}

runBookmarkletRawRegression().then(() => {
  console.log('  ok  bookmarklet raw nominal regression matrix passed through real decode/fill logic');
  console.log('\nAll semi-V2 contract assertions PASS.');
}).catch((err) => {
  console.error(err && err.stack ? err.stack : err);
  process.exitCode = 1;
});
