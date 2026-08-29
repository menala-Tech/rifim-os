// Phase 1 Cancel Isi Saldo — end-to-end contract (RIFIM Finance side).
// Locks in the canonical cancellation lifecycle wired into
// api/internal/hris-contracts.js (mode=finance_saldo_cancel):
//   pending -> cancelled           = PASS (only allowed transition)
//   cancelled -> cancel            = idempotent success (no second PATCH)
//   approved -> cancel             = blocked (not cancellable)
//   rejected -> cancel             = blocked (not cancellable)
//   is_processed(true) -> cancel   = blocked (already lunas)
//   is_archived(true) -> cancel    = blocked (archived)
//   nonexistent id -> cancel       = safe not_found (no throw, no mutation)
//   unauthenticated -> cancel      = 401
//   unauthorized role -> cancel    = 401/403 (financeWrite enforces admin/direksi)
//
// Also asserts:
//   - PATCH URL scope filters (status=pending, is_processed=false, is_archived=false)
//     so a concurrent state change cannot silently overwrite a terminal row.
//   - No new Vercel serverless function was added (dispatcher mode branch).
//
// Run: node testing/finance-saldo-cancel-contract.test.js
'use strict'

process.env.SUPABASE_URL = 'https://qa.supabase.test'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'SVC_ROLE_STUB'
process.env.SUPABASE_PUBLISHABLE_KEY = 'PUB_KEY_STUB'

const assert = require('assert')
const path = require('path')
const fs = require('fs')
const handler = require(path.resolve(__dirname, '..', 'api', 'internal', 'hris-contracts.js'))

function makeRes() {
  const r = { _status: 0, _headers: {}, _body: null }
  r.status = (s) => { r._status = s; return r }
  r.setHeader = (k, v) => { r._headers[k] = v }
  r.end = (b) => { r._body = b }
  return r
}
function req({ method = 'POST', query = {}, body = {}, headers = {} } = {}) {
  return { method, query, body, headers: Object.assign({ authorization: 'Bearer USER_TOKEN' }, headers) }
}

// PATCH capture so we can assert the URL scope filters (defense-in-depth
// against races) and count exactly one PATCH per cancel (never two, never
// zero when transition is legal).
let patches = []

function mockFetch(row, opts) {
  opts = opts || {}
  const role = opts.role || 'admin'
  const bearerOk = opts.bearerOk !== false
  patches = []
  global.fetch = async (url, init = {}) => {
    if (url.includes('/auth/v1/user')) {
      if (!bearerOk) return { ok: false, status: 401, text: async () => JSON.stringify({ message: 'invalid token' }) }
      return { ok: true, status: 200, text: async () => JSON.stringify({ id: 'user-' + role }) }
    }
    if (url.includes('user_profiles?id=eq.')) {
      return { ok: true, status: 200, text: async () => JSON.stringify([{ id: 'user-' + role, role, is_active: true, staff_id: 'S1', branch_id: 'branch-1' }]) }
    }
    if (url.includes('/rest/v1/raos_saldo_requests?id=eq.') && String(init.method || 'GET').toUpperCase() === 'GET' || (url.includes('/rest/v1/raos_saldo_requests?id=eq.') && url.includes('&select='))) {
      return { ok: true, status: 200, text: async () => JSON.stringify(row ? [row] : []) }
    }
    if (url.includes('/rest/v1/raos_saldo_requests?id=eq.') && String(init.method || '').toUpperCase() === 'PATCH') {
      patches.push({ url, body: init.body })
      return { ok: true, status: 204, text: async () => '' }
    }
    if (url.includes('/rest/v1/raos_ops_audit') || url.includes('/rest/v1/raos_ops_log') || url.includes('/rest/v1/ops_audit')) {
      return { ok: true, status: 201, text: async () => '[]' }
    }
    // Any other POST is (harmlessly) audit-adjacent — succeed silently.
    return { ok: true, status: 200, text: async () => '{}' }
  }
}

const failures = []
const pass = n => console.log('  ok  ' + n)
const fail = (n, e) => { failures.push({ n, e }); console.log('  FAIL  ' + n + '\n        ' + (e && e.message || e)) }

async function callCancel(id, opts) {
  const s = makeRes()
  await handler(req({ method: 'POST', query: { mode: 'finance_saldo_cancel' }, body: { id }, headers: opts && opts.headers }), s)
  return { status: s._status, body: JSON.parse(s._body || '{}') }
}

async function run() {
  // T1 — pending -> cancelled = PASS, exactly one PATCH with race-safe filters.
  try {
    mockFetch({ id: 'r1', status: 'pending', is_processed: false, is_archived: false })
    const r = await callCancel('r1')
    assert.strictEqual(r.status, 200, 'HTTP 200 expected')
    assert.strictEqual(r.body.success, true)
    assert.strictEqual(r.body.status, 'cancelled')
    assert.strictEqual(patches.length, 1, 'exactly one PATCH expected')
    assert.ok(/status=eq\.pending/.test(patches[0].url), 'PATCH URL must scope status=pending')
    assert.ok(/is_processed=eq\.false/.test(patches[0].url), 'PATCH URL must scope is_processed=false')
    assert.ok(/is_archived=eq\.false/.test(patches[0].url), 'PATCH URL must scope is_archived=false')
    const payload = JSON.parse(patches[0].body || '{}')
    assert.strictEqual(payload.status, 'cancelled', 'PATCH payload must set status=cancelled')
    pass('T1 pending -> cancelled PATCHes exactly once with race-safe filters')
  } catch (e) { fail('T1 pending -> cancelled PATCHes exactly once with race-safe filters', e) }

  // T2 — cancelled -> cancel = idempotent success (no second PATCH).
  try {
    mockFetch({ id: 'r2', status: 'cancelled', is_processed: false, is_archived: false })
    const r = await callCancel('r2')
    assert.strictEqual(r.status, 200)
    assert.strictEqual(r.body.success, true)
    assert.strictEqual(r.body.status, 'already_cancelled')
    assert.strictEqual(patches.length, 0, 'no PATCH for idempotent second cancel')
    pass('T2 second cancel is idempotent (no PATCH)')
  } catch (e) { fail('T2 second cancel is idempotent (no PATCH)', e) }

  // T3 — approved -> cancel = blocked.
  try {
    mockFetch({ id: 'r3', status: 'approved', is_processed: false, is_archived: false })
    const r = await callCancel('r3')
    assert.notStrictEqual(r.status, 200, 'approved cancel must not 200-succeed')
    assert.strictEqual(r.body.success, false)
    assert.ok(/tidak dapat dibatalkan/i.test(String(r.body.message || '')), 'message must explain non-cancellable state')
    assert.strictEqual(patches.length, 0)
    pass('T3 approved cancel blocked')
  } catch (e) { fail('T3 approved cancel blocked', e) }

  // T4 — rejected -> cancel = blocked.
  try {
    mockFetch({ id: 'r4', status: 'rejected', is_processed: false, is_archived: false })
    const r = await callCancel('r4')
    assert.notStrictEqual(r.status, 200)
    assert.strictEqual(r.body.success, false)
    assert.strictEqual(patches.length, 0)
    pass('T4 rejected cancel blocked')
  } catch (e) { fail('T4 rejected cancel blocked', e) }

  // T5 — paid (is_processed=true) -> cancel = blocked with clear message.
  try {
    mockFetch({ id: 'r5', status: 'approved', is_processed: true, is_archived: false })
    const r = await callCancel('r5')
    assert.notStrictEqual(r.status, 200)
    assert.strictEqual(r.body.success, false)
    assert.ok(/sudah diproses|lunas/i.test(String(r.body.message || '')), 'message must reference already-processed / lunas')
    assert.strictEqual(patches.length, 0)
    pass('T5 paid/processed cancel blocked')
  } catch (e) { fail('T5 paid/processed cancel blocked', e) }

  // T6 — archived -> cancel = blocked with clear message.
  try {
    mockFetch({ id: 'r6', status: 'pending', is_processed: false, is_archived: true })
    const r = await callCancel('r6')
    assert.notStrictEqual(r.status, 200)
    assert.strictEqual(r.body.success, false)
    assert.ok(/diarsipkan|archived/i.test(String(r.body.message || '')), 'message must reference archived')
    assert.strictEqual(patches.length, 0)
    pass('T6 archived cancel blocked (no hard delete, no status flip)')
  } catch (e) { fail('T6 archived cancel blocked (no hard delete, no status flip)', e) }

  // T7 — nonexistent ID = safe not_found, no PATCH.
  try {
    mockFetch(null)
    const r = await callCancel('r-does-not-exist')
    assert.strictEqual(r.status, 200, 'not_found is a safe soft response, not 500')
    assert.strictEqual(r.body.success, true)
    assert.strictEqual(r.body.status, 'not_found')
    assert.strictEqual(patches.length, 0)
    pass('T7 nonexistent id returns safe not_found (no mutation)')
  } catch (e) { fail('T7 nonexistent id returns safe not_found (no mutation)', e) }

  // T8 — missing id = rejected up-front (never fetches the row).
  try {
    mockFetch({ id: 'x', status: 'pending', is_processed: false, is_archived: false })
    const r = await callCancel('')
    assert.notStrictEqual(r.status, 200)
    assert.strictEqual(r.body.success, false)
    assert.ok(/id wajib/i.test(String(r.body.message || '')))
    assert.strictEqual(patches.length, 0)
    pass('T8 empty id rejected up-front')
  } catch (e) { fail('T8 empty id rejected up-front', e) }

  // T9 — unauthenticated (bad Bearer) = actor() rejects before any Supabase read.
  try {
    mockFetch({ id: 'r9', status: 'pending', is_processed: false, is_archived: false }, { bearerOk: false })
    const r = await callCancel('r9')
    assert.notStrictEqual(r.status, 200)
    assert.strictEqual(r.body.success, false)
    assert.strictEqual(patches.length, 0, 'no PATCH must fire when unauthenticated')
    pass('T9 unauthenticated cancel rejected before any Supabase mutation')
  } catch (e) { fail('T9 unauthenticated cancel rejected before any Supabase mutation', e) }

  // T10 — unauthorized role (koordinator/staff/management) = financeWrite rejects.
  for (const role of ['koordinator', 'staff', 'management']) {
    try {
      mockFetch({ id: 'r10-' + role, status: 'pending', is_processed: false, is_archived: false }, { role })
      const r = await callCancel('r10-' + role)
      assert.notStrictEqual(r.status, 200)
      assert.strictEqual(r.body.success, false)
      assert.ok(/Admin|Direksi|Finance/i.test(String(r.body.message || '')))
      assert.strictEqual(patches.length, 0, role + ' must not PATCH')
      pass('T10 role=' + role + ' cannot cancel (financeWrite)')
    } catch (e) { fail('T10 role=' + role + ' cannot cancel (financeWrite)', e) }
  }

  // T11 — SSOT sanity: split-brain alias `cancelled -> rejected` is REMOVED.
  //       Reading the source (dispatcher + internal module) guarantees future
  //       edits don't reintroduce it after Phase 2 refactor.
  try {
    const src = fs.readFileSync(path.resolve(__dirname, '..', 'api', 'internal', 'hris-contracts.js'), 'utf8') +
                '\n' + fs.readFileSync(path.resolve(__dirname, '..', 'api', 'internal', '_modules', 'finance-saldo.js'), 'utf8')
    assert.ok(/SALDO_STATUS_WHITELIST\s*=\s*new Set\(\[[^\]]*'cancelled'[^\]]*\]\)/.test(src), 'whitelist must include cancelled')
    assert.ok(!/'cancelled'\s*:\s*'rejected'/.test(src), 'split-brain alias cancelled->rejected must NOT be reintroduced')
    assert.ok(/'dibatalkan'\s*:\s*'cancelled'/.test(src), 'display alias dibatalkan must map to cancelled, not rejected')
    pass('T11 split-brain alias cancelled->rejected is not present (canonical is preserved)')
  } catch (e) { fail('T11 split-brain alias cancelled->rejected is not present (canonical is preserved)', e) }

  // T12 — Function count sanity: /api directory has no new saldo cancel route
  //       (Vercel Hobby cap 12; cancellation MUST be a dispatcher mode branch).
  try {
    const apiDir = path.resolve(__dirname, '..', 'api')
    function walk(d, acc) {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name)
        if (e.isDirectory()) walk(p, acc)
        else if (/\.(js|ts|mjs|cjs)$/.test(e.name)) acc.push(p)
      }
      return acc
    }
    const routes = walk(apiDir, []).filter(p => !p.includes(path.sep + '_lib' + path.sep) && !p.includes(path.sep + '_modules' + path.sep) && !/^_/.test(path.basename(p)))
    assert.ok(routes.length <= 12, 'Vercel function count must remain <= 12 (found ' + routes.length + ')')
    assert.ok(!routes.some(p => /saldo.cancel/i.test(path.basename(p))), 'no standalone saldo-cancel serverless function may exist')
    pass('T12 Vercel function count still <= 12 and no standalone saldo-cancel route (found ' + routes.length + ')')
  } catch (e) { fail('T12 Vercel function count still <= 12 and no standalone saldo-cancel route', e) }

  console.log('')
  if (failures.length) { console.log('FAIL — ' + failures.length + ' assertion(s) failed'); process.exit(1) }
  console.log('ALL PASSED')
}

run().catch(e => { console.log('crash:', e); process.exit(1) })
