const ALLOWED_ROLES = new Set(['admin', 'direksi', 'direktur'])

function env(name) { return String(process.env[name] || '').trim() }
function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8')
  return res.end(JSON.stringify(body))
}
function bearer(req) {
  const raw = String(req.headers.authorization || '')
  return raw.startsWith('Bearer ') ? raw.slice(7).trim() : ''
}
function validPayload(body) {
  const requestId = String(body?.request_id || '').trim()
  const driverLogin = String(body?.driver_login || '').trim()
  const nominal = Number(body?.nominal)
  if (!requestId) return { error:'request_id wajib' }
  if (!driverLogin) return { error:'driver_login wajib' }
  if (!Number.isFinite(nominal) || nominal <= 0) return { error:'nominal tidak valid' }
  return { requestId, driverLogin, nominal }
}
async function readJson(response) {
  const text = await response.text()
  try { return text ? JSON.parse(text) : {} }
  catch (_) { return { message:text || `HTTP ${response.status}` } }
}
async function verifyActor(token, supabaseUrl, publishableKey) {
  const authRes = await fetch(`${supabaseUrl}/auth/v1/user`, { headers:{ apikey:publishableKey, Authorization:`Bearer ${token}` } })
  const authUser = await readJson(authRes)
  if (!authRes.ok || !authUser?.id) throw new Error('Session Supabase tidak valid atau kedaluwarsa')

  const profileRes = await fetch(`${supabaseUrl}/rest/v1/user_profiles?id=eq.${encodeURIComponent(authUser.id)}&select=id,role,is_active&limit=1`, {
    headers:{ apikey:publishableKey, Authorization:`Bearer ${token}`, Accept:'application/json' },
  })
  const profiles = await readJson(profileRes)
  if (!profileRes.ok || !Array.isArray(profiles) || !profiles[0]) throw new Error('Profil user tidak ditemukan')
  const profile = profiles[0]
  const role = String(profile.role || '').toLowerCase()
  if (profile.is_active === false) throw new Error('Akun tidak aktif')
  if (!ALLOWED_ROLES.has(role)) throw new Error('Akses AIST mutation hanya admin/direksi')
  return { id:authUser.id, role }
}
async function runPlaywright(runnerUrl, runnerSecret, payload) {
  const response = await fetch(`${runnerUrl.replace(/\/$/, '')}/run`, {
    method:'POST',
    headers:{ 'Content-Type':'application/json', 'x-runner-secret':runnerSecret },
    body:JSON.stringify(payload),
  })
  const data = await readJson(response)
  if (!response.ok || data?.success !== true) throw new Error(data?.message || data?.error || `AIST runner gagal (HTTP ${response.status})`)
  return data
}
async function markPaid(gasUrl, token, requestId) {
  const response = await fetch(gasUrl, {
    method:'POST',
    headers:{ 'Content-Type':'text/plain;charset=utf-8' },
    body:JSON.stringify({ action:'finance_saldo_raos_mark_paid', access_token:token, id:requestId }),
  })
  const data = await readJson(response)
  if (!response.ok || data?.success !== true) throw new Error(data?.message || `Mark-paid gagal (HTTP ${response.status})`)
  if (data.status && !['updated','already_processed'].includes(data.status)) throw new Error(`Mark-paid ditolak: ${data.status}`)
  return data
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return json(res, 405, { success:false, message:'Method not allowed' })
  }

  const supabaseUrl = env('SUPABASE_URL')
  const publishableKey = env('SUPABASE_PUBLISHABLE_KEY')
  const runnerUrl = env('AIST_RUNNER_URL')
  const runnerSecret = env('AIST_RUNNER_SHARED_SECRET')
  const gasUrl = env('RIFIM_GAS_WEBAPP_URL')
  if (!supabaseUrl || !publishableKey || !runnerUrl || !runnerSecret || !gasUrl) {
    return json(res, 503, { success:false, message:'AIST runner belum dikonfigurasi di environment server' })
  }

  const token = bearer(req)
  if (!token) return json(res, 401, { success:false, message:'Authorization Bearer token wajib' })
  const input = validPayload(req.body)
  if (input.error) return json(res, 400, { success:false, message:input.error })

  try {
    const actor = await verifyActor(token, supabaseUrl, publishableKey)
    const runner = await runPlaywright(runnerUrl, runnerSecret, {
      request_id:input.requestId, driver_login:input.driverLogin, nominal:input.nominal,
    })
    const paid = await markPaid(gasUrl, token, input.requestId)
    return json(res, 200, {
      success:true,
      request_id:input.requestId,
      actor_role:actor.role,
      runner:{ started_at:runner.started_at || null, completed_at:runner.completed_at || null },
      mark_paid_status:paid.status || 'updated',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const status = /session|profil|akses|akun/i.test(message) ? 403 : 502
    return json(res, status, { success:false, message })
  }
}
