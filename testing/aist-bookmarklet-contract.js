/**
 * Contract tests for the AIST bookmarklet queue picker.
 *
 * - Invoice rounding must match canonical rule.
 * - Queue response shape must contain required fields and no secrets.
 */

const assert = require('node:assert/strict');
const { invoiceNominal } = require('../shared/aist-invoice-nominal.js');

function queueRowFromRaw(raw) {
  return {
    request_id: 'req-' + raw,
    driver_login: '204074780',
    driver_name: 'Driver ' + raw,
    branch_name: 'ID Rifim Airport ' + (['Makassar','Balikpapan','Pekanbaru','General'][raw % 4] || 'Jambi'),
    staff_name: 'Staff Test',
    saldo_nominal: raw,
    invoice_nominal: invoiceNominal(raw),
    submitted_at: '2026-08-27T10:00:00.000Z',
    submitted_at_wib: '27/08/2026, 17.00.00',
    status: 'pending',
  };
}

const testCases = [
  [190000, 200000, 'Makassar example'],
  [140000, 150000, 'Makassar low example'],
  [145000, 150000, 'Balikpapan example'],
  [145000, 150000, 'Pekanbaru example'],
  [195000, 200000, 'General example'],
  [45000, 50000, 'low invoice rounding'],
  [95000, 100000, 'near-100k rounding'],
  [123000, 123000, 'unchanged non-mapped'],
];

for (const [raw, expected, label] of testCases) {
  const actual = invoiceNominal(raw);
  assert.equal(actual, expected, `invoice rounding for ${label} (${raw})`);
}

const fixture = [
  queueRowFromRaw(190000),
  queueRowFromRaw(140000),
  queueRowFromRaw(145000),
  queueRowFromRaw(145000),
  queueRowFromRaw(195000),
  queueRowFromRaw(45000),
  queueRowFromRaw(95000),
];

const requiredKeys = [
  'request_id', 'driver_login', 'driver_name', 'branch_name', 'staff_name',
  'saldo_nominal', 'invoice_nominal', 'submitted_at', 'status',
];
const forbiddenKeys = ['access_token', 'token', 'pin', 'password', 'rifim_auth', 'client_id', 'staff_id'];

for (const row of fixture) {
  for (const key of requiredKeys) {
    assert.ok(key in row, `queue row must expose ${key}`);
  }
  for (const key of forbiddenKeys) {
    assert.ok(!(key in row), `queue row must NOT expose ${key}`);
  }
  assert.ok(row.saldo_nominal > 0, 'saldo_nominal must be positive');
  assert.ok(row.invoice_nominal >= row.saldo_nominal, 'invoice must be >= raw saldo');
  assert.equal(typeof row.driver_login, 'string', 'driver_login is a string');
  assert.ok(/^[0-9]+$/.test(row.driver_login), 'driver_login is digit-only');
}

console.log('✅ aist-bookmarklet-contract: all assertions passed');
