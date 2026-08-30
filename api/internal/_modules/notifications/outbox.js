'use strict';

// Outbox contract for WhatsApp saldo notifications (Phase 4, 2026-08-29).
// This is an internal module, not a Vercel function. It queues a canonical
// notification row via the existing RAOS notification engine RPC and returns
// candidate recipients so the adapter can attempt delivery.

module.exports = function createOutbox(deps) {
  if (!deps || typeof deps.sb !== 'function') throw new Error('outbox: missing sb dependency');
  const { sb } = deps;

  async function queueWhatsAppSaldo({ request_id, request_no, branch_name, staff_name, driver_name, driver_login, nominal, requested_at }) {
    const adminRows = await sb('/rest/v1/user_profiles?role=in.(admin,direksi)&is_active=eq.true&select=id,full_name,phone');
    const user_ids = (adminRows || []).map(r => r.id).filter(Boolean);
    if (!user_ids.length) return { queued: false, reason: 'no_admin_recipient' };

    const fmt = (n) => 'Rp ' + (Number(n) || 0).toLocaleString('id-ID');
    const title = 'Pengajuan Isi Saldo Baru';
    const body = [
      `No: ${request_no || request_id}`,
      `Cabang: ${branch_name || '-'}`,
      `Staff: ${staff_name || '-'}`,
      `Driver: ${driver_name || '-'} ${driver_login ? '(' + driver_login + ')' : ''}`.trim(),
      `Nominal: ${fmt(nominal)}`,
      `Waktu: ${requested_at || '-'}`,
    ].join(' · ');

    const notification_ids = await sb('/rest/v1/rpc/raos_create_notification', {
      method: 'POST',
      body: JSON.stringify({
        p_user_ids: user_ids,
        p_title: title,
        p_body: body,
        p_type: 'finance_saldo_new',
        p_payload_type: 'whatsapp_saldo',
        p_priority: 'high',
        p_channel: 'whatsapp',
        p_data: {
          request_id, request_no, branch_name, staff_name,
          driver_name, driver_login, nominal, requested_at
        },
        p_dedup_key: 'saldo_wa_' + request_id,
        p_dedup_window_sec: 60
      })
    });

    return {
      queued: true,
      notification_ids: (notification_ids || []),
      recipient_count: user_ids.length,
      admin_phones: (adminRows || []).map(r => r.phone).filter(Boolean),
      // Fields dibutuhkan saldo-wa.js untuk compose WA message body (Phase 5)
      request_no, branch_name, staff_name, driver_name, driver_login, nominal, requested_at,
    };
  }

  async function logAttempt(notification_id, status, error_msg) {
    try {
      await sb('/rest/v1/notification_delivery_log', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          notification_id,
          channel: 'whatsapp',
          status,
          error_msg: String(error_msg || '').slice(0, 500)
        })
      });
    } catch (e) {
      console.error('[outbox] logAttempt failed:', e.message || e);
    }
  }

  return { queueWhatsAppSaldo, logAttempt };
};
