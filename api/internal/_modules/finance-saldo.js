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

const createOutbox = require('./notifications/outbox');
const createSaldoWa = require('./notifications/saldo-wa');

module.exports = function createFinanceSaldo(deps) {
  if (!deps || typeof deps.sb !== 'function' || typeof deps.sbAsActor !== 'function' || typeof deps.opsAudit !== 'function' || typeof deps.q !== 'function') {
    throw new Error('finance-saldo: missing required dependencies (sb, sbAsActor, opsAudit, q)');
  }
  const { sb, sbAsActor, opsAudit, q } = deps;
  const outbox = createOutbox({ sb });
  const wa = createSaldoWa({ sb });

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

  // Phase 4 (2026-08-29): queue a deterministic WhatsApp admin notification
  // for a newly created saldo request. No new Vercel function; this is a
  // mode branch on the existing hris-contracts dispatcher. Actual WA delivery
  // is adapter-gated by FONNTE_TOKEN; saldo creation must never depend on it.
  async function notifySaldo(req, p) {
    const id = String(req.body?.request_id || req.body?.id || '').trim();
    if (!id) throw new Error('request_id wajib');

    const rows = await sb(`/rest/v1/raos_saldo_requests?id=eq.${q(id)}&select=request_no,branch_id,nominal,requested_at,driver_name,driver_login_id,staff_id&limit=1`);
    const row = (rows || [])[0];
    if (!row) return { status: 'not_found', id };

    const [staffRows, branchRows] = await Promise.all([
      row.staff_id ? sb(`/rest/v1/user_profiles?id=eq.${q(row.staff_id)}&select=full_name&limit=1`) : Promise.resolve([]),
      row.branch_id ? sb(`/rest/v1/branches?id=eq.${q(row.branch_id)}&select=name,slug&limit=1`) : Promise.resolve([])
    ]);
    const staff_name = (staffRows && staffRows[0] && staffRows[0].full_name) || '';
    const branch = (branchRows && branchRows[0]) || {};
    const branch_name = branch.name || branch.slug || '';

    const queued = await outbox.queueWhatsAppSaldo({
      request_id: id,
      request_no: row.request_no,
      branch_name,
      staff_name,
      driver_name: row.driver_name,
      driver_login: row.driver_login_id,
      nominal: row.nominal,
      requested_at: row.requested_at
    });

    if (!queued.queued) {
      await opsAudit(p, 'finance_saldo_notify', 'finance_saldo', { request_id: id }, 0, false, { reason: queued.reason });
      return { status: queued.reason, id };
    }

    const delivery = await wa.attemptDelivery(queued);
    await opsAudit(p, 'finance_saldo_notify', 'finance_saldo', { request_id: id }, queued.recipient_count, true, { delivery });
    return { status: 'queued', id, delivery, notification: queued };
  }

  return {
    listSaldo,
    markSaldo,
    cancelSaldo,
    notifySaldo,
    _internals: { SALDO_STATUS_WHITELIST, SALDO_STATUS_ALIASES } // exposed for tests only
  };
};
