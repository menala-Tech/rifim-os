'use strict';

// System / Error Alert dispatcher (Phase 6, 2026-08-31).
//
// Purpose:
//   Kirim WhatsApp alert HANYA untuk error operasional yang benar-benar
//   actionable (mis. AIST exhausted, Finance write hard failure setelah
//   retry, payroll compute hard failure, notification provider hard fail
//   setelah retry budget). Wajib deduplicated + cooldown.
//
// Consumers (call from anywhere in the codebase):
//   const alert = require('./notifications/error-alert')({sb});
//   await alert.emit({
//     severity: 'critical',
//     module:   'aist-runner',
//     event_code: 'aist_exhausted_retry',
//     message:  'AIST provider unreachable setelah 5x retry',
//     context:  { branch_id: 'b1', run_id: 'r123' },  // used for dedup key
//     correlation_id: 'req-abc',
//     retry_count: 5,
//     action:    'Cek koneksi AIST provider, restart runner kalau perlu',
//   });
//
// Do NOT create a new Vercel route for this. Always call internally.
//
// SAFETY / SANITY:
//   - info severity   : log only, TIDAK kirim WA
//   - warning         : eligible WA
//   - critical        : eligible WA
//   - FONNTE_ENABLED=false → return dispatch_disabled, no WA
//   - dedup: same (module + event_code + normalized_context) → max 1x per 10 menit
//   - secret redaction: strip authorization/apikey/token/service_role/password
//     dari context sebelum audit + WA compose
//
// DEDUP MECHANISM (Phase 6 remediation, 2026-08-31):
//   Canonical log sink adalah public.system_logs (bukan raos_ops_audit yang
//   TIDAK EXIST di Production per architect audit). Query system_logs
//   type='system_alert' process='${module}:${event_code}' created_at>=cutoff
//   → parse detail JSON → compare alert_key. Kalau match ditemukan → cooldown.
//   Kalau query gagal (DB down) → fail-open (dispatch), catat limitation ke
//   console. Deliberate: kritikal alert lebih baik double dari hilang.
//
// LIMITATION:
//   Vercel serverless stateless — 2 instance fire alert sama < 500ms bisa
//   lolos dedup. Konsekuensi = 2 WA identik (bukan alert storm).

const createFonnteWa = require('./fonnte-wa');
const createSystemLog = require('./system-log');
const crypto = require('crypto');

const SEVERITY_ELIGIBLE = new Set(['warning', 'critical']);
const COOLDOWN_SECONDS = 10 * 60;

// Fields yang boleh masuk ke context untuk audit + WA compose.
// Semua field lain → ignored (defense in depth vs accidental secret leak).
const CONTEXT_WHITELIST = new Set([
  'branch_id', 'branch_name', 'branch_code',
  'staff_id', 'user_id', 'actor_id',
  'run_id', 'job_id', 'request_id', 'correlation_id',
  'batch_id', 'cron_name', 'cron_id',
  'provider', 'endpoint_name', 'http_status',
  'retry_count', 'retry_budget',
  'error_class', 'error_code',
]);

// Kata kunci yang MEMBLOKIR alert kalau muncul di message/context values.
// Prevent accidental secret leak.
const SECRET_PATTERNS = [
  /bearer\s+ey[JI]/i,          // JWT bearer token
  /sb_secret_[A-Za-z0-9_-]{10,}/,  // Supabase service role secret
  /eyJ[A-Za-z0-9_-]{20,}\./,      // JWT payload
  /apikey["\s:=]+[A-Za-z0-9_-]{20,}/i,
  /password["\s:=]+\S{4,}/i,
  /authorization["\s:=]+\S{10,}/i,
];

function redactString(s) {
  if (s == null) return s;
  let out = String(s);
  for (const rx of SECRET_PATTERNS) out = out.replace(rx, '[REDACTED]');
  return out;
}

function safeContext(ctx) {
  const clean = {};
  if (!ctx || typeof ctx !== 'object') return clean;
  // Sort keys for deterministic hash regardless of caller insertion order.
  const sortedKeys = Object.keys(ctx).sort();
  for (const k of sortedKeys) {
    if (!CONTEXT_WHITELIST.has(k)) continue;
    const v = ctx[k];
    if (v == null) continue;
    if (typeof v === 'object') continue;  // no nested objects
    clean[k] = redactString(String(v)).slice(0, 200);
  }
  return clean;
}

function computeAlertKey({ module: mod, event_code, context }) {
  const norm = JSON.stringify({
    m: String(mod || '').trim(),
    e: String(event_code || '').trim(),
    c: safeContext(context),
  });
  return crypto.createHash('sha256').update(norm).digest('hex');
}

function wibNow() {
  // WIB = UTC+7. Manual offset to keep test-friendly (no tz lib).
  const d = new Date();
  const wibMs = d.getTime() + (7 * 60 * 60 * 1000);
  return new Date(wibMs).toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' WIB');
}

function composeMessage({ severity, module: mod, event_code, message, correlation_id, retry_count, action, context }) {
  const env = String(process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown').toLowerCase();
  const cleanCtx = safeContext(context);
  const lines = [
    '🚨 *RIFIM OS SYSTEM ALERT*',
    '',
    `Severity: *${String(severity || 'critical').toUpperCase()}*`,
    `Module: ${mod || '-'}`,
    `Event: ${event_code || '-'}`,
    `Env: ${env}`,
    `Waktu: ${wibNow()}`,
  ];
  if (correlation_id) lines.push(`Correlation: ${String(correlation_id).slice(0, 80)}`);
  if (typeof retry_count === 'number' && retry_count > 0) lines.push(`Retry: ${retry_count}`);
  lines.push('');
  lines.push(redactString(String(message || '')).slice(0, 500));
  if (Object.keys(cleanCtx).length) {
    lines.push('');
    lines.push('Context: ' + Object.entries(cleanCtx).map(([k, v]) => `${k}=${v}`).join(' · '));
  }
  if (action) {
    lines.push('');
    lines.push(`👉 ${redactString(String(action)).slice(0, 300)}`);
  }
  return lines.join('\n');
}

module.exports = function createErrorAlert(deps) {
  if (!deps || typeof deps.sb !== 'function') throw new Error('error-alert: missing sb dependency');
  const { sb } = deps;
  const fonnte = createFonnteWa();
  const sysLog = createSystemLog({ sb });

  function processId(mod, ev) {
    return `${String(mod || 'unknown').slice(0, 80)}:${String(ev || 'unknown').slice(0, 100)}`;
  }

  /**
   * Cek apakah alert dengan alert_key ini sudah pernah dikirim dalam 10 menit terakhir.
   * Query public.system_logs (canonical sink) filtered by type+process+time,
   * parse detail JSON server-side, compare alert_key.
   * Fail-open: kalau query error, return false (kirim, karena kritikal > dedup perfect).
   */
  async function isCooldownActive({ alertKey, module: mod, event_code }) {
    const proc = processId(mod, event_code);
    const res = await sysLog.recentLogs({ type: 'system_alert', process: proc, windowSeconds: COOLDOWN_SECONDS });
    if (!res.ok) return false;  // fail-open
    for (const r of (res.rows || [])) {
      if (r.detail && r.detail.alert_key === alertKey) return true;
    }
    return false;
  }

  async function auditAlert({ alertKey, severity, module: mod, event_code, dispatched, recipient_count, reason, correlation_id }) {
    const proc = processId(mod, event_code);
    let status;
    if (dispatched) status = 'dispatched';
    else if (reason === 'cooldown') status = 'cooldown';
    else if (reason === 'dispatch_disabled') status = 'dispatch_disabled';
    else if (reason === 'provider_not_configured') status = 'dispatch_disabled';
    else if (reason) status = 'provider_failed';
    else status = 'internal_error';

    await sysLog.writeSystemLog({
      type: 'system_alert',
      process: proc,
      status,
      detail: {
        alert_key: alertKey,
        severity,
        module: mod,
        event_code,
        recipient_count: recipient_count || 0,
        reason: reason || null,
        correlation_id: correlation_id || null,
      },
    });
  }

  /**
   * Main entry — emit an alert. Best-effort; NEVER throws.
   * @returns {Promise<{sent: boolean, reason?: string, alert_key: string}>}
   */
  async function emit(input) {
    try {
      const severity = String(input && input.severity || 'critical').toLowerCase();
      const mod = String(input && input.module || 'unknown');
      const event_code = String(input && input.event_code || 'unknown');
      const alertKey = computeAlertKey({ module: mod, event_code, context: input && input.context });

      // Info severity → log only, no WA, no audit noise
      if (severity === 'info') {
        return { sent: false, reason: 'info_not_dispatched', alert_key: alertKey };
      }
      if (!SEVERITY_ELIGIBLE.has(severity)) {
        return { sent: false, reason: 'invalid_severity', alert_key: alertKey };
      }

      // Cooldown
      if (await isCooldownActive({ alertKey, module: mod, event_code })) {
        await auditAlert({ alertKey, severity, module: mod, event_code, dispatched: false, reason: 'cooldown' });
        return { sent: false, reason: 'cooldown', alert_key: alertKey };
      }

      // Dispatch WA via shared fonnte-wa helper
      const phones = fonnte.getAdminPhonesFromEnv();
      const message = composeMessage({ severity, module: mod, event_code, message: input && input.message, correlation_id: input && input.correlation_id, retry_count: input && input.retry_count, action: input && input.action, context: input && input.context });

      const waResult = await fonnte.send({ phones, message, tag: 'system_alert' });

      await auditAlert({
        alertKey, severity, module: mod, event_code,
        dispatched: waResult.ok,
        recipient_count: waResult.sent,
        reason: waResult.reason || null,
        correlation_id: input && input.correlation_id,
      });

      return { sent: waResult.ok, reason: waResult.reason || null, alert_key: alertKey, recipient_count: waResult.sent };
    } catch (e) {
      // NEVER let alert failure propagate to business flow
      console.error('[error-alert] emit failed:', e && e.stack || e);
      return { sent: false, reason: 'internal_error', alert_key: null };
    }
  }

  return { emit, _internals: { computeAlertKey, redactString, safeContext, composeMessage } };
};
