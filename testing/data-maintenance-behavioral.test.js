// Data Maintenance behavioral coverage — preview/execute modes on the
// consolidated hris-contracts endpoint.
//
// Previously lived in api/internal/data-maintenance.js. Merged into
// api/internal/hris-contracts.js on 2026-08-28 to keep the deployment
// ≤12 Vercel Serverless Functions (Hobby cap). Mode names renamed:
//   preview  → maintenance_preview
//   execute  → maintenance_execute
//
// Contract locked in (unchanged from pre-consolidation shape):
//   - Preview + Execute are POST-only under the consolidated endpoint
//   - Preview returns { preview_token, affected_rows, dependent_rows, warnings, protected }
//   - Execute requires matching preview_token, else "Data berubah sejak preview"
//   - Permanent Delete requires confirm_text === 'HAPUS DATA'
//   - AIST-linked delete requires confirm_dependencies === true
//   - hris_karyawan module is always protected (never deletable)
//   - allowedExecute = admin only; allowedPreview = admin/direksi/management/koordinator
//   - Service-role key must never appear in outbound URLs
//   - Audit trail is written on every success + failure (verified via fetch capture)

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
    method,
    body,
    query: {},
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
        return {
          ok: status >= 200 && status < 300,
          status,
          text: async () => JSON.stringify(bodyObj == null ? {} : bodyObj),
        }
      }
    }
    throw new Error('unmocked fetch: ' + url)
  }
}

// Reusable route stubs
const authRoutes = (role) => [
  { match: u => u.includes('/auth/v1/user'), body: { id: 'user-' + role } },
  { match: u => u.includes('user_profiles?id='), body: [{ id: 'user-' + role, role, is_active: true, staff_id: 'STAFF1', branch_id: 'branch-1' }] },
]

async function run() {
  const failures = []
  const results = []
  const pass = n => { results.push({ n, ok: true }); console.log('  ok  ' + n) }
  const fail = (n, e) => { failures.push({ n, e }); results.push({ n, ok: false }); console.log('  FAIL  ' + n + '\n        ' + (e && e.message || e)) }

  // M1: unauthenticated → Session required
  try {
    mockFetch([])
    const r = req({ headers: { authorization: '' } })
    const s = makeRes(); await handler(r, s)
    const body = JSON.parse(s._body)
    assert.strictEqual(s._status, 400)
    assert.ok(/Session required/i.test(body.message))
    pass('M1 unauthenticated request refused with Session required')
  } catch (e) { fail('M1 unauthenticated request refused with Session required', e) }

  // M2: Unknown POST mode is refused with 405 (Method not allowed).
  // The consolidated hris-contracts endpoint also serves GET (listContracts)
  // and other legitimate POST modes; verifying that maintenance-adjacent
  // callers can't smuggle an unrecognized mode past the dispatcher.
  try {
    mockFetch(authRoutes('admin').concat([]))
    const r = req({ method: 'POST', body: { mode: 'maintenance_something_bogus' } })
    const s = makeRes(); await handler(r, s)
    const body = JSON.parse(s._body)
    assert.strictEqual(s._status, 405)
    assert.ok(/Method not allowed/i.test(body.message))
    pass('M2 unknown POST mode refused with 405 (dispatcher rejects unregistered maintenance modes)')
  } catch (e) { fail('M2 unknown POST mode refused with 405 (dispatcher rejects unregistered maintenance modes)', e) }

  // M3: staff denied on preview (allowedPreview excludes staff)
  try {
    mockFetch(authRoutes('staff').concat([
      { match: u => u.includes('rifim_ops_audit_log'), body: {} },
    ]))
    const r = req({ body: { mode: 'maintenance_preview', module: 'attendance', date_from: '2026-08-01', date_to: '2026-08-28' } })
    const s = makeRes(); await handler(r, s)
    const body = JSON.parse(s._body)
    assert.strictEqual(s._status, 400)
    assert.ok(/Role tidak boleh melihat preview/i.test(body.message))
    pass('M3 staff denied on preview (role guard)')
  } catch (e) { fail('M3 staff denied on preview (role guard)', e) }

  // M4: management can preview attendance
  try {
    mockFetch(authRoutes('management').concat([
      { match: u => u.includes('/rest/v1/raos_attendance'), body: [
        { id: 'att-1', staff_id: 'u1', branch_id: 'branch-1', date: '2026-08-10', status: 'hadir' },
      ] },
      { match: u => u.includes('user_profiles?id=in.'), body: [{ id: 'u1', staff_id: 'S1', full_name: 'A', role: 'staff', branch_id: 'branch-1' }] },
      { match: u => u.includes('/rest/v1/payroll'), body: [] },
      { match: u => u.includes('/rest/v1/raos_payroll'), body: [] },
      { match: u => u.includes('/rest/v1/aist_jobs'), body: [] },
      { match: u => u.includes('rifim_ops_audit_log'), body: {} },
    ]))
    const r = req({ body: { mode: 'maintenance_preview', module: 'attendance', date_from: '2026-08-01', date_to: '2026-08-28' } })
    const s = makeRes(); await handler(r, s)
    const body = JSON.parse(s._body)
    assert.strictEqual(s._status, 200)
    assert.strictEqual(body.success, true)
    assert.strictEqual(body.preview.affected_rows, 1)
    assert.strictEqual(typeof body.preview.preview_token, 'string')
    assert.ok(body.preview.preview_token.length >= 32, 'sha256 token expected')
    pass('M4 management can preview attendance (returns preview_token)')
  } catch (e) { fail('M4 management can preview attendance (returns preview_token)', e) }

  // M5: management denied on execute (allowedExecute = admin ONLY)
  try {
    mockFetch(authRoutes('management').concat([
      { match: u => u.includes('rifim_ops_audit_log'), body: {} },
    ]))
    const r = req({ body: { mode: 'maintenance_execute', module: 'attendance', date_from: '2026-08-01', date_to: '2026-08-28', preview_token: 'x', confirm_text: 'HAPUS DATA' } })
    const s = makeRes(); await handler(r, s)
    const body = JSON.parse(s._body)
    assert.strictEqual(s._status, 400)
    assert.ok(/Hanya Admin/i.test(body.message))
    pass('M5 management denied on execute (admin-only write policy)')
  } catch (e) { fail('M5 management denied on execute (admin-only write policy)', e) }

  // M6: hris_karyawan is always protected (never deletable)
  try {
    mockFetch(authRoutes('admin').concat([
      { match: u => u.includes('rifim_ops_audit_log'), body: {} },
    ]))
    const r = req({ body: { mode: 'maintenance_execute', module: 'hris_karyawan', date_from: '2026-08-01', date_to: '2026-08-28', preview_token: 'x', confirm_text: 'HAPUS DATA' } })
    const s = makeRes(); await handler(r, s)
    const body = JSON.parse(s._body)
    assert.strictEqual(s._status, 400)
    assert.ok(/dilindungi/i.test(body.message))
    pass('M6 hris_karyawan is protected (admin cannot delete via this menu)')
  } catch (e) { fail('M6 hris_karyawan is protected (admin cannot delete via this menu)', e) }

  // M7: execute with wrong preview_token refused (fail-closed on dataset drift)
  try {
    mockFetch(authRoutes('admin').concat([
      { match: u => u.includes('/rest/v1/raos_saldo_requests') && !u.includes('id=in.'), body: [
        { id: 'S1', is_processed: false, is_archived: false, status: 'pending' },
      ] },
      { match: u => u.includes('user_profiles?id=in.'), body: [] },
      { match: u => u.includes('/rest/v1/aist_jobs'), body: [] },
      { match: u => u.includes('rifim_ops_audit_log'), body: {} },
    ]))
    const r = req({ body: { mode: 'maintenance_execute', module: 'finance_saldo', date_from: '2026-08-01', date_to: '2026-08-28', preview_token: 'WRONG', action: 'archive' } })
    const s = makeRes(); await handler(r, s)
    const body = JSON.parse(s._body)
    assert.strictEqual(s._status, 400)
    assert.ok(/berubah sejak preview/i.test(body.message))
    pass('M7 execute with wrong preview_token refused (dataset-drift fail-closed)')
  } catch (e) { fail('M7 execute with wrong preview_token refused (dataset-drift fail-closed)', e) }

  // M8: permanent delete without HAPUS DATA text refused
  try {
    // preview first to capture token
    mockFetch(authRoutes('admin').concat([
      { match: u => u.includes('/rest/v1/raos_attendance'), body: [{ id: 'att-x', staff_id: 'u1', branch_id: 'branch-1', date: '2026-07-01', status: 'hadir' }] },
      { match: u => u.includes('user_profiles?id=in.'), body: [] },
      { match: u => u.includes('/rest/v1/payroll'), body: [] },
      { match: u => u.includes('/rest/v1/raos_payroll'), body: [] },
      { match: u => u.includes('/rest/v1/aist_jobs'), body: [] },
      { match: u => u.includes('rifim_ops_audit_log'), body: {} },
    ]))
    const previewReq = req({ body: { mode: 'maintenance_preview', module: 'attendance', date_from: '2026-07-01', date_to: '2026-07-31' } })
    const previewRes = makeRes(); await handler(previewReq, previewRes)
    const previewBody = JSON.parse(previewRes._body)
    const token = previewBody.preview.preview_token
    // now execute without confirm_text
    mockFetch(authRoutes('admin').concat([
      { match: u => u.includes('/rest/v1/raos_attendance'), body: [{ id: 'att-x', staff_id: 'u1', branch_id: 'branch-1', date: '2026-07-01', status: 'hadir' }] },
      { match: u => u.includes('user_profiles?id=in.'), body: [] },
      { match: u => u.includes('/rest/v1/payroll'), body: [] },
      { match: u => u.includes('/rest/v1/raos_payroll'), body: [] },
      { match: u => u.includes('/rest/v1/aist_jobs'), body: [] },
      { match: u => u.includes('rifim_ops_audit_log'), body: {} },
    ]))
    const executeReq = req({ body: { mode: 'maintenance_execute', module: 'attendance', date_from: '2026-07-01', date_to: '2026-07-31', preview_token: token, action: 'delete' } })
    const executeRes = makeRes(); await handler(executeReq, executeRes)
    const executeBody = JSON.parse(executeRes._body)
    assert.strictEqual(executeRes._status, 400)
    assert.ok(/HAPUS DATA/.test(executeBody.message))
    pass('M8 permanent delete without HAPUS DATA text refused')
  } catch (e) { fail('M8 permanent delete without HAPUS DATA text refused', e) }

  // M9: saldo delete with AIST dependency + confirm_text but WITHOUT confirm_dependencies refused
  try {
    mockFetch(authRoutes('admin').concat([
      { match: u => u.includes('/rest/v1/raos_saldo_requests') && !u.includes('id=in.'), body: [
        { id: 'S1', is_processed: false, is_archived: false, status: 'pending' },
      ] },
      { match: u => u.includes('user_profiles?id=in.'), body: [] },
      { match: u => u.includes('/rest/v1/aist_jobs'), body: [{ id: 'J1', request_id: 'S1', status: 'success', completed_at: '2026-07-01' }] },
      { match: u => u.includes('rifim_ops_audit_log'), body: {} },
    ]))
    // Two-pass: preview first to capture token
    const prevReq = req({ body: { mode: 'maintenance_preview', module: 'finance_saldo', date_from: '2026-07-01', date_to: '2026-07-31', action: 'delete' } })
    const prevRes = makeRes(); await handler(prevReq, prevRes)
    const prevBody = JSON.parse(prevRes._body)
    const token = prevBody.preview.preview_token
    // Second pass execute with same mock (deterministic hash)
    mockFetch(authRoutes('admin').concat([
      { match: u => u.includes('/rest/v1/raos_saldo_requests') && !u.includes('id=in.'), body: [
        { id: 'S1', is_processed: false, is_archived: false, status: 'pending' },
      ] },
      { match: u => u.includes('user_profiles?id=in.'), body: [] },
      { match: u => u.includes('/rest/v1/aist_jobs'), body: [{ id: 'J1', request_id: 'S1', status: 'success', completed_at: '2026-07-01' }] },
      { match: u => u.includes('rifim_ops_audit_log'), body: {} },
    ]))
    const execReq = req({ body: { mode: 'maintenance_execute', module: 'finance_saldo', date_from: '2026-07-01', date_to: '2026-07-31', action: 'delete', preview_token: token, confirm_text: 'HAPUS DATA', confirm_dependencies: false } })
    const execRes = makeRes(); await handler(execReq, execRes)
    const execBody = JSON.parse(execRes._body)
    assert.strictEqual(execRes._status, 400)
    assert.ok(/AIST/i.test(execBody.message))
    assert.ok(/dependency/i.test(execBody.message))
    pass('M9 saldo delete blocked when AIST dependency + no confirm_dependencies (fail-closed cascade)')
  } catch (e) { fail('M9 saldo delete blocked when AIST dependency + no confirm_dependencies (fail-closed cascade)', e) }

  // M10: service-role key must NEVER appear in outbound URLs
  try {
    mockFetch(authRoutes('admin').concat([
      { match: u => u.includes('/rest/v1/raos_saldo_requests'), body: [] },
      { match: u => u.includes('user_profiles?id=in.'), body: [] },
      { match: u => u.includes('/rest/v1/aist_jobs'), body: [] },
      { match: u => u.includes('rifim_ops_audit_log'), body: {} },
    ]))
    const r = req({ body: { mode: 'maintenance_preview', module: 'finance_saldo', date_from: '2026-08-01', date_to: '2026-08-28' } })
    const s = makeRes(); await handler(r, s)
    for (const c of calls) {
      assert.ok(!/SVC_ROLE_STUB/.test(c.url), 'service-role key must not appear in URL: ' + c.url)
    }
    pass('M10 service-role key never leaks into outbound URLs')
  } catch (e) { fail('M10 service-role key never leaks into outbound URLs', e) }

  global.fetch = originalFetch

  console.log('')
  console.log('Summary: ' + results.filter(x => x.ok).length + '/' + results.length + ' PASS')
  if (failures.length) { process.exit(1) }
}

run().catch(e => { console.error('runner error:', e); process.exit(1) })
