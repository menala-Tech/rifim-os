const crypto = require('crypto')

function env(name) { return String(process.env[name] || '').trim() }
function roleOf(v) { v = String(v || '').toLowerCase(); return v === 'direktur' ? 'direksi' : v === 'koord' ? 'koordinator' : v === 'mgmt' ? 'management' : v }
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
  // Hotfix 2026-08-29: canonical resolver → QA on Preview, PROD elsewhere.
  const {url,service:serviceKey}=require('../api/_lib/sb-env').resolve()
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
  // Hotfix 2026-08-29: canonical resolver → QA on Preview, PROD elsewhere.
  const {url,service:serviceKey}=require('../api/_lib/sb-env').resolve()
  if (!url || !serviceKey) throw new Error('supabase_server_env_missing')
  const res = await fetch(`${url}/rest/v1/user_profiles?email=eq.${encodeURIComponent(email)}&is_active=eq.true&select=id,email,role,branch_id&limit=1`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  })
  const rows = await readJson(res)
  if (!res.ok || !Array.isArray(rows) || !rows[0]) throw new Error('operator_not_found')
  const role = roleOf(rows[0].role)
  if (!['admin','direksi'].includes(role)) throw new Error('operator_role_not_allowed')
  rows[0].role = role
  return rows[0]
}
async function markPaidWithService(requestId, processorId) {
  return sbRpc('raos_saldo_mark_paid', { p_request_id: requestId, p_processor_id: processorId })
}
module.exports = { env, json, verifyAgent, sbRpc, getOperatorByEmail, markPaidWithService, readJson, roleOf }
