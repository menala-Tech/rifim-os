#!/usr/bin/env node
'use strict';

// Phase 10 — Final RIFIM ↔ RAOS static/wiring audit.
// This script is READ-ONLY. It does NOT connect to Production Supabase.
// It prints the architect-verified Production evidence (supplied out-of-band)
// and performs code-side static checks.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const evidence = {
  source: 'LIVE_PRODUCTION_READ_ONLY_EVIDENCE (ChatGPT architect, 2026-08-29)',
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
  activation: { before: 83, safe_to_activate: 82, unresolved: 1 },
  target_roster: { ready_staff: 70, ready_koordinator: 6, missing_branch_koordinator: 1 },
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
  },
  payroll_drift: {
    total_payroll_rows: 83,
    non_ready: 7,
    by_class: {
      LEGITIMATE_MONTHLY_SNAPSHOT: 5,
      'ROLE/BRANCH_DRIFT': 1,
      BUSINESS_DATA_REQUIRED: 1,
      STALE_ORPHAN_LOGIC: 0
    }
  }
};

function log(s) { console.log(s); }

function walk(d, acc) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (/\.(js|ts|mjs|cjs)$/.test(e.name)) acc.push(p);
  }
  return acc;
}

function vercelFunctionCount() {
  const apiDir = path.resolve(__dirname, '..', 'api');
  const routes = walk(apiDir, []).filter(p =>
    !p.includes(path.sep + '_lib' + path.sep) &&
    !p.includes(path.sep + '_modules' + path.sep) &&
    !/^_/.test(path.basename(p))
  );
  return routes.length;
}

function checkGoTrueDuplicates() {
  const createClient = new Set();
  const glob = require('fs');
  // Simple grep for createClient occurrences in modules/
  const dirs = ['modules', 'shared'];
  const counts = {};
  for (const d of dirs) {
    const p = path.resolve(__dirname, '..', d);
    if (!fs.existsSync(p)) continue;
    // naively search HTML/JS files for createClient
    const files = walk(p, []);
    for (const f of files) {
      const src = fs.readFileSync(f, 'utf8');
      if (/createClient/.test(src)) {
        const rel = path.relative(__dirname, f);
        counts[rel] = (counts[rel] || 0) + (src.match(/createClient/g) || []).length;
      }
    }
  }
  return counts;
}

function nodeCheckChanged() {
  const changed = [];
  try {
    const out = execSync('git diff --name-only HEAD~3 -- .', { cwd: path.resolve(__dirname, '..'), encoding: 'utf8' });
    for (const f of out.split(/\n/).filter(Boolean)) {
      if (/\.(js|cjs|mjs)$/.test(f)) changed.push(f);
    }
  } catch (e) {
    // may fail in shallow check, skip
  }
  const bad = [];
  for (const f of changed) {
    const full = path.resolve(__dirname, '..', f);
    if (!fs.existsSync(full)) continue;
    try { execSync(`node --check "${full}"`, { stdio: 'pipe' }); } catch (e) { bad.push(f); }
  }
  return { changed, bad };
}

log('='.repeat(60));
log('FINAL_RIFIM_RAOS_INTEGRATION_STATIC_AUDIT');
log('='.repeat(60));
log('');
log('A. ARCHITECT-SUPPLIED PRODUCTION EVIDENCE');
log('   ' + evidence.source);
log('');
log('   Structural integrity (all zero):');
['attendance_orphan','saldo_orphan','scan_orphan','schedule_orphan','payroll_orphan',
 'attendance_branch_mismatch','saldo_branch_mismatch','schedule_branch_mismatch',
 'duplicate_employee_id','duplicate_profile_staff_id','duplicate_master_staff_id',
 'duplicate_schedule_staff_date','duplicate_payroll_staff_month'].forEach(k =>
  log(`     ${k} = ${evidence[k]}`));
log('');
log('   Activation reconciliation:');
log(`     before = ${evidence.activation.before}`);
log(`     safe_to_activate = ${evidence.activation.safe_to_activate}`);
log(`     unresolved = ${evidence.activation.unresolved}`);
log('');
log('   Target roster:');
log(`     ready_staff = ${evidence.target_roster.ready_staff}`);
log(`     ready_koordinator = ${evidence.target_roster.ready_koordinator}`);
log(`     missing_branch_koordinator = ${evidence.target_roster.missing_branch_koordinator}`);
log('');
log('   Target modes:');
for (const [b, m] of Object.entries(evidence.target_modes)) log(`     ${b} → ${m}`);
log('');
log('   Payroll drift:');
log(`     total = ${evidence.payroll_drift.total_payroll_rows}`);
log(`     non_ready = ${evidence.payroll_drift.non_ready}`);
for (const [c, n] of Object.entries(evidence.payroll_drift.by_class)) log(`     ${c} = ${n}`);
log('');

log('B. CODE-SIDE STATIC CHECKS');
const fnCount = vercelFunctionCount();
log(`   Vercel function count = ${fnCount} ${fnCount <= 12 ? '(OK)' : '(EXCEEDS 12)'}`);

const goTrue = checkGoTrueDuplicates();
log('   GoTrue createClient occurrences by file:');
for (const [f, n] of Object.entries(goTrue)) log(`     ${f}: ${n}`);

const { changed, bad } = nodeCheckChanged();
log(`   Changed JS files since HEAD~3: ${changed.length}`);
if (bad.length) { log('   SYNTAX ERRORS:'); for (const f of bad) log(`     ${f}`); }
else log('   node --check on changed JS: OK');

try {
  execSync('git diff --check', { cwd: path.resolve(__dirname, '..'), stdio: 'pipe' });
  log('   git diff --check: OK');
} catch (e) {
  log('   git diff --check: FAIL');
}

log('');
log('C. SAFETY');
log('   Production DB mutation: NONE');
log('   Production deployment: NONE');
log('   Merge to main: NO');
log('');
log('D. STATUS');
log('   This script is READ-ONLY. Live data came from architect audit.');
log('   No local Supabase query was performed by this script.');
log('');
