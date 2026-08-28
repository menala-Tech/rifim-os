/**
 * P0 session recovery behavioral tests.
 * Executes the real shared/portal-session.js in VM browser sandboxes.
 *
 * Run: node testing/portal-session-p0-recovery.test.js
 */
'use strict'
const fs = require('fs')
const path = require('path')
const assert = require('assert')
const vm = require('vm')

const src = fs.readFileSync(path.join(__dirname, '..', 'shared', 'portal-session.js'), 'utf8')
const now = Math.floor(Date.now() / 1000)

function fakeJwt(sub, expSec) {
  const enc = (v) => Buffer.from(JSON.stringify(v)).toString('base64url')
  return enc({ alg: 'none', typ: 'JWT' }) + '.' + enc({ sub, exp: expSec }) + '.sig'
}

function activeProfile() {
  return [{ id: 'user-1', full_name: 'Admin Test', role: 'admin', staff_id: 'ST-1', branch_id: 'B1', is_active: true }]
}

function makeWin(opts = {}) {
  const sharedStore = opts.sharedStore || {}
  const sessionStore = {}
  const listeners = {}
  const win = {
    location: { hostname: 'rifim-os.vercel.app', pathname: '/finance/', href: '' },
    localStorage: {
      getItem: (k) => Object.prototype.hasOwnProperty.call(sharedStore, k) ? sharedStore[k] : null,
      setItem: (k, v) => { sharedStore[k] = String(v) },
      removeItem: (k) => { delete sharedStore[k] },
    },
    sessionStorage: {
      getItem: (k) => Object.prototype.hasOwnProperty.call(sessionStore, k) ? sessionStore[k] : null,
      setItem: (k, v) => { sessionStore[k] = String(v) },
      removeItem: (k) => { delete sessionStore[k] },
    },
    document: {
      querySelector: () => null,
      createElement: () => ({ setAttribute() {}, style: {} }),
      head: { appendChild() {} },
      body: { appendChild() {} },
      getElementById: () => null,
    },
    setInterval: () => 0,
    clearInterval: () => {},
    setTimeout,
    clearTimeout,
    addEventListener: (name, fn) => { (listeners[name] ||= []).push(fn) },
    console: { warn: () => {}, log: () => {}, error: () => {}, debug: () => {} },
    atob: (b) => Buffer.from(b, 'base64').toString('binary'),
    JSON, Date, Number, String, Object, Array, Error, Math, Promise, Boolean, URLSearchParams,
    fetch: opts.fetch || (async () => ({ ok: true, status: 200, json: async () => activeProfile() })),
  }
  win.window = win
  win.globalThis = win
  vm.createContext(win)
  vm.runInContext(src, win)
  win.__store = sharedStore
  win.__listeners = listeners
  return win
}

function prime(win, overrides = {}) {
  win.localStorage.setItem('rifim_auth', JSON.stringify(Object.assign({
    access_token: fakeJwt('user-1', now + 3600),
    refresh_token: 'refresh-old',
    expires_at: now + 3600,
    id: 'user-1',
    role: 'admin',
    full_name: 'Admin Test',
    staff_id: 'ST-1',
    branch_id: 'B1',
  }, overrides)))
}

async function run() {
  let passed = 0
  async function test(name, fn) {
    await fn()
    passed++
    console.log('  ok  ' + name)
  }

  console.log('=== RIFIM OS P0 Session Recovery S1-S10 ===')

  await test('S1 first profile 401 -> refresh -> retry success preserves session', async () => {
    let profileCalls = 0
    let refreshCalls = 0
    const win = makeWin({ fetch: async (url) => {
      if (String(url).includes('/auth/v1/token')) {
        refreshCalls++
        return { ok: true, status: 200, json: async () => ({
          access_token: fakeJwt('user-1', now + 7200),
          refresh_token: 'refresh-new',
          expires_at: now + 7200,
        }) }
      }
      profileCalls++
      if (profileCalls === 1) return { ok: false, status: 401, json: async () => ({}) }
      return { ok: true, status: 200, json: async () => activeProfile() }
    }})
    prime(win)
    win.RifimPortalSession.invalidate()
    const s = await win.RifimPortalSession.validate()
    assert.ok(s)
    assert.strictEqual(refreshCalls, 1)
    assert.strictEqual(profileCalls, 2)
    assert.strictEqual(JSON.parse(win.localStorage.getItem('rifim_auth')).refresh_token, 'refresh-new')
  })

  await test('S2 second profile 401 after successful refresh -> terminal logout', async () => {
    let refreshCalls = 0
    const win = makeWin({ fetch: async (url) => {
      if (String(url).includes('/auth/v1/token')) {
        refreshCalls++
        return { ok: true, status: 200, json: async () => ({
          access_token: fakeJwt('user-1', now + 7200),
          refresh_token: 'refresh-new',
          expires_at: now + 7200,
        }) }
      }
      return { ok: false, status: 401, json: async () => ({}) }
    }})
    prime(win)
    const s = await win.RifimPortalSession.validate()
    assert.strictEqual(s, null)
    assert.strictEqual(refreshCalls, 1)
    assert.strictEqual(win.localStorage.getItem('rifim_auth'), null)
  })

  await test('S3 profile 401 + refresh 400 -> terminal logout', async () => {
    let profileCalls = 0
    const win = makeWin({ fetch: async (url) => {
      if (String(url).includes('/auth/v1/token')) {
        return { ok: false, status: 400, json: async () => ({ error: 'invalid_grant' }) }
      }
      profileCalls++
      return { ok: false, status: 401, json: async () => ({}) }
    }})
    prime(win)
    const s = await win.RifimPortalSession.validate()
    assert.strictEqual(profileCalls, 1)
    assert.strictEqual(s, null)
    assert.strictEqual(win.localStorage.getItem('rifim_auth'), null)
  })

  await test('S4 two tabs share exactly one refresh and waiter uses newest persisted session', async () => {
    const store = {}
    let refreshCalls = 0
    let profileCalls = 0
    const sharedFetch = async (url) => {
      if (String(url).includes('/auth/v1/token')) {
        refreshCalls++
        await new Promise(r => setTimeout(r, 80))
        return { ok: true, status: 200, json: async () => ({
          access_token: fakeJwt('user-1', now + 7200),
          refresh_token: 'refresh-rotated',
          expires_at: now + 7200,
        }) }
      }
      profileCalls++
      if (profileCalls === 1) return { ok: false, status: 401, json: async () => ({}) }
      return { ok: true, status: 200, json: async () => activeProfile() }
    }
    const t1 = makeWin({ sharedStore: store, fetch: sharedFetch })
    const t2 = makeWin({ sharedStore: store, fetch: sharedFetch })
    prime(t1)
    const [a, b] = await Promise.all([
      t1.RifimPortalSession.validate(),
      t2.RifimPortalSession.validate(),
    ])
    assert.ok(a && b)
    assert.strictEqual(refreshCalls, 1)
    assert.strictEqual(JSON.parse(store.rifim_auth).refresh_token, 'refresh-rotated')
  })

  await test('S5 profile 403 preserves session', async () => {
    const win = makeWin({ fetch: async () => ({ ok: false, status: 403, json: async () => ({}) }) })
    prime(win)
    const s = await win.RifimPortalSession.validate()
    assert.ok(s)
    assert.ok(win.localStorage.getItem('rifim_auth'))
  })

  await test('S6 profile network error preserves session', async () => {
    const win = makeWin({ fetch: async () => { throw new Error('ECONNRESET') } })
    prime(win)
    const s = await win.RifimPortalSession.validate()
    assert.ok(s)
    assert.ok(win.localStorage.getItem('rifim_auth'))
  })

  await test('S7 profile 503 preserves session', async () => {
    const win = makeWin({ fetch: async () => ({ ok: false, status: 503, json: async () => ({}) }) })
    prime(win)
    const s = await win.RifimPortalSession.validate()
    assert.ok(s)
    assert.ok(win.localStorage.getItem('rifim_auth'))
  })

  await test('S8 stale refresh lock is recovered safely', async () => {
    const store = { rifim_auth_refresh_lock: JSON.stringify({ tabId: 'dead-tab', ts: Date.now() - 6000 }) }
    const win = makeWin({ sharedStore: store })
    prime(win)
    const lock = await win.RifimPortalSession._acquireRefreshLock(win.RifimPortalSession._getTabId())
    assert.strictEqual(lock.acquired, true)
  })

  await test('S9 same-browser logout invalidates sibling tabs through shared storage', async () => {
    const store = {}
    const t1 = makeWin({ sharedStore: store })
    const t2 = makeWin({ sharedStore: store })
    prime(t1)
    assert.ok(t2.localStorage.getItem('rifim_auth'))
    t1.RifimPortalSession.clear()
    assert.strictEqual(t2.localStorage.getItem('rifim_auth'), null)
  })

  await test('S10 explicit normal logout never calls Supabase global signout', async () => {
    let fetchCalls = 0
    const win = makeWin({ fetch: async () => { fetchCalls++; return { ok: true, status: 200, json: async () => ({}) } } })
    prime(win)
    win.RifimPortalSession.clear()
    assert.strictEqual(fetchCalls, 0)
    assert.strictEqual(win.localStorage.getItem('rifim_auth'), null)
  })

  console.log('\n✓ P0 behavioral session tests: ' + passed + '/10 PASS')
}

run().catch(err => {
  console.error('FAIL:', err)
  process.exit(1)
})
