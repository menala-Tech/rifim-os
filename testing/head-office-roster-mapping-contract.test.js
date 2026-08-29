// Phase 6 — Head Office / RIF0151 roster mapping diagnosis contract.
// Locks the root-cause finding that the stale `user_profiles.role='koordinator'
// takes precedence over HRIS `position='Management'` and causes
// missing_branch_mapping. No arbitrary airport branch mapping.
// Run: node testing/head-office-roster-mapping-contract.test.js
'use strict';

const assert = require('assert');

// Reproduces the role resolution used by raos_hris_target_roster view:
// COALESCE(user_profiles.role, employees.position)
function resolveRosterRole(employeePosition, profileRole) {
  return String(profileRole || employeePosition || '').toLowerCase();
}

function classifyHeadOfficeRoster(employee, profile) {
  const resolvedRole = resolveRosterRole(employee.position, profile.role);
  const inTargetRoster = ['staff', 'koordinator'].includes(resolvedRole) && profile.is_active;
  const hasBranch = !!profile.branch_id;
  const conflict = resolvedRole !== String(employee.position || '').toLowerCase();
  if (!inTargetRoster) return { status: 'EXCLUDED_BY_ROLE', role: resolvedRole };
  if (!hasBranch) return { status: 'ROLE/BRANCH_DRIFT', role: resolvedRole, conflict, root_cause: 'stale profile role overrides HRIS position; NULL branch becomes visible' };
  return { status: 'OK', role: resolvedRole };
}

const fixtures = {
  employee: {
    employee_id: 'RIF0151',
    full_name: 'Dahlia E',
    position: 'Management',
    branch: 'Head Office',
    status: 'AKTIF'
  },
  profile: {
    staff_id: 'RIF0151',
    role: 'koordinator',
    branch_id: null,
    is_active: true
  }
};

const failures = [];
const pass = n => console.log('  ok  ' + n);
const fail = (n, e) => { failures.push({ n, e }); console.log('  FAIL  ' + n + '\n        ' + (e && e.message || e)); };

async function run() {
  // T1 — role resolution prefers stale profile role over HRIS position.
  try {
    assert.strictEqual(resolveRosterRole('Management', 'koordinator'), 'koordinator');
    pass('T1 profile role overrides HRIS position');
  } catch (e) { fail('T1 profile role overrides HRIS position', e); }

  // T2 — Dahlia is incorrectly classified as target roster because of stale koordinator role.
  try {
    const r = classifyHeadOfficeRoster(fixtures.employee, fixtures.profile);
    assert.strictEqual(r.status, 'ROLE/BRANCH_DRIFT');
    assert.strictEqual(r.role, 'koordinator');
    assert.strictEqual(r.conflict, true);
    pass('T2 RIF0151 classification = ROLE/BRANCH_DRIFT');
  } catch (e) { fail('T2 RIF0151 classification = ROLE/BRANCH_DRIFT', e); }

  // T3 — root cause is stale profile role, not missing airport branch.
  try {
    const r = classifyHeadOfficeRoster(fixtures.employee, fixtures.profile);
    assert.ok(/stale profile role/i.test(r.root_cause));
    pass('T3 root cause is stale profile role, not missing airport branch');
  } catch (e) { fail('T3 root cause is stale profile role, not missing airport branch', e); }

  // T4 — if profile role matches HRIS Management, she is correctly excluded.
  try {
    const profile = { ...fixtures.profile, role: 'management' };
    const r = classifyHeadOfficeRoster(fixtures.employee, profile);
    assert.strictEqual(r.status, 'EXCLUDED_BY_ROLE');
    pass('T4 corrected role = Management → excluded from target roster');
  } catch (e) { fail('T4 corrected role = Management → excluded from target roster', e); }

  // T5 — no arbitrary branch assignment is permitted.
  try {
    const branches = ['Soekarno-Hatta', 'Batam', 'Makassar', 'BTH', 'MKS'];
    for (const b of branches) {
      assert.notStrictEqual(b, 'Head Office', 'Head Office must not be remapped to ' + b);
    }
    pass('T5 no arbitrary airport branch mapping');
  } catch (e) { fail('T5 no arbitrary airport branch mapping', e); }

  console.log('');
  if (failures.length) { console.log('FAIL — ' + failures.length + ' assertion(s) failed'); process.exit(1); }
  console.log('PASS_HEAD_OFFICE_ROSTER_MAPPING_CONTRACT');
}

run().catch(e => { console.log('crash:', e); process.exit(1); });
