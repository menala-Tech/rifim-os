const crypto = require('crypto')

function env(name) { return String(process.env[name] || '').trim() }
function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8')
  return res.end(JSON.stringify(body))
}
function safeEqual(a, b) {
  const aa = Buffer.from(String(a || ''))
  const bb = Buffer.from(String(b || ''))
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb)
}
function verifyAgent(req) {
  const expected = env('AIST_AGENT_SHARED_TOKEN') || env('AIST_RUNNER_SHARED_SECRET')
  const got = String(req.headers['x-aist-agent-token'] || '')
  if (!expected || !safeEqual(expected, got)) throw new Error('agent_unauthorized')
  const deviceId = String(req.headers['x-aist-device-id'] || '').trim()
  if (!deviceId) throw new Error('device_id_required')
  return deviceId
}
async function readJson(res) {
  const text = await res.text()
  try { return text ? JSON.parse(text) : {} }
  catch (_) { return { message: text || `HTTP ${res.status}` } }
}
async function sbRpc(functionName, body) {
  const url = env('SUPABASE_URL')
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceKey) throw new Error('supabase_server_env_missing')
  const res = await fetch(`${url}/rest/v1/rpc/${functionName}`, {
    method: 'POST',
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  })
  const data = await readJson(res)
  if (!res.ok) throw new Error(data.message || data.error || `${functionName} HTTP ${res.status}`)
  return data
}
async function getOperatorByEmail(email) {
  const url = env('SUPABASE_URL')
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceKey) throw new Error('supabase_server_env_missing')
  const res = await fetch(`${url}/rest/v1/user_profiles?email=eq.${encodeURIComponent(email)}&is_active=eq.true&select=id,email,role,branch_id&limit=1`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  })
  const rows = await readJson(res)
  if (!res.ok || !Array.isArray(rows) || !rows[0]) throw new Error('operator_not_found')
  const role = String(rows[0].role || '').toLowerCase()
  if (!['admin','direksi','direktur'].includes(role)) throw new Error('operator_role_not_allowed')
  return rows[0]
}
async function markPaidWithService(requestId, processorId) {
  return sbRpc('raos_saldo_mark_paid', { p_request_id: requestId, p_processor_id: processorId })
}
module.exports = { env, json, verifyAgent, sbRpc, getOperatorByEmail, markPaidWithService, readJson }
