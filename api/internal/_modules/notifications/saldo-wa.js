'use strict';

// WhatsApp adapter contract for saldo admin notifications (Phase 4, 2026-08-29).
// This is an internal module, not a Vercel function. It attempts delivery
// only when a real provider token is configured; otherwise it returns
// provider_not_configured and audits the attempt. Saldo creation must never
// depend on this result.

module.exports = function createSaldoWa(deps) {
  if (!deps || typeof deps.sb !== 'function') throw new Error('saldo-wa: missing sb dependency');
  const { sb } = deps;

  function env(n) { return String(process.env[n] || '').trim(); }

  async function attemptDelivery({ notification_ids, admin_phones }) {
    const token = env('FONNTE_TOKEN');
    if (!token) {
      for (const id of (notification_ids || [])) {
        await logAttempt(id, 'provider_not_configured', 'FONNTE_TOKEN not configured');
      }
      return { delivered: false, reason: 'provider_not_configured' };
    }

    // Provider token exists but actual HTTP dispatch is intentionally gated.
    // Implementing real Fonnte HTTP requires a verified device/token and
    // recipient phone normalization. Until then, the contract is proven safe
    // by storing delivery attempts in notification_delivery_log.
    for (const id of (notification_ids || [])) {
      await logAttempt(id, 'deliver_deferred', 'WA adapter exists; live dispatch deferred pending recipient phone verification');
    }
    return {
      delivered: false,
      reason: 'deliver_deferred',
      detail: { provider: 'fonnte', recipient_count: (admin_phones || []).length }
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
