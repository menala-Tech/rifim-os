/**
 * RIFIM OS — RAOS staff master consumer.
 *
 * Flow:
 *   1. RAOS migration raos_116 creates public.raos_staff_master.
 *   2. RAOS GAS imports XLSX and links auth.
 *   3. RIFIM GAS reads public.raos_staff_master_hris view and atomically
 *      upserts into employees for HRIS/Finance/Payroll consumption.
 *
 * Security:
 *   - raos_staff_master_hris is only accessible by service_role (RIFIM GAS).
 *   - View already filters is_activated = true; this consumer also re-checks.
 *
 * Sync strategy:
 *   - Single atomic POST per chunk using PostgREST upsert:
 *       POST /employees?on_conflict=employee_id
 *       Prefer: resolution=merge-duplicates,return=minimal
 *   - This makes repeated sync idempotent and avoids GET-then-POST race conditions.
 *
 * Trigger: manual menu RIFIM → HRIS → 🔄 Sync Staff dari RAOS.
 */

function _raosConsumerConfig_() {
  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty('SUPABASE_URL') || 'https://vlievtojpmrbsmzlqswl.supabase.co';
  var key = props.getProperty('SUPABASE_SERVICE_KEY') || '';
  if (!key) throw new Error('SUPABASE_SERVICE_KEY belum diatur di Script Properties.');
  return { url: url, key: key };
}

function _raosConsumerHeaders_(cfg, prefer) {
  var h = {
    'apikey':        cfg.key,
    'Authorization': 'Bearer ' + cfg.key,
    'Content-Type':  'application/json',
  };
  if (prefer) h['Prefer'] = prefer;
  return h;
}

function _raosConsumerGet_(url) {
  var cfg = _raosConsumerConfig_();
  var res = UrlFetchApp.fetch(url, {
    method:             'GET',
    headers:            _raosConsumerHeaders_(cfg),
    muteHttpExceptions: true,
  });
  _raosConsumerCheck_(res, 'GET ' + url);
  var text = res.getContentText();
  return text ? JSON.parse(text) : [];
}

function _raosConsumerPost_(url, data) {
  var cfg = _raosConsumerConfig_();
  var res = UrlFetchApp.fetch(url, {
    method:             'POST',
    headers:            _raosConsumerHeaders_(cfg, 'return=minimal'),
    payload:            JSON.stringify(data),
    muteHttpExceptions: true,
  });
  _raosConsumerCheck_(res, 'POST ' + url);
}

/**
 * Atomic upsert into employees using POST ... ON CONFLICT (employee_id).
 */
function _raosConsumerUpsert_(payload) {
  var cfg = _raosConsumerConfig_();
  var url = cfg.url + '/rest/v1/employees?on_conflict=employee_id';
  var res = UrlFetchApp.fetch(url, {
    method:             'POST',
    headers:            _raosConsumerHeaders_(cfg, 'resolution=merge-duplicates,return=minimal'),
    payload:            JSON.stringify(payload),
    muteHttpExceptions: true,
  });
  _raosConsumerCheck_(res, 'UPSERT employees (count=' + payload.length + ')');
}

function _raosConsumerCheck_(res, ctx) {
  if (res.getResponseCode() >= 400) {
    throw new Error(ctx + ' → HTTP ' + res.getResponseCode() + ': ' + res.getContentText());
  }
}

function _raosConsumerUrl_(table, params) {
  var cfg = _raosConsumerConfig_();
  return cfg.url + '/rest/v1/' + table + (params && params.length ? '?' + params.join('&') : '');
}

/**
 * Sync activated RAOS staff into RIFIM employees atomically.
 * Returns { upserted, skipped, errors }.
 */
function syncSoetaStaffFromRaosMaster() {
  var startTs = new Date();

  // Read activated staff from the RAOS view.
  var url = _raosConsumerUrl_('raos_staff_master_hris', ['select=*', 'limit=5000']);
  var rows;
  try {
    rows = _raosConsumerGet_(url) || [];
  } catch (e) {
    throw new Error('Gagal membaca raos_staff_master_hris: ' + e.message);
  }

  var upserted = 0;
  var skipped = 0;
  var errors = [];
  var todayStr = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd');
  var nowStr = new Date().toISOString();

  // Build payload for atomic upsert; only activated rows are included.
  var payload = [];
  rows.forEach(function(r) {
    var empId = String(r.employee_id || '').toUpperCase().trim();
    if (!empId) { skipped++; return; }
    if (r.is_activated !== true) { skipped++; return; }

    payload.push({
      employee_id:     empId,
      full_name:       r.full_name,
      email:           r.email || null,
      phone:           r.phone || null,
      branch:          r.branch,
      position:        r.position,
      status:          r.status,
      company_code:    'RIFIM',
      employment_type: 'PKWT',
      join_date:       todayStr,
      created_at:      nowStr,
      updated_at:      nowStr,
    });
  });

  // Send in chunks to stay within PostgREST payload limits.
  var chunkSize = 200;
  for (var i = 0; i < payload.length; i += chunkSize) {
    var chunk = payload.slice(i, i + chunkSize);
    try {
      _raosConsumerUpsert_(chunk);
      upserted += chunk.length;
    } catch (e) {
      errors.push({ chunk_start: i, error: e.message });
    }
  }

  var duration = new Date().getTime() - startTs.getTime();
  Logger.log('syncSoetaStaffFromRaosMaster: upserted=' + upserted + ' skipped=' + skipped + ' errors=' + errors.length + ' duration=' + duration + 'ms');

  return { upserted: upserted, skipped: skipped, errors: errors, duration_ms: duration };
}

/**
 * Menu wrapper for RIFIM HRIS.
 */
function syncSoetaStaffFromRaosMaster_MENU() {
  try {
    var r = syncSoetaStaffFromRaosMaster();
    var msg = '✅ Sync Staff dari RAOS selesai.\n\n' +
              'Upserted : ' + r.upserted + '\n' +
              'Skipped  : ' + r.skipped + '\n' +
              'Errors   : ' + r.errors.length + '\n' +
              'Durasi   : ' + r.duration_ms + ' ms';
    if (r.errors.length) {
      msg += '\n\nErrors (5 pertama):\n' + JSON.stringify(r.errors.slice(0, 5), null, 2);
    }
    SpreadsheetApp.getUi().alert(msg);
  } catch (e) {
    SpreadsheetApp.getUi().alert('❌ Sync Staff dari RAOS gagal:\n' + e.message);
    throw e;
  }
}
