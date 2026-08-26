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
    if (res.status === 401 || res.status === 403) {
      throw AuthHardError('Portal profile ditolak (token invalid)')
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

  global.RifimPortalSession = {
    read: readSession,
    clear: clearSession,
    validate: validateSession,
    require: requireSession,
    invalidate: invalidateCache,
    normalizeRole,
    canMutate,
    config: { supabaseUrl: SB_URL, supabaseAnonKey: SB_ANON, isPreview },
  }

  installHrisMutationGuard()
  installFinanceDriverPolicyUi()
})(window)