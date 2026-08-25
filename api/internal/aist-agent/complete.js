const { json, verifyAgent, sbRpc, markPaidWithService } = require('../../../shared/aist-agent')

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { success:false, message:'Method not allowed' })
  try {
    const deviceId = verifyAgent(req)
    const jobId = req.body?.job_id
    if (!jobId) throw new Error('job_id_required')

    const job = await sbRpc('aist_job_get_for_device', { p_job_id:jobId, p_device_id:deviceId })
    const row = Array.isArray(job) ? job[0] : job
    if (!row?.id) throw new Error('job_not_found_or_not_owned')

    if (req.body?.success === true) {
      if (row.status !== 'verifying') throw new Error('job_not_verified')
      if (!row.aist_result) throw new Error('aist_result_missing')

      const paid = await markPaidWithService(row.request_id, row.claimed_by_operator)
      const paidStatus = paid?.status || paid?.[0]?.status
      if (paidStatus && !['updated','already_processed'].includes(paidStatus)) throw new Error(`mark_paid_rejected:${paidStatus}`)

      const finished = await sbRpc('aist_job_finish', {
        p_job_id:jobId, p_device_id:deviceId, p_success:true,
        p_error_code:null, p_error_message:null,
      })

      const day = String(row.requested_at || '').slice(0,10)
      if (row.branch_id && day) {
        await sbRpc('aist_refresh_invoice_daily', { p_branch_id:row.branch_id, p_date:day }).catch(() => {})
      }
      return json(res, 200, { success:true, job:finished, mark_paid_status:paidStatus || 'updated' })
    }

    const failed = await sbRpc('aist_job_finish', {
      p_job_id:jobId, p_device_id:deviceId, p_success:false,
      p_error_code:req.body?.error_code || 'aist_failed',
      p_error_message:req.body?.error_message || 'AIST gagal',
    })
    return json(res, 200, { success:true, job:failed })
  } catch (err) {
    return json(res, 409, { success:false, message:err instanceof Error ? err.message : String(err) })
  }
}
