'use strict';

// Shared canonical logging helper for notifications (Phase 6 remediation,
// 2026-08-31).
//
// Background:
//   Architect audit menemukan tabel `raos_ops_audit` dan `rifim_ops_audit_log`
//   TIDAK EXIST di Production Supabase (project vlievtojpmrbsmzlqswl).
//   Canonical table yang ada: public.system_logs
//     id uuid, type text, process text, status text, detail text (JSON string),
//     created_at timestamptz
//
// This helper adalah single canonical sink untuk:
//   - error-alert.js  (cooldown query + alert dispatch audit)
//   - broadcast.js    (broadcast audit)
//   - future notification internal modules
//
// Do NOT create alternative log helpers. Do NOT create Vercel route.

const MAX_DETAIL_LEN = 4000;

/**
 * Sanitize detail object to safe JSON string.
 * Never include: token/phone/JWT/password/env dump/full private body.
 */
function safeDetailJson(obj) {
  try {
    const s = JSON.stringify(obj == null ? {} : obj);
    return s.length > MAX_DETAIL_LEN ? s.slice(0, MAX_DETAIL_LEN) : s;
  } catch (_) {
    return '{}';
  }
}

module.exports = function createSystemLog(deps) {
  if (!deps || typeof deps.sb !== 'function') throw new Error('system-log: missing sb dependency');
  const { sb } = deps;

  /**
   * Insert one row into public.system_logs. Never throws — caller must
   * treat logging as best-effort so business flow tidak rollback.
   * @param {{type: string, process: string, status: string, detail: object|string}} row
   * @returns {Promise<{ok: boolean, error?: string}>}
   */
  async function writeSystemLog({ type, process: proc, status, detail }) {
    try {
      const body = {
        type: String(type || 'unknown').slice(0, 80),
        process: String(proc || 'unknown').slice(0, 200),
        status: String(status || 'unknown').slice(0, 40),
        detail: typeof detail === 'string' ? detail.slice(0, MAX_DETAIL_LEN) : safeDetailJson(detail),
      };
      await sb('/rest/v1/system_logs', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(body),
      });
      return { ok: true };
    } catch (e) {
      // Never throw — logging is best-effort.
      console.warn('[system-log] write failed:', e && e.message);
      return { ok: false, error: String(e && e.message || e).slice(0, 300) };
    }
  }

  /**
   * Query recent system_logs rows filtered by type + process, within
   * `windowSeconds`. Parse detail JSON server-side and return array of
   * {row, detail} objects. Used untuk cooldown lookup.
   *
   * Detail is TEXT (not jsonb), so we filter narrowly di server (type +
   * process + created_at) then parse + compare in JS. Row set is bounded
   * (max 20) — safe untuk lightweight dedup.
   */
  async function recentLogs({ type, process: proc, windowSeconds }) {
    try {
      const cutoff = new Date(Date.now() - Number(windowSeconds || 0) * 1000).toISOString();
      const url = `/rest/v1/system_logs?type=eq.${encodeURIComponent(type)}&process=eq.${encodeURIComponent(proc)}&created_at=gte.${encodeURIComponent(cutoff)}&select=id,detail,created_at,status&order=created_at.desc&limit=20`;
      const rows = await sb(url);
      const parsed = [];
      for (const r of (rows || [])) {
        let detail = null;
        try { detail = r.detail ? JSON.parse(r.detail) : null; } catch (_) { detail = null; }
        parsed.push({ row: r, detail });
      }
      return { ok: true, rows: parsed };
    } catch (e) {
      console.warn('[system-log] recentLogs query failed:', e && e.message);
      return { ok: false, error: String(e && e.message || e).slice(0, 300), rows: [] };
    }
  }

  return { writeSystemLog, recentLogs, _internals: { safeDetailJson } };
};
