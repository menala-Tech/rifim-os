const assert = require('assert');
const path = require('path');

process.env.SUPABASE_URL = 'https://supabase.example';
process.env.SUPABASE_PUBLISHABLE_KEY = 'pub';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'svc';

const hrisContracts = require(path.join(__dirname, '../api/internal/hris-contracts.js'));
const hrisV2 = require(path.join(__dirname, '../api/internal/hris-v2.js'));

const originalFetch = global.fetch;

function resMock() {
  return {
    _status: null,
    _headers: {},
    _body: null,
    status(s) { this._status = s; return this; },
    setHeader(k, v) { this._headers[k] = v; return this; },
    end(b) { this._body = b; }
  };
}

function jsonBody(res) {
  return res._body ? JSON.parse(res._body) : null;
}

// Canonical fixtures
const FIXTURES = {
  profile: [{ id: 'u1', role: 'management', staff_id: 'E001', full_name: 'Staff A', branch_id: 'b-bth', is_active: true, email: 'a@rifim.id' }],
  branches: [{ id: 'b-bth', name: 'Batam', slug: 'bth' }, { id: 'b-soeta', name: 'Soekarno-Hatta', slug: 'soeta' }],
  employees: [{ employee_id: 'E001', full_name: 'Staff A', company_code: 'RIFIM', department: 'Ops', position: 'Staff', branch: 'bth', status: 'AKTIF', salary_base: 3000000, bank_name: 'BCA', bank_account: '123' }],
  hrisPayroll: [],
  raosPayroll: [
    { staff_id: 'u1', gapok: 3000000, bonus_saldo: 100000, bpjs: 100000, paket_data: 50000, member_parkir: 20000, bonus_kpi: 50000, target_pct: 20, status_target: 'ok', late_deduction_total: 0, thp: 3500000 },
    { staff_id: 'orphan-uuid', bonus_saldo: 10000, bonus_kpi: 0, thp: 0, target_pct: 0, status_target: 'na', late_deduction_total: 0 }
  ],
  attendance: [
    { employee_code: 'E001', date: '2026-08-01', status: 'HADIR', late_minutes: 0, late_deduction_idr: 0 },
    { employee_code: 'E001', date: '2026-08-02', status: 'HADIR', late_minutes: 10, late_deduction_idr: 5000 }
  ],
  leave: [],
  roster: [
    { employee_uuid: 'u1', employee_id: 'E001', full_name: 'Staff A', position: 'Staff', salary_base: 3000000, user_id: 'u1', system_role: 'staff', branch_id: 'b-soeta', branch_name: 'Soekarno-Hatta', resolved_role: 'staff', sync_status: 'ready' },
    { employee_uuid: 'u2', employee_id: 'E002', full_name: 'Staff B', position: 'Staff', salary_base: 3000000, user_id: 'u2', system_role: 'staff', branch_id: 'b-bth', branch_name: 'Batam', resolved_role: 'staff', sync_status: 'ready' }
  ],
  branchTargets: [
    { branch_id: 'b-soeta', effective_month: '2026-08-01', target_cabang: 100, target_staff_default: 10, mode: 'order' },
    { branch_id: 'b-bth', effective_month: '2026-08-01', target_cabang: 1000000, target_staff_default: 500000, mode: 'saldo' }
  ],
  staffTargets: [],
  realisasi: [
    { staff_id: 'u1', realisasi_saldo: 500000 },
    { staff_id: 'u2', realisasi_saldo: 500000 }
  ],
  scanOrders: [
    { staff_id: 'u1', branch_id: 'b-soeta', scanned_at: '2026-08-15T00:00:00Z', status: 'valid' },
    { staff_id: 'u1', branch_id: 'b-soeta', scanned_at: '2026-08-16T00:00:00Z', status: 'valid' },
    { staff_id: 'u1', branch_id: 'b-soeta', scanned_at: '2026-08-17T00:00:00Z', status: 'pending' },
    { staff_id: 'u1', branch_id: 'b-soeta', scanned_at: '2026-08-18T00:00:00Z', status: 'rejected' },
    { staff_id: 'u2', branch_id: 'b-soeta', scanned_at: '2026-08-19T00:00:00Z', status: 'valid' },
    { staff_id: 'u1', branch_id: 'b-other', scanned_at: '2026-08-20T00:00:00Z', status: 'valid' },
    { staff_id: 'u1', branch_id: 'b-soeta', scanned_at: '2026-09-01T00:00:00Z', status: 'valid' }
  ]
};

const callLog = [];

function scanFilter(u) {
  const statusMatch = u.match(/[?&]status=eq\.([^&]+)/);
  const gteMatch = u.match(/[?&]scanned_at=gte\.([^&]+)/);
  const ltMatch = u.match(/[?&]scanned_at=lt\.([^&]+)/);
  const status = statusMatch ? statusMatch[1] : null;
  const gte = gteMatch ? gteMatch[1] : null;
  const lt = ltMatch ? ltMatch[1] : null;
  return FIXTURES.scanOrders.filter(s => {
    if (status && String(s.status) !== status) return false;
    if (gte && String(s.scanned_at || '').slice(0, 10) < gte) return false;
    if (lt && String(s.scanned_at || '').slice(0, 10) >= lt) return false;
    return true;
  });
}

async function mockFetch(url) {
  const u = String(url);
  callLog.push(u);
  if (u.includes('/auth/v1/user')) {
    return { ok: true, status: 200, text: async () => JSON.stringify({ id: 'u1', email: 'a@rifim.id' }) };
  }
  if (u.includes('/rest/v1/user_profiles')) {
    return { ok: true, status: 200, text: async () => JSON.stringify(FIXTURES.profile) };
  }
  if (u.includes('/rest/v1/branches')) {
    const id = (u.match(/[?&]id=eq\.([^&]+)/) || [])[1];
    if (id) return { ok: true, status: 200, text: async () => JSON.stringify(FIXTURES.branches.filter(b => b.id === id)) };
    return { ok: true, status: 200, text: async () => JSON.stringify(FIXTURES.branches) };
  }
  if (u.includes('/rest/v1/employees')) {
    return { ok: true, status: 200, text: async () => JSON.stringify(FIXTURES.employees) };
  }
  if (u.includes('/rest/v1/payroll')) {
    return { ok: true, status: 200, text: async () => JSON.stringify(FIXTURES.hrisPayroll) };
  }
  if (u.includes('/rest/v1/raos_payroll')) {
    return { ok: true, status: 200, text: async () => JSON.stringify(FIXTURES.raosPayroll) };
  }
  if (u.includes('/rest/v1/hris_attendance_view')) {
    return { ok: true, status: 200, text: async () => JSON.stringify(FIXTURES.attendance) };
  }
  if (u.includes('/rest/v1/leave_requests')) {
    return { ok: true, status: 200, text: async () => JSON.stringify(FIXTURES.leave) };
  }
  if (u.includes('/rest/v1/raos_hris_target_roster')) {
    const branch = (u.match(/[?&]branch_id=eq\.([^&]+)/) || [])[1];
    const rows = branch ? FIXTURES.roster.filter(r => r.branch_id === branch) : FIXTURES.roster;
    return { ok: true, status: 200, text: async () => JSON.stringify(rows) };
  }
  if (u.includes('/rest/v1/raos_kpi_targets_branch')) {
    return { ok: true, status: 200, text: async () => JSON.stringify(FIXTURES.branchTargets) };
  }
  if (u.includes('/rest/v1/raos_kpi_targets_staff')) {
    return { ok: true, status: 200, text: async () => JSON.stringify(FIXTURES.staffTargets) };
  }
  if (u.includes('/rest/v1/raos_target_tercapai_bulan')) {
    return { ok: true, status: 200, text: async () => JSON.stringify(FIXTURES.realisasi) };
  }
  if (u.includes('/rest/v1/scan_orders')) {
    return { ok: true, status: 200, text: async () => JSON.stringify(scanFilter(u)) };
  }
  return { ok: false, status: 404, text: async () => 'not found' };
}

async function runContracts(params) {
  global.fetch = mockFetch;
  callLog.length = 0;
  const res = resMock();
  const req = { method: 'GET', headers: { authorization: 'Bearer token' }, query: params, body: {} };
  await hrisContracts(req, res);
  global.fetch = originalFetch;
  return { res, body: jsonBody(res), log: callLog };
}

async function runPayroll(params) {
  global.fetch = mockFetch;
  callLog.length = 0;
  const res = resMock();
  const req = { method: 'GET', headers: { authorization: 'Bearer token' }, query: params, body: {} };
  await hrisV2(req, res);
  global.fetch = originalFetch;
  return { res, body: jsonBody(res), log: callLog };
}

(async () => {
  console.log('=== RIFIM OS canonical target + payroll + identity mapping contract ===');

  // ---------------------------------------------------------------------------
  // Fix A: order mode counts valid scan_orders; saldo mode unchanged
  // ---------------------------------------------------------------------------

  // 2. order mode: valid scans counted for the right staff/branch
  const orderResult = await runContracts({ mode: 'finance_staff_targets', month: '2026-08', branch_id: 'b-soeta' });
  assert.strictEqual(orderResult.res._status, 200, 'order staff targets should return 200');
  const orderRows = orderResult.body.rows;
  assert.strictEqual(orderRows.length, 1, 'one staff in Soeta roster');
  const soeta = orderRows[0];
  assert.strictEqual(soeta.mode, 'order', 'Soeta branch mode is order');
  assert.strictEqual(soeta.realisasi_scan, 2, 'order realisasi counts only valid Soeta scans for staff u1');
  assert.strictEqual(soeta.pct, 20, 'order pct is computed from realisasi_scan / target (2/10*100)');
  assert.ok(orderResult.log.some(u => u.includes('scan_orders') && u.includes('status=eq.valid')), 'scan_orders query must filter status=valid');
  assert.ok(orderResult.log.some(u => u.includes('scan_orders') && u.includes('scanned_at=gte.2026-08-01') && u.includes('scanned_at=lt.2026-09-01')), 'scan_orders query must filter the selected month window');

  // 1. saldo mode: realisasi_saldo unchanged; scan orders do not inflate it
  const saldoResult = await runContracts({ mode: 'finance_staff_targets', month: '2026-08', branch_id: 'b-bth' });
  assert.strictEqual(saldoResult.res._status, 200, 'saldo staff targets should return 200');
  const batam = saldoResult.body.rows[0];
  assert.strictEqual(batam.mode, 'saldo', 'Batam branch mode is saldo');
  assert.strictEqual(batam.realisasi_saldo, 500000, 'saldo realisasi uses raos_target_tercapai_bulan unchanged');
  assert.strictEqual(batam.realisasi_scan, null, 'saldo realisasi_scan is null');

  // 3-8. exclusion evidence is encoded in the scan_orders query filter and the per-staff/branch count
  // Wrong staff: only u1 is in Soeta roster; u2 scan does not leak into u1 count
  // Wrong branch: u1 scan at b-other does not leak into b-soeta count
  // Wrong month: 2026-09-01 scan filtered out by the scanned_at window
  // Pending/rejected: filtered out by status=eq.valid
  assert.strictEqual(soeta.realisasi_scan, 2, 'pending/rejected/invalid/wrong month/branch/staff scans excluded from count');

  // ---------------------------------------------------------------------------
  // Fix B: UUID -> employee mapping + orphan surfacing
  // ---------------------------------------------------------------------------

  const payrollResult = await runPayroll({ mode: 'payroll', month: '2026-08', branch_id: 'b-bth' });
  assert.strictEqual(payrollResult.res._status, 200, 'payroll should return 200');
  const rows = payrollResult.body.rows;
  const row = rows.find(r => r.employee_id === 'E001');
  assert.ok(row, 'E001 must be present in payroll rows');

  // 9. UUID -> employee mapping works
  assert.strictEqual(row.bonus_saldo, 100000, 'bonus_saldo from raos_payroll mapped by UUID -> staff_id -> employee_id');
  assert.strictEqual(row.bonus_kpi, 50000, 'bonus_kpi from raos_payroll mapped correctly');

  // 10. orphan mapping is surfaced, not silently misapplied
  assert.ok(payrollResult.body.unmapped, 'payroll response must expose unmapped section');
  assert.strictEqual(payrollResult.body.unmapped.count, 1, 'one orphan raos_payroll row must be surfaced');
  assert.strictEqual(payrollResult.body.unmapped.rows[0].staff_id, 'orphan-uuid', 'orphan staff UUID is surfaced');

  // ---------------------------------------------------------------------------
  // Fix C: payroll consumes canonical raos_payroll and uses actual HRIS attendance
  // ---------------------------------------------------------------------------

  // 11. bonus fields populate correctly
  assert.strictEqual(row.bonus_saldo, 100000, 'bonus_saldo populated');
  assert.strictEqual(row.bonus_kpi, 50000, 'bonus_kpi populated');
  assert.strictEqual(row.thp, 3500000, 'canonical THP from raos_payroll exposed');

  // 12. actual attendance is the payroll source
  assert.strictEqual(row.attendance_days, 2, 'attendance_days must come from hris_attendance_view HADIR count');
  assert.strictEqual(row.late_minutes, 10, 'late_minutes must come from hris_attendance_view');
  assert.strictEqual(row.late_deduction, 5000, 'late_deduction must come from hris_attendance_view');

  // 13. schedule is not queried or used
  assert.ok(!payrollResult.log.some(u => /shifts?|schedule/.test(u)), 'payroll must not query schedule/shifts');

  // TOTAL / THP composition: total_salary follows canonical raos_payroll.thp when not frozen
  assert.strictEqual(row.total_salary, 3500000, 'total_salary must equal canonical THP from raos_payroll');

  console.log('PASS');
})().catch((e) => {
  global.fetch = originalFetch;
  console.error('FAIL:', e.message);
  process.exit(1);
});
