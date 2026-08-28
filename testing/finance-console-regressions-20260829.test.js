// 2026-08-29 console regression coverage:
//   - /api/internal/hris-contracts?mode=finance_saldo_list no longer 400s
//     on aliased/unknown status values; canonical values still work.
//   - /api/internal/aist-agent/status still fail-closed for unauthorized.
//
// Run: node testing/finance-console-regressions-20260829.test.js

'use strict'

process.env.SUPABASE_URL = 'https://qa.supabase.test'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'SVC_ROLE_STUB'
process.env.SUPABASE_PUBLISHABLE_KEY = 'PUB_KEY_STUB'

const assert = require('assert')
const path = require('path')
const handler = require(path.resolve(__dirname, '..', 'api', 'internal', 'hris-contracts.js'))
const aistStatus = require(path.resolve(__dirname, '..', 'api', 'internal', 'aist-agent', 'status.js'))

function makeRes() {
  const r = { _status: 0, _headers: {}, _body: null }
  r.status = (s) => { r._status = s; return r }
  r.setHeader = (k, v) => { r._headers[k] = v }
  r.end = (b) => { r._body = b }
  return r
}

function req({ method = 'GET', query = {}, body = {}, headers = {} } = {}) {
  return { method, query, body, headers: Object.assign({ authorization: 'Bearer USER_TOKEN' }, headers) }
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

  try {
    mockFetch(authRoutes('admin').concat([
      { match: u => u.includes('/rest/v1/raos_saldo_requests'), body: (url) => {
        if (url.includes('status=eq.cancelled')) throw new Error('cancelled must not reach Supabase raw')
        if (url.includes('status=eq.ditolak')) throw new Error('ditolak must not reach Supabase raw')
        if (url.includes('status=eq.semua')) throw new Error('semua must not reach Supabase raw')
        return [{ id: 'r1', status: 'rejected' }]
      }},
    ]))
    const r1 = req({ method: 'GET', query: { mode: 'finance_saldo_list', status: 'cancelled' } })
    const s1 = makeRes(); await handler(r1, s1)
    const b1 = JSON.parse(s1._body)
    assert.strictEqual(s1._status, 200, 'cancelled alias must not 400')
    assert.strictEqual(b1.success, true)
    pass('finance_saldo_list status=cancelled (mapped to rejected) does not 400')
  } catch (e) { fail('finance_saldo_list status=cancelled (mapped to rejected) does not 400', e) }

  try {
    mockFetch(authRoutes('admin').concat([
      { match: u => u.includes('/rest/v1/raos_saldo_requests'), body: (url) => {
        assert.ok(!url.includes('status=eq.unknown'), 'unknown status must not be passed raw')
        return [{ id: 'r2' }]
      }},
    ]))
    const r2 = req({ method: 'GET', query: { mode: 'finance_saldo_list', status: 'unknown' } })
    const s2 = makeRes(); await handler(r2, s2)
    const b2 = JSON.parse(s2._body)
    assert.strictEqual(s2._status, 200, 'unknown status must not 400')
    assert.strictEqual(b2.success, true)
    pass('finance_saldo_list status=unknown is ignored, not 400')
  } catch (e) { fail('finance_saldo_list status=unknown is ignored, not 400', e) }

  try {
    mockFetch(authRoutes('admin').concat([
      { match: u => u.includes('/rest/v1/raos_saldo_requests'), body: (url) => {
        assert.ok(url.includes('status=eq.rejected'), 'rejected must reach Supabase')
        return [{ id: 'r3', status: 'rejected' }]
      }},
    ]))
    const r3 = req({ method: 'GET', query: { mode: 'finance_saldo_list', status: 'rejected' } })
    const s3 = makeRes(); await handler(r3, s3)
    const b3 = JSON.parse(s3._body)
    assert.strictEqual(s3._status, 200)
    assert.strictEqual(b3.success, true)
    pass('finance_saldo_list status=rejected canonical still works')
  } catch (e) { fail('finance_saldo_list status=rejected canonical still works', e) }

  try {
    mockFetch([
      { match: u => u.includes('/auth/v1/user'), status: 401, body: { message: 'invalid token' } }
    ])
    const r4 = req({ method: 'GET', headers: { authorization: 'Bearer bad-token' } })
    const s4 = makeRes(); await aistStatus(r4, s4)
    assert.strictEqual(s4._status, 401, 'aist-agent/status must 401 on bad token')
    const b4 = JSON.parse(s4._body)
    assert.strictEqual(b4.success, false)
    pass('aist-agent/status unauthorized still fails closed 401')
  } catch (e) { fail('aist-agent/status unauthorized still fails closed 401', e) }

  console.log('\n' + (failures.length ? 'FAILED ' + failures.length : 'ALL PASSED'))
  process.exit(failures.length ? 1 : 0)
}

run().catch(e => { console.error(e); process.exit(2) })
