/**
 * Phase F regression gate.
 * No hard-coded pass flags: this runner executes behavioral suites.
 *
 * Run: node testing/phase-f-regression.test.js
 */
'use strict'
const path = require('path')
const { spawnSync } = require('child_process')

const suites = [
  'portal-session-p0-recovery.test.js',
]

let failed = 0
for (const suite of suites) {
  const full = path.join(__dirname, suite)
  console.log('\n=== Running ' + suite + ' ===')
  const r = spawnSync(process.execPath, [full], { stdio: 'inherit' })
  if (r.status !== 0) {
    failed++
    console.error('FAIL: ' + suite)
  }
}

if (failed) {
  console.error('\nPhase F behavioral regression: FAIL (' + failed + ' suite)')
  process.exit(1)
}

console.log('\n✓ Phase F behavioral regression PASS: all configured suites executed')
