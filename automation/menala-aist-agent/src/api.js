function required(name) {
  const v = String(process.env[name] || '').trim()
  if (!v) throw new Error(`${name} belum dikonfigurasi`)
  return v
}
async function readJson(res) {
  const text = await res.text()
  try { return text ? JSON.parse(text) : {} }
  catch (_) { return { message:text || `HTTP ${res.status}` } }
}
class AgentApi {
  constructor(identity) {
    this.baseUrl = required('RIFIM_OS_URL').replace(/\/$/, '')
    this.token = required('AIST_AGENT_TOKEN')
    this.identity = identity
  }
  async call(path, body) {
    const res = await fetch(this.baseUrl + path, {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'x-aist-agent-token':this.token, 'x-aist-device-id':this.identity.device_id },
      body:JSON.stringify(body || {}),
    })
    const data = await readJson(res)
    if (!res.ok || data.success === false) throw new Error(data.message || `Broker HTTP ${res.status}`)
    return data
  }
  heartbeat(state) {
    return this.call('/api/internal/aist-agent/heartbeat', {
      machine_name:this.identity.machine_name,
      operator_email:process.env.OPERATOR_EMAIL || '',
      agent_version:'2.0.0',
      status:state.status,
      aist_ready:state.aistReady,
      finance_ready:state.financeReady,
      last_admin_activity_at:state.lastAdminActivityAt || null,
      last_error:state.lastError || null,
    })
  }
  claim() { return this.call('/api/internal/aist-agent/claim', {}) }
  running(jobId) { return this.call('/api/internal/aist-agent/running', { job_id:jobId }) }
  verifying(jobId, reference, result) {
    return this.call('/api/internal/aist-agent/verifying', { job_id:jobId, reference:reference || '', result:result || {} })
  }
  complete(jobId, payload) {
    return this.call('/api/internal/aist-agent/complete', {
      job_id:jobId,
      success:payload.success,
      error_code:payload.errorCode || null,
      error_message:payload.errorMessage || null,
    })
  }
}
module.exports = { AgentApi }
