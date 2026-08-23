const { env, json, sbRpc, readJson, roleOf } = require('./_shared')

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { success:false, message:'Method not allowed' })
  try {
    const token = String(req.headers.authorization || '')
    if (!token.startsWith('Bearer ')) throw new Error('Bearer required')

    const url = env('SUPABASE_URL')
    const publishable = env('SUPABASE_PUBLISHABLE_KEY')
    if (!url || !publishable) throw new Error('Supabase env missing')

    const authRes = await fetch(`${url}/auth/v1/user`, { headers:{ apikey:publishable, Authorization:token } })
    const auth = await readJson(authRes)
    if (!authRes.ok || !auth?.id) throw new Error('Session Finance invalid')

    const profRes = await fetch(`${url}/rest/v1/user_profiles?id=eq.${encodeURIComponent(auth.id)}&select=id,role,is_active&limit=1`, {
      headers:{ apikey:publishable, Authorization:token },
    })
    const profiles = await readJson(profRes)
    const profile = profiles?.[0]
    const role = roleOf(profile?.role)
    if (!profile?.is_active || !['admin','direksi'].includes(role)) throw new Error('Role tidak diizinkan')

    const requestId = String(req.body?.request_id || '').trim()
    if (!requestId) throw new Error('request_id wajib')
    const job = await sbRpc('aist_request_manual', { p_request_id:requestId, p_operator_id:auth.id })
    const row = Array.isArray(job) ? job[0] : job
    if (!row?.id) throw new Error('Request sudah diproses atau sedang di-claim')

    return json(res, 200, { success:true, message:'Manual Auto-Fill masuk antrean agent', job:row })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const status = /Bearer|Session/i.test(message) ? 401 : /Role/i.test(message) ? 403 : 409
    return json(res, status, { success:false, message })
  }
}
