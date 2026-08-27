/**
 * Contract tests for the AIST bookmarklet's old-GAS queue mapping.
 */

const assert = require('node:assert/strict');
const { invoiceNominal } = require('../shared/aist-invoice-nominal.js');

function normalizeOldRow(r) {
  const raw = Number(r.nominal);
  if (!Number.isFinite(raw) || raw < 0) return null;
  const login = String(r.loginId || r.loginID || r.login || '').replace(/\D/g, '');
  if (!login) return null;
  const ts = r.ts || r.waktu || r.tanggal || r.submitted_at || '';
  return {
    request_id: String(r.row || r.id || r.request_id || ''),
    driver_login: login,
    driver_name: String(r.namaDriver || r.driverName || r.driver_name || ''),
    branch_name: String(r.cabang || r.branch || r.branch_name || ''),
    staff_name: String(r.staff || r.staff_name || ''),
    saldo_nominal: raw,
    invoice_nominal: invoiceNominal(raw),
    submitted_at: ts,
    status: String(r.status || 'pending')
  };
}

const fixture = [
  { row: 3, ts: '2026-08-27T10:00:00Z', cabang: 'Makassar', staff: 'Budi', namaDriver: 'Andi', loginId: '217652070', nominal: 45000 },
  { row: 4, waktu: '2026-08-27T10:05:00Z', cabang: 'Balikpapan', staff: 'Sari', namaDriver: 'Bima', loginId: '217652071', nominal: 95000 },
  { row: 5, ts: '2026-08-27T10:10:00Z', cabang: 'Pekanbaru', staff: 'Rina', namaDriver: 'Citra', loginId: '217652072', nominal: 140000 },
  { row: 6, ts: '2026-08-27T10:15:00Z', cabang: 'Makassar', staff: 'Doni', namaDriver: 'Dedi', loginId: '217652073', nominal: 145000 },
  { row: 7, ts: '2026-08-27T10:20:00Z', cabang: 'General', staff: 'Eka', namaDriver: 'Eko', loginId: '217652074', nominal: 190000 },
  { row: 8, ts: '2026-08-27T10:25:00Z', cabang: 'Makassar', staff: 'Fani', namaDriver: 'Fikri', loginId: '217652075', nominal: 195000 },
];

for (const raw of fixture) {
  const n = normalizeOldRow(raw);
  assert.ok(n, 'row must normalize successfully');
  assert.equal(n.driver_login, raw.loginId, 'driver_login maps from loginId');
  assert.equal(n.saldo_nominal, raw.nominal, 'saldo_nominal stays RAW');
  assert.equal(n.driver_name, raw.namaDriver, 'driver_name maps from namaDriver');
  assert.equal(n.branch_name, raw.cabang, 'branch_name maps from cabang');
  assert.equal(n.staff_name, raw.staff, 'staff_name maps from staff');
  assert.equal(n.request_id, String(raw.row), 'request_id maps from row');
}

const testCases = [45000, 95000, 140000, 145000, 190000, 195000];
for (const nominal of testCases) {
  const mapped = normalizeOldRow({ row: 99, loginId: '217652070', nominal });
  assert.equal(mapped.saldo_nominal, nominal, 'AIST fill must use raw saldo for ' + nominal);
  assert.equal(mapped.invoice_nominal, invoiceNominal(nominal), 'invoice is rounded display only');
}

assert.equal(normalizeOldRow({ row: 99, loginId: 'abc', nominal: 45000 }), null, 'non-digit loginId rejected');
assert.equal(normalizeOldRow({ row: 99, loginId: '123', nominal: 'not a number' }), null, 'non-numeric nominal rejected');

console.log('✅ aist-bookmarklet-gas-contract: all assertions passed');
