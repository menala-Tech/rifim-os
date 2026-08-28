'use strict';

// Internal saldo lifecycle module (Phase 2, 2026-08-29).
// This is intentionally NOT a Vercel serverless function; it is required by
// the existing /api/internal/hris-contracts dispatcher so the function count
// stays at 12. All public mode contracts remain backward compatible.

function financeRead(p) {
  if (!['admin', 'direksi', 'management'].includes(p.role)) throw new Error('Role tidak boleh melihat Finance');
}
function financeWrite(p) {
  if (!['admin', 'direksi'].includes(p.role)) throw new Error('Hanya Admin/Direksi boleh mengubah Finance');
}

module.exports = function createFinanceSaldo(deps) {
  if (!deps || typeof deps.sb !== 'function' || typeof deps.sbAsActor !== 'function' || typeof deps.opsAudit !== 'function' || typeof deps.q !== 'function') {
    throw new Error('finance-saldo: missing required dependencies (sb, sbAsActor, opsAudit, q)');
  }
  const { sb, sbAsActor, opsAudit, q } = deps;

  const SALDO_STATUS_WHITELIST = new Set(['pending', 'approved', 'rejected', 'cancelled']);
  const SALDO_STATUS_ALIASES = { 'ditolak': 'rejected', 'dibatalkan': 'cancelled' };

  async function listSaldo(req, p) {
    financeRead(p);
    let path = '/rest/v1/raos_saldo_requests?is_archived=eq.false&select=id,request_no,staff_id,branch_id,nominal,status,requested_at,created_at,is_processed,processed_at,driver_id,driver_login_id,driver_name,client_id,is_archived,archived_at&order=created_at.desc&limit=500';
    const status = String(req.query.status || '').trim().toLowerCase();
    if (status && status !== 'all' && status !== 'semua') {
      if (['paid', 'processed', 'lunas'].includes(status)) {
        path += '&is_processed=eq.true';
      } else if (['unprocessed', 'belum_lunas'].includes(status)) {
        path += '&is_processed=eq.false';
      } else {
        const canonical = SALDO_STATUS_ALIASES[status] || status;
        if (SALDO_STATUS_WHITELIST.has(canonical)) {
          path += `&status=eq.${q(canonical)}`;
        }
      }
    }
    const rows = await sb(path);
    const staffIds = [...new Set((rows || []).map(x => x.staff_id).filter(Boolean))];
    const branchIds = [...new Set((rows || []).map(x => x.branch_id).filter(Boolean))];
    let prof = [], branches = [];
    if (staffIds.length) {
      prof = await sb(`/rest/v1/user_profiles?id=in.(${staffIds.map(q).join(',')})&select=id,full_name,staff_id`);
    }
    if (branchIds.length) {
      branches = await sb(`/rest/v1/branches?id=in.(${branchIds.map(q).join(',')})&select=id,name,slug`);
    }
    const pm = Object.fromEntries((prof || []).map(x => [String(x.id), x]));
    const bm = Object.fromEntries((branches || []).map(x => [String(x.id), x]));
    return (rows || []).map(r => {
      const s = pm[String(r.staff_id)] || {};
      const b = bm[String(r.branch_id)] || {};
      return { ...r, staff_name: s.full_name || '', staff_code: s.staff_id || '', branch_name: b.name || b.slug || '' };
    });
  }

  async function markSaldo(req, p) {
    financeWrite(p);
    const id = String(req.body?.id || req.body?.request_id || '').trim();
    if (!id) throw new Error('id wajib');
    return await sbAsActor('/rest/v1/rpc/raos_saldo_mark_paid', {
      method: 'POST',
      body: JSON.stringify({ p_request_id: id, p_processor_id: p.id })
    }, String(req.headers.authorization || ''));
  }

  async function cancelSaldo(req, p) {
    financeWrite(p);
    const id = String(req.body?.id || req.body?.request_id || '').trim();
    if (!id) throw new Error('id wajib');
    const rows = await sb(`/rest/v1/raos_saldo_requests?id=eq.${q(id)}&select=id,status,is_processed,is_archived&limit=1`);
    const row = rows && rows[0];
    if (!row) {
      await opsAudit(p, 'finance_saldo_cancel', 'finance_saldo', { id }, 0, false, { reason: 'not_found' });
      return { status: 'not_found', id };
    }
    if (row.is_archived === true) {
      await opsAudit(p, 'finance_saldo_cancel', 'finance_saldo', { id }, 0, false, { reason: 'archived', current_status: row.status });
      throw new Error('Pengajuan sudah diarsipkan dan tidak dapat dibatalkan.');
    }
    if (row.is_processed === true) {
      await opsAudit(p, 'finance_saldo_cancel', 'finance_saldo', { id }, 0, false, { reason: 'already_processed', current_status: row.status });
      throw new Error('Pengajuan sudah diproses (lunas) dan tidak dapat dibatalkan.');
    }
    const s = String(row.status || '').toLowerCase();
    if (s === 'cancelled') {
      await opsAudit(p, 'finance_saldo_cancel', 'finance_saldo', { id }, 0, true, { reason: 'already_cancelled' });
      return { status: 'already_cancelled', id, current_status: 'cancelled' };
    }
    if (s !== 'pending') {
      await opsAudit(p, 'finance_saldo_cancel', 'finance_saldo', { id }, 0, false, { reason: 'not_cancellable', current_status: s });
      throw new Error(`Status saat ini "${s}" tidak dapat dibatalkan. Hanya pengajuan pending yang dapat dibatalkan.`);
    }
    await sb(`/rest/v1/raos_saldo_requests?id=eq.${q(id)}&status=eq.pending&is_processed=eq.false&is_archived=eq.false`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ status: 'cancelled' })
    });
    await opsAudit(p, 'finance_saldo_cancel', 'finance_saldo', { id }, 1, true, { previous_status: 'pending', new_status: 'cancelled' });
    return { status: 'cancelled', id, current_status: 'cancelled' };
  }

  return {
    listSaldo,
    markSaldo,
    cancelSaldo,
    _internals: { SALDO_STATUS_WHITELIST, SALDO_STATUS_ALIASES } // exposed for tests only
  };
};
