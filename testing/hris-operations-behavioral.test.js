// hris operations behavioral coverage — activate / reconcile / staff_sync
// modes on the consolidated hris-contracts endpoint.
//
// The three modes previously lived in api/internal/hris-operations.js and were
// merged into api/internal/hris-contracts.js on 2026-08-28 to keep the
// deployment ≤12 Vercel Serverless Functions (Hobby cap). Mode names were
// renamed to their canonical namespaced form at the same time:
//   activate                       → hris_activate
//   activation_reconcile_preview   → hris_activation_reconcile_preview
//   activation_reconcile_apply     → hris_activation_reconcile_apply
//   staff_sync                     → hris_staff_sync
//
// Contract locked in (unchanged from the pre-consolidation shape):
//   - POST only
//   - Every mode needs admin/direksi
//   - RPC errors translated to operational Indonesian messages
//   - Failed activations write audit trail
//   - Caller bearer forwarded to user-context RPCs (activation, reconcile)
//   - Staff sync uses service-role only for reading master + calling upsert RPC

'use strict'

process.env.SUPABASE_URL = 'https://qa.supabase.test'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'SVC_ROLE_STUB'
process.env.SUPABASE_PUBLISHABLE_KEY = 'PUB_KEY_STUB'

const assert = require('assert')
const path = require('path')
const handlerPath = path.resolve(__dirname, '..', 'api', 'internal', 'hris-contracts.js')
delete require.cache[handlerPath]
const handler = require(handlerPath)

let calls = []
const originalFetch = global.fetch

function makeRes() {
  const r = { _status: 0, _headers: {}, _body: null }
  r.status = (s) => { r._status = s; return r }
  r.setHeader = (k, v) => { r._headers[k] = v }
  r.end = (b) => { r._body = b }
  return r
}
function req({ method = 'POST', body = {}, headers = {} } = {}) {
  return {
    method, body, query: {},
    headers: Object.assign({ authorization: 'Bearer USER_TOKEN' }, headers),
    text: async () => (body == null ? '' : (typeof body === 'string' ? body : JSON.stringify(body))),
  }
}
function mockFetch(routes) {
  calls = []
  global.fetch = async (url, opts = {}) => {
    calls.push({ url: String(url), opts })
    for (const r of routes) {
      if (r.match(url, opts)) {
        const status = r.status || 200
        const bodyObj = typeof r.body === 'function' ? r.body(url, opts) : r.body
        return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(bodyObj == null ? {} : bodyObj) }
      }
    }
    throw new Error('unmocked fetch: ' + url)
  }
}
const authRoutes = (role) => [
  { match: u => u.includes('/auth/v1/user'), body: { id: 'user-' + role } },
  { match: u => u.includes('user_profiles?id='), body: [{ id: 'user-' + role, role, is_active: true }] },
]

async function run() {
  const failures = [], results = []
  const pass = n => { results.push({ n, ok: true }); console.log('  ok  ' + n) }
  const fail = (n, e) => { failures.push({ n, e }); results.push({ n, ok: false }); console.log('  FAIL  ' + n + '\n        ' + (e && e.message || e)) }

  // H1: staff denied on activate
  try {
    mockFetch(authRoutes('staff').concat([{ match: u => u.includes('rifim_ops_audit_log'), body: {} }]))
    const r = req({ body: { mode: 'hris_activate', employee_id: 'E001' } })
    const s = makeRes(); await handler(r, s)
    const body = JSON.parse(s._body)
    assert.strictEqual(s._status, 400)
    assert.ok(/Admin\/Direksi/i.test(body.message))
    pass('H1 staff denied on activate (role guard)')
  } catch (e) { fail('H1 staff denied on activate (role guard)', e) }

  // H2: admin activate — RPC returns row → success with Indonesian success message
  try {
    mockFetch(authRoutes('admin').concat([
      { match: u => u.includes('/rpc/hris_activate_employee'), body: { employee_id: 'E001', full_name: 'Test', activation_state: 'active' } },
    ]))
    const r = req({ body: { mode: 'hris_activate', employee_id: 'E001' } })
    const s = makeRes(); await handler(r, s)
    const body = JSON.parse(s._body)
    assert.strictEqual(s._status, 200)
    assert.strictEqual(body.success, true)
    assert.ok(/berhasil diaktifkan/i.test(body.message))
    pass('H2 admin activate success returns row + Indonesian message')
  } catch (e) { fail('H2 admin activate success returns row + Indonesian message', e) }

  // H3: activate with validated_active_contract_required → operational Indonesian message
  try {
    mockFetch(authRoutes('admin').concat([
      { match: u => u.includes('/rpc/hris_activate_employee'), status: 400, body: { message: 'validated_active_contract_required' } },
      { match: u => u.includes('rifim_ops_audit_log'), body: {} },
    ]))
    const r = req({ body: { mode: 'hris_activate', employee_id: 'E001' } })
    const s = makeRes(); await handler(r, s)
    const body = JSON.parse(s._body)
    assert.strictEqual(s._status, 400)
    assert.ok(/kontrak aktif yang tervalidasi/i.test(body.message))
    assert.ok(!/validated_active_contract_required/i.test(body.message), 'raw exception must NOT leak to owner UI')
    pass('H3 activate error translated to operational Indonesian (no raw exception leak)')
  } catch (e) { fail('H3 activate error translated to operational Indonesian (no raw exception leak)', e) }

  // H4: management denied on reconcile apply
  try {
    mockFetch(authRoutes('management').concat([{ match: u => u.includes('rifim_ops_audit_log'), body: {} }]))
    const r = req({ body: { mode: 'hris_activation_reconcile_apply' } })
    const s = makeRes(); await handler(r, s)
    const body = JSON.parse(s._body)
    assert.strictEqual(s._status, 400)
    assert.ok(/Admin\/Direksi/i.test(body.message))
    pass('H4 management denied on reconcile apply (write-role guard)')
  } catch (e) { fail('H4 management denied on reconcile apply (write-role guard)', e) }

  // H5: admin reconcile preview forwards p_apply=false and returns result
  try {
    let capturedApply = null
    mockFetch(authRoutes('admin').concat([
      { match: u => u.includes('/rpc/hris_reconcile_activation_states'),
        body: (u, o) => { capturedApply = JSON.parse(o.body).p_apply; return { before_count: 3, reconciled_ssot: 2, reconciled_contract: 0, unresolved: 1, after_count: 1, applied: capturedApply } } },
    ]))
    const r = req({ body: { mode: 'hris_activation_reconcile_preview' } })
    const s = makeRes(); await handler(r, s)
    const body = JSON.parse(s._body)
    assert.strictEqual(s._status, 200)
    assert.strictEqual(capturedApply, false, 'preview must send p_apply=false')
    assert.strictEqual(body.result.before_count, 3)
    pass('H5 reconcile preview sends p_apply=false + returns dry-run counts')
  } catch (e) { fail('H5 reconcile preview sends p_apply=false + returns dry-run counts', e) }

  // H6: reconcile apply forwards p_apply=true
  try {
    let capturedApply = null
    mockFetch(authRoutes('admin').concat([
      { match: u => u.includes('/rpc/hris_reconcile_activation_states'),
        body: (u, o) => { capturedApply = JSON.parse(o.body).p_apply; return { before_count: 3, reconciled_ssot: 2, reconciled_contract: 0, unresolved: 1, after_count: 1, applied: true } } },
    ]))
    const r = req({ body: { mode: 'hris_activation_reconcile_apply' } })
    const s = makeRes(); await handler(r, s)
    const body = JSON.parse(s._body)
    assert.strictEqual(s._status, 200)
    assert.strictEqual(capturedApply, true, 'apply must send p_apply=true')
    assert.strictEqual(body.result.after_count, 1)
    pass('H6 reconcile apply sends p_apply=true')
  } catch (e) { fail('H6 reconcile apply sends p_apply=true', e) }

  // H7: reconcile RPC calls forward caller bearer, not service-role
  try {
    let rpcAuth = null
    mockFetch(authRoutes('admin').concat([
      { match: u => u.includes('/rpc/hris_reconcile_activation_states'),
        body: (u, o) => { rpcAuth = String(o.headers.Authorization || ''); return { before_count: 0, reconciled_ssot: 0, reconciled_contract: 0, unresolved: 0, after_count: 0, applied: false } } },
    ]))
    const r = req({ body: { mode: 'hris_activation_reconcile_preview' } })
    const s = makeRes(); await handler(r, s)
    assert.ok(rpcAuth.includes('USER_TOKEN'), 'must forward user bearer')
    assert.ok(!rpcAuth.includes('SVC_ROLE_STUB'), 'must NOT use service-role for user-scoped RPC')
    pass('H7 reconcile RPC uses caller bearer, not service-role')
  } catch (e) { fail('H7 reconcile RPC uses caller bearer, not service-role', e) }

  // H8: staff_sync — happy path (admin, master + SSOT + upsert + audit)
  try {
    mockFetch(authRoutes('admin').concat([
      { match: u => u.includes('/rest/v1/raos_staff_master?select='), body: [
        { staff_id: 'S001', full_name: 'Alice', email: 'a@x.co', phone: '628', branch_id: 'b1', airport: 'SOETA', terminal: 'T1', role: 'staff', status: 'Aktif', auth_user_id: null },
      ] },
      { match: u => u.includes('/rest/v1/branches?select='), body: [{ id: 'b1', slug: 'soeta-t1', name: 'SOETA T1', code: 'T1' }] },
      { match: u => u.includes('/rest/v1/employees?select='), body: [] },
      { match: u => u.includes('/rest/v1/raos_hris_employee_defaults?select='), body: [{ staff_id: 'S001' }] },
      { match: u => u.includes('/rpc/raos_sync_staff_ssot_records'), body: { synced: 1 } },
      { match: u => u.includes('/rest/v1/raos_staff_ssot_records?select='),
        body: [{ staff_id: 'S001', full_name: 'Alice', email: 'a@x.co', phone: '628', legacy_branch_name: 'soeta-t1', branch_id: 'b1', resolved_role: 'staff', status_active: true, conflict_status: 'none' }] },
      { match: u => u.includes('/rpc/raos_hris_upsert_employees'), body: { inserted: 1, updated: 0, skipped: 0, errors: [] } },
      { match: u => u.includes('rifim_ops_audit_log'), body: {} },
    ]))
    const r = req({ body: { mode: 'hris_staff_sync' } })
    const s = makeRes(); await handler(r, s)
    const body = JSON.parse(s._body)
    assert.strictEqual(s._status, 200)
    assert.strictEqual(body.summary.total_source, 1)
    assert.strictEqual(body.summary.added, 1)
    assert.strictEqual(body.summary.eligible, 1)
    assert.ok(body.summary.hris)
    pass('H8 staff_sync happy path returns real counts + writes audit')
  } catch (e) { fail('H8 staff_sync happy path returns real counts + writes audit', e) }

  // H9: staff_sync skips new employee without HRIS defaults (missing_hris_defaults)
  try {
    mockFetch(authRoutes('admin').concat([
      { match: u => u.includes('/rest/v1/raos_staff_master?select='), body: [
        { staff_id: 'S002', full_name: 'Bob', email: 'b@x.co', phone: '628', branch_id: 'b1', airport: 'SOETA', terminal: 'T1', role: 'staff', status: 'Aktif', auth_user_id: null },
      ] },
      { match: u => u.includes('/rest/v1/branches?select='), body: [{ id: 'b1', slug: 'soeta-t1', name: 'SOETA T1', code: 'T1' }] },
      { match: u => u.includes('/rest/v1/employees?select='), body: [] },
      { match: u => u.includes('/rest/v1/raos_hris_employee_defaults?select='), body: [] },  // no defaults
      { match: u => u.includes('/rpc/raos_sync_staff_ssot_records'), body: { synced: 1 } },
      { match: u => u.includes('/rest/v1/raos_staff_ssot_records?select='),
        body: [{ staff_id: 'S002', full_name: 'Bob', email: 'b@x.co', phone: '628', legacy_branch_name: 'soeta-t1', branch_id: 'b1', resolved_role: 'staff', status_active: true, conflict_status: 'none' }] },
      { match: u => u.includes('rifim_ops_audit_log'), body: {} },
    ]))
    const r = req({ body: { mode: 'hris_staff_sync' } })
    const s = makeRes(); await handler(r, s)
    const body = JSON.parse(s._body)
    assert.strictEqual(s._status, 200)
    assert.strictEqual(body.summary.missing_hris_defaults, 1)
    assert.strictEqual(body.summary.added, 0, 'no insert without defaults')
    pass('H9 staff_sync refuses to insert new employee without HRIS defaults')
  } catch (e) { fail('H9 staff_sync refuses to insert new employee without HRIS defaults', e) }

  // H10: service-role key never appears in outbound URLs
  try {
    mockFetch(authRoutes('admin').concat([
      { match: u => u.includes('/rpc/hris_reconcile_activation_states'), body: { before_count: 0, applied: false, reconciled_ssot: 0, reconciled_contract: 0, unresolved: 0, after_count: 0 } },
    ]))
    const r = req({ body: { mode: 'hris_activation_reconcile_preview' } })
    const s = makeRes(); await handler(r, s)
    for (const c of calls) {
      assert.ok(!/SVC_ROLE_STUB/.test(c.url), 'service-role key must not appear in URL: ' + c.url)
    }
    pass('H10 service-role key never appears in outbound URLs')
  } catch (e) { fail('H10 service-role key never appears in outbound URLs', e) }

  global.fetch = originalFetch

  console.log('')
  console.log('Summary: ' + results.filter(x => x.ok).length + '/' + results.length + ' PASS')
  if (failures.length) { process.exit(1) }
}

run().catch(e => { console.error('runner error:', e); process.exit(1) })
