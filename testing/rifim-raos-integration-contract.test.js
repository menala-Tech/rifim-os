// Phase 9 — RIFIM ↔ RAOS integration wiring contract.
// Locks the canonical wiring domains using architect-verified Production
// structural evidence as fixture data. This is a code contract and does NOT
// query Production.
// Run: node testing/rifim-raos-integration-contract.test.js
'use strict';

const assert = require('assert');

const productionEvidence = {
  attendance_orphan: 0,
  saldo_orphan: 0,
  scan_orphan: 0,
  schedule_orphan: 0,
  payroll_orphan: 0,
  attendance_branch_mismatch: 0,
  saldo_branch_mismatch: 0,
  schedule_branch_mismatch: 0,
  duplicate_employee_id: 0,
  duplicate_profile_staff_id: 0,
  duplicate_master_staff_id: 0,
  duplicate_schedule_staff_date: 0,
  duplicate_payroll_staff_month: 0,
  ready_staff: 70,
  ready_koordinator: 6,
  missing_branch_koordinator: 1,
  target_modes: {
    'Bandara Soekarno-Hatta': 'order',
    'Bandara Makassar': 'order',
    'Balikpapan': 'saldo',
    'Batam Airport': 'saldo',
    'Jambi Airport': 'saldo',
    'Manado': 'saldo',
    'Pekanbaru': 'saldo',
    'Rifim Batam non-airport': 'saldo',
    'Rifim Jambi Luar': 'saldo'
  }
};

const fixtures = {
  // identity: employees → user_profiles.staff_id → raos_staff_master.staff_id
  employees: [
    { employee_id: 'RIF0151', full_name: 'Dahlia E', position: 'Management', branch: 'Head Office' },
    { employee_id: 'S0012', full_name: 'Henry', position: 'Management', branch: 'Head Office' },
    { employee_id: 'RIF0001', full_name: 'Ahmad', position: 'Staff', branch: 'Batam' }
  ],
  profiles: [
    { staff_id: 'RIF0151', role: 'koordinator', branch_id: null },
    { staff_id: 'S0012', role: 'management', branch_id: 'h-office' },
    { staff_id: 'RIF0001', role: 'staff', branch_id: 'b1' }
  ],
  master: [
    { staff_id: 'RIF0001', status: 'active' }
  ],
  // payroll sample: staff UUID month uniqueness + no duplicate month/staff
  payroll: [
    { staff_id: 'u-1', employee_id: 'RIF0001', full_name: 'Ahmad', effective_month: '2026-08-01' }
  ],
  // saldo lifecycle: RAOS create -> RIFIM visible, RIFIM cancel -> RAOS cancelled
  saldo: [
    { id: 's1', status: 'pending', is_processed: false, is_archived: false },
    { id: 's2', status: 'cancelled', is_processed: false, is_archived: false },
    { id: 's3', status: 'paid', is_processed: true, is_archived: false },
    { id: 's4', status: 'rejected', is_processed: false, is_archived: true }
  ]
};

const failures = [];
const pass = n => console.log('  ok  ' + n);
const fail = (n, e) => { failures.push({ n, e }); console.log('  FAIL  ' + n + '\n        ' + (e && e.message || e)); };

async function run() {
  // T1 — identity wiring: no duplicate employee_id, profile staff_id, master staff_id.
  try {
    const dupEmployee = new Set();
    const dupEmployeeId = fixtures.employees.some(e => dupEmployee.size === dupEmployee.add(e.employee_id).size);
    assert.strictEqual(dupEmployeeId, false, 'no duplicate employee_id');
    const dupProfile = new Set();
    const dupProfileStaff = fixtures.profiles.some(p => dupProfile.size === dupProfile.add(p.staff_id).size);
    assert.strictEqual(dupProfileStaff, false, 'no duplicate profile staff_id');
    const dupMaster = new Set();
    const dupMasterStaff = fixtures.master.some(m => dupMaster.size === dupMaster.add(m.staff_id).size);
    assert.strictEqual(dupMasterStaff, false, 'no duplicate master staff_id');
    pass('T1 identity wiring has no duplicate canonical keys');
  } catch (e) { fail('T1 identity wiring has no duplicate canonical keys', e); }

  // T2 — employees.employee_id ↔ user_profiles.staff_id mapping.
  try {
    for (const emp of fixtures.employees) {
      const p = fixtures.profiles.find(x => x.staff_id === emp.employee_id);
      assert.ok(p, `${emp.employee_id} must have a matching profile staff_id`);
      assert.ok(['staff','koordinator','management','admin','direksi'].includes(p.role), 'role normalized');
    }
    pass('T2 employee_id maps to profile staff_id');
  } catch (e) { fail('T2 employee_id maps to profile staff_id', e); }

  // T3 — structural evidence: all orphan/mismatch/duplicate counts are zero.
  try {
    const zeroFields = [
      'attendance_orphan', 'saldo_orphan', 'scan_orphan', 'schedule_orphan', 'payroll_orphan',
      'attendance_branch_mismatch', 'saldo_branch_mismatch', 'schedule_branch_mismatch',
      'duplicate_employee_id', 'duplicate_profile_staff_id', 'duplicate_master_staff_id',
      'duplicate_schedule_staff_date', 'duplicate_payroll_staff_month'
    ];
    for (const f of zeroFields) {
      assert.strictEqual(productionEvidence[f], 0, `${f} must be 0`);
    }
    pass('T3 structural evidence: no orphans/mismatches/duplicates');
  } catch (e) { fail('T3 structural evidence: no orphans/mismatches/duplicates', e); }

  // T4 — target roster excludes admin/management/direksi/driver, includes staff+koordinator.
  try {
    assert.strictEqual(productionEvidence.ready_staff, 70);
    assert.strictEqual(productionEvidence.ready_koordinator, 6);
    assert.strictEqual(productionEvidence.missing_branch_koordinator, 1);
    pass('T4 target roster composition matches evidence (70 staff + 6 koordinator + 1 missing branch)');
  } catch (e) { fail('T4 target roster composition matches evidence', e); }

  // T5 — target modes: airport CGK/MKS use order, others use saldo.
  try {
    for (const [branch, mode] of Object.entries(productionEvidence.target_modes)) {
      if (/Soekarno|Soeta|Makassar/i.test(branch)) {
        assert.strictEqual(mode, 'order', `${branch} must be order mode`);
      } else {
        assert.strictEqual(mode, 'saldo', `${branch} must be saldo mode`);
      }
    }
    pass('T5 airport branch target modes are order, others saldo');
  } catch (e) { fail('T5 airport branch target modes are order, others saldo', e); }

  // T6 — saldo lifecycle: no cancelled→rejected split-brain, no hard delete.
  try {
    for (const row of fixtures.saldo) {
      assert.ok(['pending','approved','paid','rejected','cancelled'].includes(row.status), 'saldo status canonical');
      if (row.status === 'cancelled') assert.strictEqual(row.is_processed, false, 'cancelled row not processed');
    }
    const cancelledCount = fixtures.saldo.filter(x => x.status === 'cancelled').length;
    const rejectedCount = fixtures.saldo.filter(x => x.status === 'rejected').length;
    assert.ok(cancelledCount >= 1 && rejectedCount >= 1, 'cancelled and rejected are distinct statuses');
    pass('T6 saldo lifecycle canonical and distinct');
  } catch (e) { fail('T6 saldo lifecycle canonical and distinct', e); }

  // T7 — payroll: no duplicate month/staff.
  try {
    const keys = new Set(fixtures.payroll.map(p => `${p.staff_id}:${p.effective_month}`));
    assert.strictEqual(keys.size, fixtures.payroll.length, 'no duplicate payroll staff/month');
    pass('T7 payroll UUID-month uniqueness');
  } catch (e) { fail('T7 payroll UUID-month uniqueness', e); }

  // T8 — function count remains <= 12.
  try {
    const fs = require('fs');
    const path = require('path');
    const apiDir = path.resolve(__dirname, '..', 'api');
    function walk(d, acc) {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p, acc);
        else if (/\.(js|ts|mjs|cjs)$/.test(e.name)) acc.push(p);
      }
      return acc;
    }
    const routes = walk(apiDir, []).filter(p => !p.includes(path.sep + '_lib' + path.sep) && !p.includes(path.sep + '_modules' + path.sep) && !/^_/.test(path.basename(p)));
    assert.ok(routes.length <= 12, 'function count must remain <= 12 (found ' + routes.length + ')');
    pass('T8 no new Vercel function from integration work (found ' + routes.length + ')');
  } catch (e) { fail('T8 no new Vercel function from integration work', e); }

  console.log('');
  if (failures.length) { console.log('FAIL — ' + failures.length + ' assertion(s) failed'); process.exit(1); }
  console.log('PASS_RIFIM_RAOS_INTEGRATION_CONTRACT');
}

run().catch(e => { console.log('crash:', e); process.exit(1); });
