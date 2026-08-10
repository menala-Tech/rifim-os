const { env, json, readJson } = require('./_shared')

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { success:false, message:'Method not allowed' })
  const token = String(req.headers.authorization || '')
  if (!token.startsWith('Bearer ')) return json(res, 401, { success:false, message:'Bearer required' })

  const url = env('SUPABASE_URL')
  const publishable = env('SUPABASE_PUBLISHABLE_KEY')
  const service = env('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !publishable || !service) return json(res, 503, { success:false, message:'Supabase env missing' })

  const authRes = await fetch(`${url}/auth/v1/user`, { headers:{ apikey:publishable, Authorization:token } })
  const auth = await readJson(authRes)
  if (!authRes.ok || !auth?.id) return json(res, 401, { success:false, message:'Session invalid' })

  const profRes = await fetch(`${url}/rest/v1/user_profiles?id=eq.${encodeURIComponent(auth.id)}&select=role,is_active&limit=1`, {
    headers:{ apikey:service, Authorization:`Bearer ${service}` },
  })
  const profiles = await readJson(profRes)
  const role = String(profiles?.[0]?.role || '').toLowerCase()
  if (!profiles?.[0]?.is_active || !['admin','management','direksi','direktur'].includes(role)) {
    return json(res, 403, { success:false, message:'Role not allowed' })
  }

  const agentRes = await fetch(`${url}/rest/v1/aist_agents?last_seen_at=gte.${encodeURIComponent(new Date(Date.now()-30000).toISOString())}&select=*&order=last_seen_at.desc&limit=1`, {
    headers:{ apikey:service, Authorization:`Bearer ${service}` },
  })
  const agents = await readJson(agentRes)
  return json(res, 200, { success:true, agent:Array.isArray(agents) ? (agents[0] || null) : null })
}
