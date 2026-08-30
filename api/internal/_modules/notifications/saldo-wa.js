'use strict';

// WhatsApp adapter contract for saldo admin notifications.
//
// Original (Phase 4, 2026-08-29): stub with deliver_deferred until recipient
// phone verification.
//
// Phase 5 (2026-08-30): live dispatch via shared fonnte-wa helper. Admin
// recipients diambil dari (a) user_profiles.phone di admin_phones argument
// yang lolos verifikasi, DAN (b) env ADMIN_WA_PHONES fallback (Sasih/Genia/
// Putri). Dispatch tetap gated `FONNTE_ENABLED=true` di env supaya deploy
// tidak langsung kirim tanpa verifikasi manual.
//
// Saldo creation must never depend on this result — kirim WA best-effort.

const createFonnteWa = require('./fonnte-wa');

module.exports = function createSaldoWa(deps) {
  if (!deps || typeof deps.sb !== 'function') throw new Error('saldo-wa: missing sb dependency');
  const { sb } = deps;
  const fonnte = createFonnteWa();

  async function attemptDelivery({ notification_ids, admin_phones, request_no, branch_name, staff_name, driver_name, driver_login, nominal }) {
    // Union: DB admin phones + env fallback (dedupe)
    const envPhones = fonnte.getAdminPhonesFromEnv();
    const dbPhones = (admin_phones || []).map(fonnte.normalizePhone).filter(Boolean);
    const seen = new Set();
    const recipients = [];
    for (const p of [...envPhones, ...dbPhones]) {
      if (!seen.has(p)) { seen.add(p); recipients.push(p); }
    }

    if (!recipients.length) {
      for (const id of (notification_ids || [])) {
        await logAttempt(id, 'no_recipient', 'No admin phones from DB or ADMIN_WA_PHONES env');
      }
      return { delivered: false, reason: 'no_recipient' };
    }

    // Build WA-formatted message (fits Fonnte 4096 char limit trivially).
    const fmt = (n) => 'Rp ' + (Number(n) || 0).toLocaleString('id-ID');
    const msg = [
      '💰 *Pengajuan Isi Saldo Baru*',
      '',
      `No: ${request_no || '-'}`,
      `Cabang: ${branch_name || '-'}`,
      `Staff: ${staff_name || '-'}`,
      `Driver: ${driver_name || '-'}${driver_login ? ' (' + driver_login + ')' : ''}`,
      `Nominal: ${fmt(nominal)}`,
      '',
      'Buka Rifim-OS Finance → Isi Saldo (RAOS) untuk proses.',
    ].join('\n');

    const result = await fonnte.send({
      phones: recipients,
      message: msg,
      tag: 'saldo_new',
    });

    // Audit per notification_id (masing-masing admin punya 1 notif row)
    for (const id of (notification_ids || [])) {
      const status = result.ok ? 'delivered' : (result.reason || 'failed');
      const detail = JSON.stringify({
        sent: result.sent, skipped: result.skipped,
        reason: result.reason,
        // Redact target detail — hanya count, tidak bocorkan nomor ke log DB
      }).slice(0, 500);
      await logAttempt(id, status, detail);
    }

    return {
      delivered: result.ok,
      reason: result.reason,
      detail: {
        provider: 'fonnte',
        recipient_count: recipients.length,
        sent: result.sent,
        skipped: result.skipped,
      }
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
      console.error('[saldo-wa] logAttempt failed:', e.message || e);
    }
  }

  return { attemptDelivery };
};
