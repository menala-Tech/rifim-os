(function (global) {
  'use strict'

  const SB_URL = 'https://vlievtojpmrbsmzlqswl.supabase.co'
  const SB_ANON = 'sb_publishable_8KpL6zmpt_O_x21v4Jn3Tw_J_I3y-r1'
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

  async function refreshToken(refreshToken) {
    const res = await fetch(SB_URL + '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      headers: {
        apikey: SB_ANON,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
    if (!res.ok) throw new Error('Portal session refresh gagal')
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
    if (!res.ok) throw new Error('Portal profile validation gagal')
    const rows = await res.json()
    return Array.isArray(rows) ? rows[0] || null : null
  }

  async function validateSession() {
    const saved = readSession()
    if (!saved || !saved.access_token) return null

    let accessToken = saved.access_token
    let refreshTokenValue = saved.refresh_token || ''
    let expiresAt = Number(saved.expires_at || 0)
    const now = Math.floor(Date.now() / 1000)

    try {
      if (!expiresAt || expiresAt <= now + 60) {
        if (!refreshTokenValue) throw new Error('Refresh token tidak tersedia')
        const refreshed = await refreshToken(refreshTokenValue)
        accessToken = refreshed.access_token || ''
        refreshTokenValue = refreshed.refresh_token || refreshTokenValue
        expiresAt = Number(refreshed.expires_at || (now + Number(refreshed.expires_in || 3600)))
        if (!accessToken) throw new Error('Access token kosong setelah refresh')
      }

      const payload = decodeJwt(accessToken)
      const userId = payload && payload.sub
      if (!userId) throw new Error('Token Portal tidak valid')

      const profile = await fetchProfile(accessToken, userId)
      if (!profile || profile.is_active === false) throw new Error('Profil Portal tidak aktif')

      return writeSession(Object.assign({}, saved, {
        id: profile.id,
        full_name: profile.full_name || saved.full_name || saved.name || saved.email || 'User',
        name: profile.full_name || saved.name || saved.full_name || saved.email || 'User',
        role: normalizeRole(profile.role || saved.role),
        staff_id: profile.staff_id || saved.staff_id || null,
        branch_id: profile.branch_id || saved.branch_id || null,
        access_token: accessToken,
        refresh_token: refreshTokenValue,
        expires_at: expiresAt,
        ts: Date.now(),
      }))
    } catch (err) {
      console.warn('[RifimPortalSession]', err && err.message ? err.message : err)
      clearSession()
      return null
    }
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

  global.RifimPortalSession = {
    read: readSession,
    clear: clearSession,
    validate: validateSession,
    require: requireSession,
    normalizeRole,
    canMutate,
  }

  installHrisMutationGuard()
  installFinanceDriverPolicyUi()
})(window)