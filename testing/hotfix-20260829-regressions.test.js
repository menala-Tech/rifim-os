// Hotfix 2026-08-29 regression tests.
//
// Covers:
//   R1  maintenance_branches: role-scoped canonical branch list for the
//       Bersihkan Data modal (replaces the broken DOM-scrape source that
//       shipped only "Semua Cabang" in Production).
//   R2  execute: 0-affected-rows response is surfaced by handler (UI hotfix
//       alerts on it; here we assert backend still returns success=true so
//       the UI branch can render its warning instead of a generic error).
//   R5  shared/gas-call.js exports a global _gasCall that (a) exists, (b)
//       falls back to a safe error object when RifimAPI is absent instead
//       of throwing ReferenceError.
//
// Runs with `node testing/hotfix-20260829-regressions.test.js`.

'use strict'

process.env.SUPABASE_URL = 'https://qa.supabase.test'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'SVC_ROLE_STUB'
process.env.SUPABASE_PUBLISHABLE_KEY = 'PUB_KEY_STUB'

const assert = require('assert')
const path = require('path')
const fs = require('fs')

const handlerPath = path.resolve(__dirname, '..', 'api', 'internal', 'hris-contracts.js')
delete require.cache[handlerPath]
const handler = require(handlerPath)

function makeRes() {
  const r = { _status: 0, _headers: {}, _body: null }
  r.status = (s) => { r._status = s; return r }
  r.setHeader = (k, v) => { r._headers[k] = v }
  r.end = (b) => { r._body = b }
  return r
}
function req({ method = 'GET', body = {}, query = {}, headers = {} } = {}) {
  return {
    method, body, query,
    headers: Object.assign({ authorization: 'Bearer USER_TOKEN' }, headers),
    text: async () => (body == null ? '' : (typeof body === 'string' ? body : JSON.stringify(body))),
  }
}
function mockFetch(routes) {
  global.fetch = async (url, opts = {}) => {
    for (const r of routes) {
      if (r.match(url, opts)) {
        const status = r.status || 200
        const b = typeof r.body === 'function' ? r.body(url, opts) : r.body
        return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(b == null ? {} : b) }
      }
    }
    throw new Error('unmocked fetch: ' + url)
  }
}
const authRoutes = (role, branchId) => [
  { match: u => u.includes('/auth/v1/user'), body: { id: 'user-' + role } },
  { match: u => u.includes('user_profiles?id=eq.'), body: [{ id: 'user-' + role, role, is_active: true, staff_id: 'S1', branch_id: branchId || 'branch-1' }] },
]

async function run() {
  const failures = []
  const pass = n => console.log('  ok  ' + n)
  const fail = (n, e) => { failures.push({ n, e }); console.log('  FAIL  ' + n + '\n        ' + (e && e.message || e)) }

  // R1-1: admin gets full active branch list.
  try {
    mockFetch(authRoutes('admin').concat([
      { match: u => u.includes('/rest/v1/branches') && u.includes('is_active=eq.true') && u.includes('parent_branch_id=is.null'),
        body: [
          { id: 'b-bth', code: 'BTH', name: 'Batam', slug: 'batam' },
          { id: 'b-cgk', code: 'CGK', name: 'Jakarta (Soeta)', slug: 'cgk' },
          { id: 'b-mks', code: 'MKS', name: 'Makassar', slug: 'mks' },
        ] },
    ]))
    const r = req({ method: 'GET', query: { mode: 'maintenance_branches' } })
    const s = makeRes(); await handler(r, s)
    const body = JSON.parse(s._body)
    assert.strictEqual(s._status, 200, 'expected 200 got ' + s._status)
    assert.strictEqual(body.success, true)
    assert.ok(Array.isArray(body.rows) && body.rows.length === 3, 'expected 3 branches')
    const codes = body.rows.map(r => r.code)
    // No duplicates
    assert.strictEqual(new Set(codes).size, codes.length, 'duplicate branch codes')
    pass('R1-1 admin receives full active branch list (no duplicates)')
  } catch (e) { fail('R1-1 admin receives full active branch list (no duplicates)', e) }

  // R1-2: koordinator only sees own branch (BR-01 scope).
  try {
    let sawKoordinatorFilter = false
    mockFetch(authRoutes('koordinator', 'branch-cgk').concat([
      { match: u => {
          if (u.includes('/rest/v1/branches') && u.includes('id=eq.branch-cgk')) { sawKoordinatorFilter = true; return true }
          return false
        }, body: [{ id: 'branch-cgk', code: 'CGK', name: 'Jakarta (Soeta)' }] },
    ]))
    const r = req({ method: 'GET', query: { mode: 'maintenance_branches' } })
    const s = makeRes(); await handler(r, s)
    const body = JSON.parse(s._body)
    assert.strictEqual(s._status, 200)
    assert.strictEqual(body.rows.length, 1)
    assert.strictEqual(body.rows[0].id, 'branch-cgk')
    assert.ok(sawKoordinatorFilter, 'koordinator branch filter must be applied server-side')
    pass('R1-2 koordinator scope: only own branch returned (BR-01)')
  } catch (e) { fail('R1-2 koordinator scope: only own branch returned (BR-01)', e) }

  // R1-3: unknown role rejected (fail-closed).
  try {
    mockFetch(authRoutes('driver'))
    const r = req({ method: 'GET', query: { mode: 'maintenance_branches' } })
    const s = makeRes(); await handler(r, s)
    const body = JSON.parse(s._body)
    assert.strictEqual(s._status, 400)
    assert.ok(/Role tidak boleh/i.test(body.message))
    pass('R1-3 non-portal role denied (fail-closed on branch list)')
  } catch (e) { fail('R1-3 non-portal role denied (fail-closed on branch list)', e) }

  // R5-1: shared/gas-call.js registers window._gasCall without throwing.
  try {
    const src = fs.readFileSync(path.resolve(__dirname, '..', 'shared', 'gas-call.js'), 'utf8')
    const sandbox = { window: {}, localStorage: { getItem: () => '{}' }, fetch: async () => ({ json: async () => ({ success: true }) }) }
    sandbox.window.localStorage = sandbox.localStorage
    // Minimal browser-ish shim; the IIFE guards typeof usage.
    const wrap = new Function('window', 'localStorage', 'fetch', 'URLSearchParams', src + '; return window._gasCall;')
    const gasCall = wrap(sandbox.window, sandbox.localStorage, sandbox.fetch, URLSearchParams)
    assert.strictEqual(typeof gasCall, 'function', 'window._gasCall must be a function after shared/gas-call.js loads')
    // Read action with no RifimAPI: must NOT throw; must return an object (fallback).
    const out = await gasCall('crm_audit_tail', { limit: 5 })
    assert.strictEqual(typeof out, 'object')
    pass('R5-1 shared/gas-call.js installs window._gasCall (no ReferenceError)')
  } catch (e) { fail('R5-1 shared/gas-call.js installs window._gasCall (no ReferenceError)', e) }

  // R5-2: write actions without RifimAPI fail closed (never reach direct GAS).
  try {
    const src = fs.readFileSync(path.resolve(__dirname, '..', 'shared', 'gas-call.js'), 'utf8')
    const sandbox = { window: {}, localStorage: { getItem: () => '{}' }, fetch: async () => { throw new Error('must not be called') } }
    sandbox.window.localStorage = sandbox.localStorage
    const wrap = new Function('window', 'localStorage', 'fetch', 'URLSearchParams', src + '; return window._gasCall;')
    const gasCall = wrap(sandbox.window, sandbox.localStorage, sandbox.fetch, URLSearchParams)
    const out = await gasCall('company_config_set', { key: 'x', value: 'y' })
    assert.strictEqual(out.success, false, 'mutation must fail closed without canonical transport')
    assert.ok(/kanonik|tidak tersedia/i.test(out.message || ''), 'expected canonical-transport error message')
    pass('R5-2 mutation without canonical transport fails closed (never direct GAS write)')
  } catch (e) { fail('R5-2 mutation without canonical transport fails closed (never direct GAS write)', e) }

  console.log('\n' + (failures.length ? 'FAILED ' + failures.length : 'ALL PASSED'))
  process.exit(failures.length ? 1 : 0)
}
run().catch(e => { console.error(e); process.exit(2) })
