/**
 * Contract test for the 2026-09-01 payroll target-missing guard.
 *
 * The full guard lives in automation/apps-script/crmApi.js as part of
 * _finPayrollCompute_. GAS code can't be unit-tested from Node, so this
 * test ports the pure-reduction step (branches vs target rows) into a
 * plain function and asserts:
 *   - all branches present in raos_kpi_targets_branch    -> allow
 *   - one branch missing                                 -> block, list=[missing]
 *   - many branches missing                              -> block, list preserves branch names
 *
 * If the guard shape changes (extra codes, richer message), update BOTH
 * the port here and the assertion so the test keeps mirroring reality.
 */

const assert = require('node:assert/strict');

function evaluateMissingTargets(branches, targetRows, month) {
  const haveSet = {};
  (targetRows || []).forEach(t => { haveSet[t.branch_id] = true; });
  const missing = (branches || [])
    .filter(b => !haveSet[b.id])
    .map(b => b.name || b.slug || b.id);
  if (missing.length === 0) {
    return { success: true, month, ok: true };
  }
  return {
    success: false,
    code: 'MISSING_TARGETS',
    month,
    missing_branches: missing,
    message: 'Beberapa cabang belum punya target untuk bulan ini: ' + missing.join(', ')
      + '. Set dulu di tab Target Cabang sebelum recompute payroll.',
  };
}

const branches = [
  { id: 'b1', name: 'Batam' },
  { id: 'b2', name: 'Jambi' },
  { id: 'b3', name: 'Pekanbaru' },
];

// All present.
{
  const targets = [{ branch_id: 'b1' }, { branch_id: 'b2' }, { branch_id: 'b3' }];
  const res = evaluateMissingTargets(branches, targets, '2026-09-01');
  assert.equal(res.success, true);
}

// One missing.
{
  const targets = [{ branch_id: 'b1' }, { branch_id: 'b3' }];
  const res = evaluateMissingTargets(branches, targets, '2026-09-01');
  assert.equal(res.success, false);
  assert.equal(res.code, 'MISSING_TARGETS');
  assert.deepEqual(res.missing_branches, ['Jambi']);
  assert.ok(res.message.includes('Jambi'));
}

// All missing (real September 2026 scenario -- rows appear because
// _finKpiTargetBranchList_ iterates branches, but every target_cabang
// folds to 0).
{
  const res = evaluateMissingTargets(branches, [], '2026-09-01');
  assert.equal(res.success, false);
  assert.deepEqual(res.missing_branches, ['Batam', 'Jambi', 'Pekanbaru']);
}

// Empty branches list -- no work to do, not an error.
{
  const res = evaluateMissingTargets([], [], '2026-09-01');
  assert.equal(res.success, true);
}

console.log('payroll-target-guard-contract: PASS');
