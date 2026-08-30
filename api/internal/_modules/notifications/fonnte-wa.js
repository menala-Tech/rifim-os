'use strict';

// Shared Fonnte WhatsApp dispatcher (Phase 5, 2026-08-30).
//
// Consumers:
//   - saldo-wa.js       — notif saldo baru masuk ke admin
//   - error-alert.js    — alert error/exception ke admin ops
//   - broadcast helper  — pengumuman penting parallel ke chat room
//
// Contract:
//   const wa = require('./fonnte-wa')();
//   const result = await wa.send({ phones: ['62xxx'], message: 'Hello', tag: 'saldo' });
//   // result = { ok: true, sent: N, results: [...] }
//
// Env vars (Vercel):
//   FONNTE_TOKEN         — device token dari fonnte.com dashboard
//   ADMIN_WA_PHONES      — comma-separated fallback recipients (Sasih/Genia/Putri)
//   FONNTE_ENABLED       — 'true' untuk aktifkan HTTP dispatch (default 'false' untuk safety)
//   FONNTE_ENDPOINT      — override endpoint (default https://api.fonnte.com/send)
//
// Rate limit: Fonnte free tier ~10 msg/menit. Kalau kirim > 3 nomor, jeda 500ms per call.
// Fonnte quirks: nomor Indonesia harus 62 prefix (bukan 0), tanpa +.

const DEFAULT_ENDPOINT = 'https://api.fonnte.com/send';

function env(name) {
  return String(process.env[name] || '').trim();
}

/**
 * Normalisasi nomor WA ke format Fonnte:
 *   - '08xxxx'    → '628xxxx'
 *   - '+62xxx'    → '62xxx'
 *   - '62xxx'     → '62xxx' (unchanged)
 *   - '8xxxx'     → '628xxxx'
 * Return null kalau tidak valid (kurang dari 8 digit setelah normalisasi).
 */
function normalizePhone(raw) {
  if (raw == null) return null;
  let s = String(raw).replace(/[^\d]/g, '');
  if (!s) return null;
  if (s.startsWith('0')) s = '62' + s.slice(1);
  else if (s.startsWith('8')) s = '62' + s;
  // Reject obviously invalid
  if (s.length < 10 || s.length > 15) return null;
  if (!s.startsWith('62')) return null;
  return s;
}

/**
 * Ambil daftar admin phones dari env var ADMIN_WA_PHONES (fallback recipients).
 * Format: 'phone1,phone2,phone3' — comma or space separated.
 */
function getAdminPhonesFromEnv() {
  const raw = env('ADMIN_WA_PHONES');
  if (!raw) return [];
  return raw.split(/[,\s;]+/).map(normalizePhone).filter(Boolean);
}

/**
 * Send WA via Fonnte HTTP API.
 * @param {{phones: string[], message: string, tag?: string, delay?: number}} opts
 * @returns {Promise<{ok: boolean, sent: number, skipped: number, results: object[], reason?: string}>}
 */
async function send({ phones, message, tag, delay = 500 }) {
  const token = env('FONNTE_TOKEN');
  // Preserve legacy contract string 'provider_not_configured' (Phase 4 test asserts on this).
  if (!token) return { ok: false, sent: 0, skipped: (phones || []).length, results: [], reason: 'provider_not_configured' };

  // Safety toggle — default OFF supaya deploy code baru tidak langsung kirim WA
  // sampai admin verify.
  const enabled = env('FONNTE_ENABLED').toLowerCase() === 'true';
  if (!enabled) return { ok: false, sent: 0, skipped: (phones || []).length, results: [], reason: 'dispatch_disabled' };

  const endpoint = env('FONNTE_ENDPOINT') || DEFAULT_ENDPOINT;
  const normalized = (phones || []).map(normalizePhone).filter(Boolean);
  if (!normalized.length) return { ok: false, sent: 0, skipped: 0, results: [], reason: 'no valid phones after normalization' };
  if (!message || !String(message).trim()) return { ok: false, sent: 0, skipped: normalized.length, results: [], reason: 'empty message' };

  const results = [];
  let sent = 0;
  for (let i = 0; i < normalized.length; i++) {
    const target = normalized[i];
    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': token,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          target,
          message: String(message).slice(0, 4096),
          countryCode: '62',
        }).toString(),
      });
      const text = await resp.text();
      let body; try { body = JSON.parse(text); } catch (_) { body = { raw: text }; }
      const ok = resp.ok && body.status !== false;
      if (ok) sent++;
      results.push({ target, ok, status: resp.status, body, tag });
    } catch (err) {
      results.push({ target, ok: false, error: String(err && err.message || err), tag });
    }
    // Rate-limit pacing between calls (skip after last)
    if (i < normalized.length - 1 && delay > 0) {
      await new Promise(r => setTimeout(r, delay));
    }
  }

  return {
    ok: sent > 0,
    sent,
    skipped: normalized.length - sent,
    results,
  };
}

module.exports = function createFonnteWa() {
  return { send, normalizePhone, getAdminPhonesFromEnv };
};
