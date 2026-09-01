/**
 * SALDO ALERT ESCALATION (2026-09-01)
 *
 * Owner complaint: pengajuan isi saldo sering tidak terdengar. Audit
 * (docs/AUDIT_20260901.md) traced this to the browser's fire-and-forget
 * beep: even when it played, nothing wrote back "delivered/heard", so any
 * unheard request stayed pending forever with no escalation.
 *
 * Migration 20260901000000_raos_saldo_alert_ack.sql adds an ack log. This
 * file's saldoEscalationSweep() runs every 5 minutes (see installer
 * `installSaldoEscalationTrigger`) and, for any pending saldo request older
 * than 10 minutes with no ack from any admin device, queues a WhatsApp
 * notification via the existing raos_create_notification RPC (same channel
 * outbox.js uses on the Vercel side, so a single dedup_key path).
 *
 * Guards:
 *   - Only processes rows with status pending, is_processed=false,
 *     is_archived=false, and requested_at older than SALDO_ESCALATE_AFTER_MS.
 *   - Dedup key `saldo_esc_<request_id>` -- the raos_create_notification RPC
 *     de-dupes on that within 60 seconds, so a 5-min trigger firing every
 *     time won't spam.
 *   - _gasWithLock wraps the whole sweep (ScriptLock 10s) so overlapping
 *     runs coalesce.
 */

var SALDO_ESCALATE_AFTER_MS = 10 * 60 * 1000; // 10 minutes
var SALDO_ESCALATE_LOOKBACK_MS = 24 * 60 * 60 * 1000; // 24 hours -- don't try to re-notify old backlog forever

function saldoEscalationSweep() {
  return _gasWithLock(function () {
    var now = new Date();
    var cutoffUnheard = new Date(now.getTime() - SALDO_ESCALATE_AFTER_MS).toISOString();
    var cutoffLookback = new Date(now.getTime() - SALDO_ESCALATE_LOOKBACK_MS).toISOString();

    // Pending, unarchived, older than 10min, younger than 24h.
    var q = '/rest/v1/raos_saldo_requests'
      + '?select=id,request_no,branch_id,staff_id,driver_login_id,driver_name,nominal,requested_at,created_at'
      + '&is_processed=eq.false'
      + '&is_archived=eq.false'
      + '&status=eq.pending'
      + '&requested_at=lte.' + encodeURIComponent(cutoffUnheard)
      + '&requested_at=gte.' + encodeURIComponent(cutoffLookback)
      + '&order=requested_at.asc'
      + '&limit=100';
    var rows = _crmSbFetch_('GET', q);
    if (!Array.isArray(rows) || rows.length === 0) {
      return { success: true, escalated: 0, reason: 'no_pending_older_than_10m' };
    }

    // Filter out any request already ack'd by at least one admin device.
    // Two-step lookup (rather than a join) keeps the query on the REST API
    // without needing an RPC. Bulk fetch keeps this O(1) per sweep.
    var ids = rows.map(function (r) { return r.id; });
    var idFilter = ids.map(function (id) { return '"' + id + '"'; }).join(',');
    var acked = _crmSbFetch_('GET',
      '/rest/v1/raos_saldo_alert_ack?select=request_id&request_id=in.(' + idFilter + ')');
    var ackedSet = {};
    (acked || []).forEach(function (a) { ackedSet[a.request_id] = true; });
    var unheard = rows.filter(function (r) { return !ackedSet[r.id]; });
    if (unheard.length === 0) {
      return { success: true, escalated: 0, reason: 'all_acked' };
    }

    // Lookup branch names + staff names in bulk so the WA body reads well.
    var branchIds = _uniq_(unheard.map(function (r) { return r.branch_id; }).filter(Boolean));
    var staffIds  = _uniq_(unheard.map(function (r) { return r.staff_id;  }).filter(Boolean));
    var branches = branchIds.length
      ? _crmSbFetch_('GET', '/rest/v1/branches?select=id,name,slug&id=in.(' + _idFilter_(branchIds) + ')')
      : [];
    var staff    = staffIds.length
      ? _crmSbFetch_('GET', '/rest/v1/user_profiles?select=id,full_name,staff_id&id=in.(' + _idFilter_(staffIds) + ')')
      : [];
    var branchMap = {}; (branches || []).forEach(function (b) { branchMap[b.id] = b; });
    var staffMap  = {}; (staff    || []).forEach(function (s) { staffMap[s.id]  = s; });

    // Recipients: all active admin/direksi with a phone number.
    var admins = _crmSbFetch_('GET',
      '/rest/v1/user_profiles?select=id,full_name,phone&is_active=eq.true&role=in.(admin,direksi)');
    var recipientIds = (admins || []).map(function (u) { return u.id; }).filter(Boolean);
    if (recipientIds.length === 0) {
      _gasLogError('saldoEscalationSweep', 'no_admin_recipient', 'unheard=' + unheard.length);
      return { success: false, escalated: 0, reason: 'no_admin_recipient' };
    }

    var queued = 0;
    var errors = [];
    unheard.forEach(function (r) {
      try {
        var b = branchMap[r.branch_id] || {};
        var s = staffMap[r.staff_id] || {};
        var nominal = Number(r.nominal) || 0;
        var minutesLate = Math.round((now.getTime() - new Date(r.requested_at).getTime()) / 60000);
        var body = [
          'ESCALATION: pengajuan isi saldo belum di-ack ' + minutesLate + ' menit',
          'No: ' + (r.request_no || r.id),
          'Cabang: ' + (b.name || b.slug || '-'),
          'Staff: ' + (s.full_name || '-'),
          'Driver: ' + (r.driver_name || '-') + (r.driver_login_id ? ' (' + r.driver_login_id + ')' : ''),
          'Nominal: Rp ' + nominal.toLocaleString('id-ID'),
        ].join(' · ');

        _crmSbFetch_('POST', '/rest/v1/rpc/raos_create_notification', {
          p_user_ids: recipientIds,
          p_title: 'Isi Saldo belum di-ack',
          p_body: body,
          p_type: 'finance_saldo_escalation',
          p_payload_type: 'whatsapp_saldo',
          p_priority: 'high',
          p_channel: 'whatsapp',
          p_data: {
            request_id: r.id, request_no: r.request_no,
            branch_name: b.name || b.slug || null, staff_name: s.full_name || null,
            driver_name: r.driver_name, driver_login: r.driver_login_id,
            nominal: nominal, requested_at: r.requested_at,
            minutes_late: minutesLate,
          },
          p_dedup_key: 'saldo_esc_' + r.id,
          p_dedup_window_sec: 60,
        });
        queued++;
      } catch (e) {
        errors.push({ id: r.id, error: String(e && e.message || e) });
      }
    });

    if (errors.length) _gasLogError('saldoEscalationSweep', 'partial', JSON.stringify(errors).slice(0, 500));
    return { success: true, escalated: queued, unheard_count: unheard.length, errors: errors };
  }, 10000);
}

function _idFilter_(ids) {
  return ids.map(function (id) { return '"' + id + '"'; }).join(',');
}
function _uniq_(arr) {
  var seen = {}; var out = [];
  arr.forEach(function (x) { if (!seen[x]) { seen[x] = true; out.push(x); } });
  return out;
}

/**
 * Install the time-based trigger. Idempotent -- removes any existing trigger
 * for saldoEscalationSweep before creating a new one, so re-running is safe.
 * Run once from the GAS Editor after deploy.
 */
function installSaldoEscalationTrigger() {
  var existing = ScriptApp.getProjectTriggers();
  existing.forEach(function (t) {
    if (t.getHandlerFunction() === 'saldoEscalationSweep') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('saldoEscalationSweep')
    .timeBased()
    .everyMinutes(5)
    .create();
  return { success: true, message: 'saldoEscalationSweep trigger installed (every 5 minutes)' };
}
