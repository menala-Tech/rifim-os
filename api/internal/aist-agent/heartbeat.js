const { json, verifyAgent, sbRpc, getOperatorByEmail } = require('../../../shared/aist-agent')

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { success:false, message:'Method not allowed' })
  try {
    const deviceId = verifyAgent(req)
    const email = String(req.body?.operator_email || '').trim().toLowerCase()
    if (!email) throw new Error('operator_email_required')
    const operator = await getOperatorByEmail(email)
    const row = await sbRpc('aist_agent_heartbeat', {
      p_device_id: deviceId,
      p_operator_id: operator.id,
      p_operator_email: operator.email,
      p_machine_name: String(req.body?.machine_name || ''),
      p_agent_version: String(req.body?.agent_version || ''),
      p_status: String(req.body?.status || 'online'),
      p_aist_ready: !!req.body?.aist_ready,
      p_finance_ready: !!req.body?.finance_ready,
      p_last_admin_activity_at: req.body?.last_admin_activity_at || null,
      p_last_error: req.body?.last_error || null,
    })
    return json(res, 200, { success:true, agent:row, operator_role:operator.role })
  } catch (err) {
    return json(res, 403, { success:false, message:err instanceof Error ? err.message : String(err) })
  }
}
