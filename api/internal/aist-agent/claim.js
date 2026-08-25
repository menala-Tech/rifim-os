const { json, verifyAgent, sbRpc } = require('../../../shared/aist-agent')

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { success:false, message:'Method not allowed' })
  try {
    const deviceId = verifyAgent(req)
    const agent = await sbRpc('aist_agent_get_operator', { p_device_id: deviceId })
    const operatorId = agent?.operator_id || agent?.[0]?.operator_id
    if (!operatorId) throw new Error('agent_operator_missing')
    const job = await sbRpc('aist_claim_job', { p_device_id: deviceId, p_operator_id: operatorId })
    if (!job || (Array.isArray(job) && !job[0])) return json(res, 200, { success:true, job:null })
    return json(res, 200, { success:true, job:Array.isArray(job) ? job[0] : job })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (/admin_active|agent_not_ready/i.test(message)) return json(res, 200, { success:true, job:null, reason:message })
    return json(res, 409, { success:false, message })
  }
}
