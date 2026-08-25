const { json, verifyAgent, sbRpc } = require('../../../shared/aist-agent')
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { success:false, message:'Method not allowed' })
  try {
    const deviceId = verifyAgent(req)
    const row = await sbRpc('aist_job_set_verifying', {
      p_job_id:req.body?.job_id,
      p_device_id:deviceId,
      p_reference:String(req.body?.reference || ''),
      p_result:req.body?.result || {},
    })
    return json(res, 200, { success:true, job:row })
  } catch (err) {
    return json(res, 409, { success:false, message:err instanceof Error ? err.message : String(err) })
  }
}
