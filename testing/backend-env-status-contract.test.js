// Hotfix 2026-08-29 Preview UAT: backend Supabase env resolver + HTTP status contract.
//
// R6 (from owner UAT observations on hotfix Preview):
//   Every backend handler blindly read process.env.SUPABASE_URL. When Vercel
//   Preview env still pointed at PROD Supabase while the browser session was
//   issued by QA Supabase, the QA JWT posted to PROD /auth/v1/user got 401
//   and the handler wrapped it as HTTP 400 "Session invalid" — which the
//   frontend showed as a business-error card instead of a session recovery.
//
//   Fix:
//     - api/_lib/sb-env.js: canonical resolver + typed errors + status mapper.
//     - hris-v2 and hris-contracts dispatchers: use httpStatusFor(err) so
//       401 (auth) / 403 (role) / 400 (bad input) map correctly.
//     - All 6 backend handlers now go through resolve() so a Preview-scoped
//       SUPABASE_URL_QA switches them to QA transparently.

'use strict'

const assert = require('assert')
const path = require('path')

function clearEnv() {
  ['VERCEL_ENV','SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','SUPABASE_SERVICE_ROLE_KEY',
   'SUPABASE_URL_QA','SUPABASE_PUBLISHABLE_KEY_QA','SUPABASE_SERVICE_ROLE_KEY_QA'
  ].forEach(k => { delete process.env[k] })
}
function loadFresh() {
  const p = path.resolve(__dirname, '..', 'api', '_lib', 'sb-env.js')
  delete require.cache[p]
  return require(p)
}

const failures = []
const pass = n => console.log('  ok  ' + n)
const fail = (n, e) => { failures.push({ n, e }); console.log('  FAIL  ' + n + '\n        ' + (e && e.message || e)) }

// E1: default resolve = PROD env vars (no QA overrides).
try {
  clearEnv()
  process.env.SUPABASE_URL = 'https://prod.supabase.co'
  process.env.SUPABASE_PUBLISHABLE_KEY = 'PROD_PUB'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'PROD_SVC'
  const { resolve } = loadFresh()
  const out = resolve()
  assert.strictEqual(out.url, 'https://prod.supabase.co')
  assert.strictEqual(out.publishable, 'PROD_PUB')
  assert.strictEqual(out.service, 'PROD_SVC')
  assert.strictEqual(out.target, 'default')
  pass('E1 no VERCEL_ENV + no QA vars -> uses PROD env (backward compat)')
} catch (e) { fail('E1 no VERCEL_ENV + no QA vars -> uses PROD env (backward compat)', e) }

// E2: VERCEL_ENV=production always resolves default even if QA vars present.
try {
  clearEnv()
  process.env.VERCEL_ENV = 'production'
  process.env.SUPABASE_URL = 'https://prod.supabase.co'
  process.env.SUPABASE_PUBLISHABLE_KEY = 'PROD_PUB'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'PROD_SVC'
  process.env.SUPABASE_URL_QA = 'https://qa.supabase.co'
  process.env.SUPABASE_PUBLISHABLE_KEY_QA = 'QA_PUB'
  process.env.SUPABASE_SERVICE_ROLE_KEY_QA = 'QA_SVC'
  const { resolve } = loadFresh()
  const out = resolve()
  assert.strictEqual(out.target, 'default')
  assert.strictEqual(out.url, 'https://prod.supabase.co')
  pass('E2 VERCEL_ENV=production ignores QA vars (fail-closed on PROD)')
} catch (e) { fail('E2 VERCEL_ENV=production ignores QA vars (fail-closed on PROD)', e) }

// E3: VERCEL_ENV=preview + QA vars -> QA.
try {
  clearEnv()
  process.env.VERCEL_ENV = 'preview'
  process.env.SUPABASE_URL = 'https://prod.supabase.co'
  process.env.SUPABASE_PUBLISHABLE_KEY = 'PROD_PUB'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'PROD_SVC'
  process.env.SUPABASE_URL_QA = 'https://qa.supabase.co'
  process.env.SUPABASE_PUBLISHABLE_KEY_QA = 'QA_PUB'
  process.env.SUPABASE_SERVICE_ROLE_KEY_QA = 'QA_SVC'
  const { resolve } = loadFresh()
  const out = resolve()
  assert.strictEqual(out.target, 'qa')
  assert.strictEqual(out.url, 'https://qa.supabase.co')
  assert.strictEqual(out.publishable, 'QA_PUB')
  assert.strictEqual(out.service, 'QA_SVC')
  pass('E3 VERCEL_ENV=preview + QA vars -> QA Supabase (owner-config path)')
} catch (e) { fail('E3 VERCEL_ENV=preview + QA vars -> QA Supabase (owner-config path)', e) }

// E4: VERCEL_ENV=preview but QA vars missing -> falls back to default (owner
//     hasn't set QA vars yet). Preserves prior behavior, never crashes.
try {
  clearEnv()
  process.env.VERCEL_ENV = 'preview'
  process.env.SUPABASE_URL = 'https://prod.supabase.co'
  process.env.SUPABASE_PUBLISHABLE_KEY = 'PROD_PUB'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'PROD_SVC'
  const { resolve } = loadFresh()
  const out = resolve()
  assert.strictEqual(out.target, 'default')
  pass('E4 preview with no QA vars still returns default (safe fallback)')
} catch (e) { fail('E4 preview with no QA vars still returns default (safe fallback)', e) }

// S1..S6: httpStatusFor status mapping.
try {
  clearEnv()
  const { httpStatusFor, AuthMissingError, AuthInvalidError, RoleForbiddenError, BadInputError } = loadFresh()
  assert.strictEqual(httpStatusFor(new AuthMissingError()), 401, 'AuthMissingError -> 401')
  assert.strictEqual(httpStatusFor(new AuthInvalidError()), 401, 'AuthInvalidError -> 401')
  assert.strictEqual(httpStatusFor(new RoleForbiddenError()), 403, 'RoleForbiddenError -> 403')
  assert.strictEqual(httpStatusFor(new BadInputError()), 400, 'BadInputError -> 400')
  assert.strictEqual(httpStatusFor(new Error('Session required')), 401, 'legacy "Session required" string -> 401')
  assert.strictEqual(httpStatusFor(new Error('Session invalid')), 401, 'legacy "Session invalid" string -> 401')
  assert.strictEqual(httpStatusFor(new Error('Profil tidak aktif')), 401, 'legacy "Profil tidak aktif" string -> 401')
  assert.strictEqual(httpStatusFor(new Error('Hanya Admin/Direksi boleh')), 403, 'legacy "Hanya Admin" role denial -> 403')
  assert.strictEqual(httpStatusFor(new Error('Role tidak boleh melihat X')), 403, 'legacy "Role tidak boleh" -> 403')
  assert.strictEqual(httpStatusFor(new Error('date_from wajib YYYY-MM-DD')), 400, 'business validation -> 400')
  assert.strictEqual(httpStatusFor(new Error('Supabase server env missing')), 500, 'server config error -> 500')
  pass('S1 httpStatusFor maps typed + legacy string errors to correct 401/403/400/500')
} catch (e) { fail('S1 httpStatusFor maps typed + legacy string errors to correct 401/403/400/500', e) }

// D1: hris-v2 dispatcher — missing Bearer returns 401 (was 400 before hotfix).
try {
  clearEnv()
  process.env.SUPABASE_URL = 'https://prod.supabase.co'
  process.env.SUPABASE_PUBLISHABLE_KEY = 'PROD_PUB'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'PROD_SVC'
  const hp = path.resolve(__dirname, '..', 'api', 'internal', 'hris-v2.js')
  delete require.cache[hp]
  const handler = require(hp)
  const req = { method: 'GET', query: { mode: 'branches' }, body: {}, headers: {} }
  const res = { _status: 0, _body: null, status(s){ this._status = s; return this }, setHeader(){}, end(b){ this._body = b } }
  ;(async () => {
    await handler(req, res)
    assert.strictEqual(res._status, 401, `expected 401 for missing Bearer, got ${res._status}`)
    const body = JSON.parse(res._body)
    assert.strictEqual(body.success, false)
    assert.ok(/session required/i.test(body.message))
    pass('D1 hris-v2: missing Bearer -> HTTP 401 (was 400 before fix)')
  })().catch(e => fail('D1 hris-v2: missing Bearer -> HTTP 401 (was 400 before fix)', e))
} catch (e) { fail('D1 hris-v2: missing Bearer -> HTTP 401 (was 400 before fix)', e) }

// D2: hris-contracts dispatcher — missing Bearer returns 401.
try {
  clearEnv()
  process.env.SUPABASE_URL = 'https://prod.supabase.co'
  process.env.SUPABASE_PUBLISHABLE_KEY = 'PROD_PUB'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'PROD_SVC'
  const hp = path.resolve(__dirname, '..', 'api', 'internal', 'hris-contracts.js')
  delete require.cache[hp]
  const handler = require(hp)
  const req = { method: 'GET', query: {}, body: {}, headers: {} }
  const res = { _status: 0, _body: null, status(s){ this._status = s; return this }, setHeader(){}, end(b){ this._body = b } }
  ;(async () => {
    await handler(req, res)
    assert.strictEqual(res._status, 401, `expected 401 for missing Bearer, got ${res._status}`)
    pass('D2 hris-contracts: missing Bearer -> HTTP 401 (was 400 before fix)')
  })().catch(e => fail('D2 hris-contracts: missing Bearer -> HTTP 401 (was 400 before fix)', e))
} catch (e) { fail('D2 hris-contracts: missing Bearer -> HTTP 401 (was 400 before fix)', e) }

// D3: hris-v2 dispatcher — cross-project token gets 401, not 400.
try {
  clearEnv()
  process.env.SUPABASE_URL = 'https://prod.supabase.co'
  process.env.SUPABASE_PUBLISHABLE_KEY = 'PROD_PUB'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'PROD_SVC'
  // Simulate the exact Preview UAT scenario: browser token is QA-issued,
  // backend still validates against PROD -> Supabase returns 401 -> handler
  // MUST propagate that as 401 (not 400), so the frontend recovery path
  // triggers a session revalidation instead of showing "Session invalid".
  global.fetch = async (url) => {
    if (String(url).includes('/auth/v1/user')) {
      return { ok: false, status: 401, text: async () => JSON.stringify({ code: 401, error_code: 'bad_jwt', msg: 'invalid JWT' }) }
    }
    return { ok: false, status: 500, text: async () => '' }
  }
  const hp = path.resolve(__dirname, '..', 'api', 'internal', 'hris-v2.js')
  delete require.cache[hp]
  const handler = require(hp)
  const req = { method: 'GET', query: { mode: 'branches' }, body: {}, headers: { authorization: 'Bearer QA_JWT_SENT_TO_PROD_BACKEND' } }
  const res = { _status: 0, _body: null, status(s){ this._status = s; return this }, setHeader(){}, end(b){ this._body = b } }
  ;(async () => {
    await handler(req, res)
    assert.strictEqual(res._status, 401, `cross-project token must return 401 not ${res._status}`)
    const body = JSON.parse(res._body)
    assert.ok(/session invalid/i.test(body.message), 'error message should say "Session invalid"')
    pass('D3 hris-v2: QA token → PROD backend -> HTTP 401 (frontend can then recover)')
  })().catch(e => fail('D3 hris-v2: QA token → PROD backend -> HTTP 401 (frontend can then recover)', e))
} catch (e) { fail('D3 hris-v2: QA token → PROD backend -> HTTP 401 (frontend can then recover)', e) }

// Give async D1/D2/D3 a moment to finish (they use fire-and-forget IIFE).
setTimeout(() => {
  console.log('\n' + (failures.length ? 'FAILED ' + failures.length : 'ALL PASSED'))
  process.exit(failures.length ? 1 : 0)
}, 300)
