(function (global) {
  'use strict'

  if (global.document && !global.document.querySelector('script[data-rifim-fixed-shell]')) {
    const fixedShell = global.document.createElement('script')
    fixedShell.src = '/shared/fixed-module-shell.js?v=20260818-fixed-1'
    fixedShell.async = false
    fixedShell.setAttribute('data-rifim-fixed-shell', '1')
    global.document.head.appendChild(fixedShell)
  }

  const PROD_SB_URL = 'https://vlievtojpmrbsmzlqswl.supabase.co'
  const PROD_SB_ANON = 'sb_publishable_8KpL6zmpt_O_x21v4Jn3Tw_J_I3y-r1'
  const QA_SB_URL = 'https://cdlkujllqnrurgecoaur.supabase.co'
  const QA_SB_ANON = 'sb_publishable_y5rpSIfnLka3P6FIEwYuzQ_-X05xX7K'
  const host = String((global.location && global.location.hostname) || '').toLowerCase()
  const isPreview = host.endsWith('.vercel.app') && host !== 'rifim-os.vercel.app'
  const SB_URL = isPreview ? QA_SB_URL : PROD_SB_URL
  const SB_ANON = isPreview ? QA_SB_ANON : PROD_SB_ANON
  const STORAGE_KEY = 'rifim_auth'

  const FALLBACK_ALIASES = {
    staff: 'staff',
    'staff konter': 'staff',
    'pickup point': 'staff',
    koordinator: 'koordinator',
    coordinator: 'koordinator',
    admin: 'admin',
    administrator: 'admin',
    management: 'management',
    manajemen: 'management',
    direksi: 'direksi',
    direktur: 'direksi',
    'direktur utama': 'direksi',
    driver: 'driver',
  }

  function normalizeRole(value) {
    if (global.RifimMasterRolePolicy && typeof global.RifimMasterRolePolicy.normalizeRole === 'function') {
      return global.RifimMasterRolePolicy.normalizeRole(value)
    }
    const raw = String(value || '').trim().toLowerCase()
    return FALLBACK_ALIASES[raw] || raw
  }

  function readSession() {
    try { return JSON.parse(global.localStorage.getItem(STORAGE_KEY) || 'null') }
    catch (_) { return null }
  }

  function writeSession(session) {
    global.localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    return session
  }

  function clearSession() {
    global.localStorage.removeItem(STORAGE_KEY)
  }

  function decodeJwt(token) {
    try {
      const part = String(token || '').split('.')[1]
      if (!part) return null
      const normalized = part.replace(/-/g, '+').replace(/_/g, '/')
      const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4)
      return JSON.parse(decodeURIComponent(Array.from(atob(padded)).map(c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join('')))
    } catch (_) { return null }
  }

  // Item 2 (2026-08-26): custom error to distinguish transient network
  // failures (kept session) from unrecoverable auth failures (clear session).
  function AuthHardError(msg) { const e = new Error(msg); e.isHardAuth = true; return e }

  async function refreshToken(refreshToken) {
    const res = await fetch(SB_URL + '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      headers: {
        apikey: SB_ANON,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
    if (res.status === 400 || res.status === 401 || res.status === 403) {
      throw AuthHardError('Portal session refresh ditolak (refresh_token invalid)')
    }
    if (!res.ok) throw new Error('Portal session refresh gagal (transient)')
    return res.json()
  }

  async function fetchProfile(accessToken, userId) {
    const qs = new URLSearchParams({
      id: 'eq.' + userId,
      select: 'id,full_name,role,staff_id,branch_id,is_active',
    })
    const res = await fetch(SB_URL + '/rest/v1/user_profiles?' + qs.toString(), {
      headers: {
        apikey: SB_ANON,
        Authorization: 'Bearer ' + accessToken,
        Accept: 'application/json',
      },
    })
    // Item 3 (2026-08-28): Distinguish 401 from 403
    // - 401: access token expired/invalid → should attempt refresh/recovery
    // - 403: permission denied → keep session, show permission error
    // Only 401 on initial token check (not from Supabase validation) is terminal
    if (res.status === 403) {
      // Permission denied: keep session, return error to caller
      throw new Error('Portal profile: akses ditolak (403 permission)')
    }
    if (res.status === 401) {
      // Could be: expired token, revoked session, deleted user
      // Only terminal if we already tried refresh (will be caught by refresh logic)
      throw AuthHardError('Portal profile: token invalid (401)')
    }
    if (!res.ok) throw new Error('Portal profile validation gagal (transient)')
    const rows = await res.json()
    return Array.isArray(rows) ? rows[0] || null : null
  }

  // Item 2 (2026-08-26): validation cache + single-flight.
  // Sebelum patch: validateSession() dijalankan di SETIAP apiGet/apiPost via
  // sessionToken(); tiap panggilan re-fetch user_profile ke Supabase. Sekali
  // transient network error → clearSession() → seluruh UI Finance kolaps ke
  // "Session invalid" walau sesi sebenarnya masih valid. Fix:
  //   1. Cache hasil validasi selama VALIDATE_TTL (60s) → skip network jika
  //      token access masih jauh dari expiry.
  //   2. Single-flight: panggilan paralel share satu Promise refresh/validate,
  //      cegah race + duplicate refresh yang membakar refresh_token.
  //   3. Transient failure (network / 5xx pada fetchProfile) tidak lagi
  //      clearSession() — sesi lokal dipertahankan, error dibubble ke caller
  //      supaya bisa retry-once alih-alih logout.
  //   4. Hanya AuthHardError (refresh_token 4xx / profile 401-403 / profile
  //      is_active=false) yang benar-benar clearSession().
  const VALIDATE_TTL = 60 * 1000
  let lastGoodAt = 0
  let lastGood = null
  let inFlight = null

  async function _validateOnce() {
    const saved = readSession()
    if (!saved || !saved.access_token) return null

    let accessToken = saved.access_token
    let refreshTokenValue = saved.refresh_token || ''
    let expiresAt = Number(saved.expires_at || 0)
    const now = Math.floor(Date.now() / 1000)

    let refreshed = false
    try {
      if (!expiresAt || expiresAt <= now + 60) {
        if (!refreshTokenValue) throw AuthHardError('Refresh token tidak tersedia')
        const r = await refreshToken(refreshTokenValue)
        accessToken = r.access_token || ''
        refreshTokenValue = r.refresh_token || refreshTokenValue
        expiresAt = Number(r.expires_at || (now + Number(r.expires_in || 3600)))
        if (!accessToken) throw AuthHardError('Access token kosong setelah refresh')
        refreshed = true
      }

      const payload = decodeJwt(accessToken)
      const userId = payload && payload.sub
      if (!userId) throw AuthHardError('Token Portal tidak valid')

      // Skip profile revalidate untuk fast-path (token access masih valid,
      // sudah pernah divalidasi baru-baru ini). Hanya validate ulang saat:
      //   - token baru saja di-refresh, atau
      //   - belum pernah lolos validasi profile,
      //   - atau saved.role/id kosong.
      const needsProfile = refreshed || !lastGood || !saved.role || !saved.id
      let profile = null
      if (needsProfile) {
        try { profile = await fetchProfile(accessToken, userId) }
        catch (err) {
          if (err && err.isHardAuth) throw err
          // Transient: keep saved session, do NOT clear.
          console.warn('[RifimPortalSession] profile transient:', err && err.message)
          const kept = writeSession(Object.assign({}, saved, {
            access_token: accessToken,
            refresh_token: refreshTokenValue,
            expires_at: expiresAt,
            ts: Date.now(),
          }))
          lastGood = kept; lastGoodAt = Date.now()
          return kept
        }
        if (!profile || profile.is_active === false) {
          throw AuthHardError('Profil Portal tidak aktif')
        }
      }

      const merged = writeSession(Object.assign({}, saved, {
        id: (profile && profile.id) || saved.id,
        full_name: (profile && profile.full_name) || saved.full_name || saved.name || saved.email || 'User',
        name: (profile && profile.full_name) || saved.name || saved.full_name || saved.email || 'User',
        role: normalizeRole((profile && profile.role) || saved.role),
        staff_id: (profile && profile.staff_id) || saved.staff_id || null,
        branch_id: (profile && profile.branch_id) || saved.branch_id || null,
        access_token: accessToken,
        refresh_token: refreshTokenValue,
        expires_at: expiresAt,
        ts: Date.now(),
      }))
      lastGood = merged; lastGoodAt = Date.now()
      return merged
    } catch (err) {
      console.warn('[RifimPortalSession]', err && err.message ? err.message : err)
      if (err && err.isHardAuth) {
        clearSession()
        lastGood = null; lastGoodAt = 0
        return null
      }
      // Transient error di layer refresh: kembalikan sesi tersimpan bila ada,
      // biar caller bisa mencoba lagi tanpa logout.
      const fallback = readSession()
      return (fallback && fallback.access_token) ? fallback : null
    }
  }

  async function validateSession() {
    // Fast-path: hasil validasi masih hangat dan token belum near expiry.
    if (lastGood && (Date.now() - lastGoodAt) < VALIDATE_TTL) {
      const exp = Number(lastGood.expires_at || 0)
      if (!exp || exp > Math.floor(Date.now() / 1000) + 60) return lastGood
    }
    if (inFlight) return inFlight
    inFlight = _validateOnce().finally(() => { inFlight = null })
    return inFlight
  }

  async function requireSession(options) {
    options = options || {}
    const session = await validateSession()
    const redirect = options.redirect || '/portal'
    if (!session) {
      if (options.noRedirect !== true) global.location.href = redirect
      return null
    }

    const role = normalizeRole(session.role)
    const allowed = Array.isArray(options.allowedRoles)
      ? options.allowedRoles.map(normalizeRole)
      : null
    if (allowed && !allowed.includes(role)) {
      if (options.noRedirect !== true) global.location.href = redirect
      return null
    }
    session.role = role
    writeSession(session)
    return session
  }

  function canMutate(session) {
    const role = normalizeRole((session || readSession() || {}).role)
    return role === 'admin' || role === 'direksi'
  }

  function installHrisMutationGuard() {
    if (!/^\/hris(?:\/|$)/.test(global.location.pathname || '')) return

    const guardedPostActions = new Set([
      'update_employee',
      'add_employee',
      'add_contract',
      'add_attendance',
      'approve_leave',
      'add_payroll',
      'finalize_payroll',
    ])
    const guardedGetActions = new Set(['hris_attendance_edit'])
    const denied = () => ({
      success: false,
      message: 'Role view-only tidak diizinkan melakukan perubahan HRIS.',
    })

    let attempts = 0
    const timer = global.setInterval(() => {
      attempts += 1
      let ready = true

      if (typeof global.gasPost === 'function' && !global.gasPost.__rifimP0Guarded) {
        const originalPost = global.gasPost
        const wrappedPost = async function (body) {
          const action = String((body || {}).hrisAction || '')
          if (guardedPostActions.has(action) && !canMutate()) return denied()
          return originalPost.apply(this, arguments)
        }
        wrappedPost.__rifimP0Guarded = true
        global.gasPost = wrappedPost
      } else if (typeof global.gasPost !== 'function') {
        ready = false
      }

      if (typeof global.gasGet === 'function' && !global.gasGet.__rifimP0Guarded) {
        const originalGet = global.gasGet
        const wrappedGet = async function (params) {
          const action = String((params || {}).action || '')
          if (guardedGetActions.has(action) && !canMutate()) return denied()
          return originalGet.apply(this, arguments)
        }
        wrappedGet.__rifimP0Guarded = true
        global.gasGet = wrappedGet
      } else if (typeof global.gasGet !== 'function') {
        ready = false
      }

      if (ready || attempts >= 100) global.clearInterval(timer)
    }, 50)
  }

  function installFinanceDriverPolicyUi() {
    if (!/^\/finance(?:\/|$)/.test(global.location.pathname || '')) return

    const apply = () => {
      const panel = global.document && global.document.querySelector('[data-panel="db-driver"]')
      if (!panel) return false

      const desc = panel.querySelector('.desc')
      if (desc) {
        desc.textContent = 'Daftar driver per cabang + assignment random ke staff. Admin dan Direksi dapat mengubah assignment; Management dan Koordinator hanya lihat.'
      }

      const roadmap = panel.querySelector('.roadmap')
      if (roadmap) {
        roadmap.innerHTML = '<strong>Aturan:</strong> Assignment driver → staff dilakukan random oleh Admin/Direksi. Management &amp; Koordinator hanya bisa lihat (read-only). Rebalance (p_force=true) akan reset semua assignment cabang lalu re-distribute round-robin.'
      }

      const assignBtn = global.document.getElementById('dd-assign')
      const rebalanceBtn = global.document.getElementById('dd-rebalance')
      const allowed = canMutate()
      if (assignBtn) {
        assignBtn.textContent = '🎲 Random Assign (Admin/Direksi)'
        assignBtn.style.display = allowed ? '' : 'none'
      }
      if (rebalanceBtn) rebalanceBtn.style.display = allowed ? '' : 'none'
      return true
    }

    if (apply()) return
    let attempts = 0
    const timer = global.setInterval(() => {
      attempts += 1
      if (apply() || attempts >= 100) global.clearInterval(timer)
    }, 50)
  }

  // Item 2: force revalidate by dropping fast-path cache. Callers use this
  // after a 401 to trigger a real refresh on the next validate() call.
  function invalidateCache() { lastGood = null; lastGoodAt = 0 }

  // ─── Item 3 (2026-08-28): Multi-tab / multi-device session sync ──────────────
  // Problem: When same account logged in on multiple tabs/devices, token refresh
  // in one tab invalidates cached token in others. Multiple tabs can race to
  // refresh using same refresh_token (single-use), causing 400 errors.
  // Solution:
  //   1. Unique tab ID (sessionStorage-based UUID, per-tab lifetime)
  //   2. Refresh lock (localStorage-based, with ownership + expiry)
  //   3. Storage event listener (detect other tab changes, invalidate cache)
  //   4. Wait-for-lock pattern (tab waits for other tab's refresh, reads updated session)
  //   5. Separate logout semantics (distinguish transient 401 from terminal logout)

  const LOCK_STORAGE_KEY = 'rifim_auth_refresh_lock'
  const TAB_ID_SESSION_KEY = 'rifim_tab_id'
  const LOCK_LEASE_MS = 5000  // Stale lock > 5s is abandoned
  const LOCK_WAIT_MAX_MS = 5000
  const LOCK_WAIT_POLL_MS = 50

  // Generate or retrieve unique tab ID (stored in sessionStorage = per-tab)
  function getTabId() {
    const existing = global.sessionStorage && global.sessionStorage.getItem(TAB_ID_SESSION_KEY)
    if (existing) return existing
    // Generate UUID v4-like identifier
    const uuid = 'tab_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now()
    if (global.sessionStorage) {
      global.sessionStorage.setItem(TAB_ID_SESSION_KEY, uuid)
    }
    return uuid
  }

  // Read lock from localStorage (returns { tabId, ts } or null)
  function readLock() {
    try {
      const lock = global.localStorage && global.localStorage.getItem(LOCK_STORAGE_KEY)
      return lock ? JSON.parse(lock) : null
    } catch (_) { return null }
  }

  // Write lock to localStorage (only if we own it or it's expired)
  function writeLock(tabId, now) {
    const lock = { tabId, ts: now }
    if (global.localStorage) {
      global.localStorage.setItem(LOCK_STORAGE_KEY, JSON.stringify(lock))
    }
  }

  // Clear lock from localStorage (only if we own it)
  function clearLock(tabId) {
    const lock = readLock()
    if (lock && lock.tabId === tabId) {
      if (global.localStorage) {
        global.localStorage.removeItem(LOCK_STORAGE_KEY)
      }
    }
  }

  // Acquire refresh lock with wait-for-lock pattern
  // Returns { acquired: boolean, waited: boolean }
  async function acquireRefreshLock(tabId) {
    const start = Date.now()
    let waited = false

    while (true) {
      const now = Date.now()
      const lock = readLock()
      const elapsed = now - start

      // Check if lock is held by another tab
      if (lock && lock.tabId !== tabId) {
        const lockAge = now - lock.ts

        if (lockAge < LOCK_LEASE_MS) {
          // Lock is fresh and held by another tab
          if (elapsed > LOCK_WAIT_MAX_MS) {
            // Timeout: give up waiting, proceed anyway
            writeLock(tabId, now)
            return { acquired: true, waited }
          }
          // Wait and retry
          waited = true
          await new Promise(r => global.setTimeout(r, LOCK_WAIT_POLL_MS))
          continue
        }
        // Lock is stale (>5s), we can take over
      }

      // We can acquire (no lock or stale lock)
      writeLock(tabId, now)
      const confirmLock = readLock()
      if (confirmLock && confirmLock.tabId === tabId) {
        return { acquired: true, waited }
      }
      // Another tab beat us, retry
      if (elapsed > LOCK_WAIT_MAX_MS) {
        return { acquired: false, waited }
      }
      await new Promise(r => global.setTimeout(r, LOCK_WAIT_POLL_MS))
    }
  }

  // Install cross-tab storage listener (Item 3)
  function installStorageListener() {
    if (!global.addEventListener) return

    global.addEventListener('storage', function(event) {
      if (event.key === STORAGE_KEY) {
        // Our session was modified by another tab
        // Two cases:
        // 1. event.newValue is null → another tab logged out (logout broadcast)
        // 2. event.newValue exists → another tab refreshed token
        // In both cases: invalidate cache so next validate() call is fresh
        invalidateCache()
        console.debug('[RifimPortalSession] storage event on STORAGE_KEY, cache invalidated')
      }
      if (event.key === LOCK_STORAGE_KEY) {
        // Lock state changed by another tab (for diagnostics)
        console.debug('[RifimPortalSession] storage event on LOCK_STORAGE_KEY')
      }
    })
  }

  // Enhanced clearSession() with logout broadcast (Item 3)
  function clearSessionWithBroadcast() {
    const tabId = getTabId()
    try {
      // Broadcast logout to all tabs by removing session
      if (global.localStorage) {
        global.localStorage.removeItem(STORAGE_KEY)
      }
      // Release any lock we hold
      clearLock(tabId)
      // Invalidate local cache
      invalidateCache()
      console.debug('[RifimPortalSession] clearSessionWithBroadcast completed')
    } catch (e) {
      console.warn('[RifimPortalSession] clearSessionWithBroadcast error:', e && e.message)
    }
  }

  // Enhanced validateSession with lock coordination (Item 3)
  async function validateSessionWithLocking() {
    const tabId = getTabId()

    // Fast-path: cache still warm
    if (lastGood && (Date.now() - lastGoodAt) < VALIDATE_TTL) {
      const exp = Number(lastGood.expires_at || 0)
      if (!exp || exp > Math.floor(Date.now() / 1000) + 60) return lastGood
    }

    // Check if another tab is already refreshing
    if (inFlight) return inFlight

    inFlight = (async () => {
      try {
        // Try to acquire refresh lock
        const lockResult = await acquireRefreshLock(tabId)

        if (lockResult.waited) {
          // We waited for another tab to refresh
          // Re-read session from localStorage (another tab may have updated it)
          invalidateCache()
          // Check if cache is now warm (another tab may have validated)
          if (lastGood && (Date.now() - lastGoodAt) < VALIDATE_TTL) {
            const exp = Number(lastGood.expires_at || 0)
            if (!exp || exp > Math.floor(Date.now() / 1000) + 60) {
              return lastGood
            }
          }
        }

        if (!lockResult.acquired) {
          // Failed to acquire lock (timeout), use fallback
          const fallback = readSession()
          if (fallback && fallback.access_token) {
            invalidateCache()
            return fallback
          }
          return null
        }

        // We hold the lock; perform validation
        try {
          return await _validateOnce()
        } finally {
          clearLock(tabId)
        }
      } finally {
        inFlight = null
      }
    })()

    return inFlight
  }

  // Initialize cross-tab sync on module load
  installStorageListener()

  // Export enhanced public API (backward compatible)
  global.RifimPortalSession = {
    read: readSession,
    clear: clearSessionWithBroadcast,  // Enhanced with broadcast
    validate: validateSessionWithLocking,  // Enhanced with locking
    require: requireSession,
    invalidate: invalidateCache,
    normalizeRole,
    canMutate,
    config: { supabaseUrl: SB_URL, supabaseAnonKey: SB_ANON, isPreview },
    // Item 3: expose internals for testing
    _getTabId: getTabId,
    _readLock: readLock,
    _acquireRefreshLock: acquireRefreshLock,
  }

  installHrisMutationGuard()
  installFinanceDriverPolicyUi()
})(window)