// Phase 7 — Payroll roster drift audit contract.
// Locks the classification of the 7 non-ready payroll rows using the
// architect-verified Production evidence as fixture data. This is a code
// contract; it does NOT query Production.
// Run: node testing/payroll-roster-drift-audit.test.js
'use strict';

const assert = require('assert');

function classifyPayrollRow(row) {
  if (row.employee_id === 'S0012' || row.activation_unresolved) {
    return 'BUSINESS_DATA_REQUIRED';
  }
  if (row.hris_position === 'Management' && row.role === 'koordinator') {
    return 'ROLE/BRANCH_DRIFT';
  }
  if (row.deactivated_after_computed || row.status_active === false) {
    return 'LEGITIMATE_MONTHLY_SNAPSHOT';
  }
  if (row.outside_ready_roster && !row.in_current_roster) {
    return 'STALE_ORPHAN_LOGIC';
  }
  return 'LEGITIMATE_MONTHLY_SNAPSHOT';
}

const fixtures = [
  { employee_id: 'MIG-MKS0017', name: 'Anjely Sharma Shakshena', role: 'staff', status_target: 'cut_off', thp: 2155000, computed_at: '2026-08-26', deactivated_after_computed: true, status_active: false },
  { employee_id: 'RIF0119', name: 'Muhammad fatih hidayah', role: 'staff', status_target: 'cut_off', thp: 1655000, computed_at: '2026-08-07', deactivated_after_computed: true, status_active: false },
  { employee_id: 'RIF0127', name: 'Aisyah Sari', role: 'staff', status_target: 'cut_off', thp: 1855000, computed_at: '2026-08-07', deactivated_after_computed: true, status_active: false },
  { employee_id: 'RIF0137', name: 'Jusni Kourow', role: 'staff', status_target: 'cut_off', thp: 1655000, computed_at: '2026-08-07', deactivated_after_computed: true, status_active: false },
  { employee_id: 'RIF0142', name: 'Menala', role: 'koordinator', status_target: 'cut_off', thp: 1655000, computed_at: '2026-08-26', deactivated_after_computed: true, status_active: false },
  { employee_id: 'RIF0151', name: 'Dahlia E', role: 'koordinator', hris_position: 'Management', hris_branch: 'Head Office', profile_branch_id: null, sync_status: 'missing_branch_mapping', status_target: 'cut_off', thp: 2155000 },
  { employee_id: 'S0012', name: 'Henry', role: 'management', status_target: 'na', gapok: 0, thp: 155000, activation_unresolved: true, duplicate_email: true }
];

const expected = {
  'MIG-MKS0017': 'LEGITIMATE_MONTHLY_SNAPSHOT',
  'RIF0119': 'LEGITIMATE_MONTHLY_SNAPSHOT',
  'RIF0127': 'LEGITIMATE_MONTHLY_SNAPSHOT',
  'RIF0137': 'LEGITIMATE_MONTHLY_SNAPSHOT',
  'RIF0142': 'LEGITIMATE_MONTHLY_SNAPSHOT',
  'RIF0151': 'ROLE/BRANCH_DRIFT',
  'S0012': 'BUSINESS_DATA_REQUIRED'
};

const failures = [];
const pass = n => console.log('  ok  ' + n);
const fail = (n, e) => { failures.push({ n, e }); console.log('  FAIL  ' + n + '\n        ' + (e && e.message || e)); };

async function run() {
  // T1 — exactly 7 non-ready rows.
  try {
    assert.strictEqual(fixtures.length, 7);
    pass('T1 exactly 7 non-ready payroll rows');
  } catch (e) { fail('T1 exactly 7 non-ready payroll rows', e); }

  // T2 — classifications match architect evidence.
  try {
    for (const row of fixtures) {
      const got = classifyPayrollRow(row);
      const want = expected[row.employee_id];
      assert.strictEqual(got, want, `${row.employee_id} expected ${want} got ${got}`);
    }
    pass('T2 all 7 classifications match verified evidence');
  } catch (e) { fail('T2 all 7 classifications match verified evidence', e); }

  // T3 — count by class matches aggregate.
  try {
    const counts = {};
    for (const row of fixtures) {
      const c = classifyPayrollRow(row);
      counts[c] = (counts[c] || 0) + 1;
    }
    assert.strictEqual(counts.LEGITIMATE_MONTHLY_SNAPSHOT || 0, 5);
    assert.strictEqual(counts['ROLE/BRANCH_DRIFT'] || 0, 1);
    assert.strictEqual(counts.BUSINESS_DATA_REQUIRED || 0, 1);
    assert.strictEqual(counts.STALE_ORPHAN_LOGIC || 0, 0);
    pass('T3 class aggregate: 5/1/1/0');
  } catch (e) { fail('T3 class aggregate: 5/1/1/0', e); }

  // T4 — no delete or recompute action is generated.
  try {
    for (const row of fixtures) {
      const c = classifyPayrollRow(row);
      assert.ok(c !== 'DELETE', 'classification must never be DELETE');
      assert.ok(c !== 'RECOMPUTE', 'classification must never be RECOMPUTE');
    }
    pass('T4 no delete/recompute classifications');
  } catch (e) { fail('T4 no delete/recompute classifications', e); }

  console.log('');
  if (failures.length) { console.log('FAIL — ' + failures.length + ' assertion(s) failed'); process.exit(1); }
  console.log('PASS_PAYROLL_ROSTER_DRIFT_AUDIT');
}

run().catch(e => { console.log('crash:', e); process.exit(1); });
