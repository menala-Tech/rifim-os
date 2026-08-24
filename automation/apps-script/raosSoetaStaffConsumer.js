/**
 * RIFIM OS — SOETA staff master consumer from RAOS canonical table.
 *
 * Flow:
 *   1. RAOS migration raos_116 creates public.raos_staff_master.
 *   2. RAOS GAS 23_soeta_master_import.gs imports xlsx and links auth.
 *   3. RIFIM GAS reads public.raos_staff_master_hris view and upserts
 *      into employees for HRIS/Finance/Payroll consumption.
 *
 * Trigger: manual menu RIFIM → HRIS → 🔄 Sync SOETA Staff dari RAOS.
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

function _raosConsumerPatch_(url, data) {
  var cfg = _raosConsumerConfig_();
  var res = UrlFetchApp.fetch(url, {
    method:             'PATCH',
    headers:            _raosConsumerHeaders_(cfg, 'return=minimal'),
    payload:            JSON.stringify(data),
    muteHttpExceptions: true,
  });
  _raosConsumerCheck_(res, 'PATCH ' + url);
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
 * Sync activated SOETA staff from RAOS master into RIFIM employees.
 * Returns { upserted, skipped, errors }.
 */
function syncSoetaStaffFromRaosMaster() {
  var startTs = new Date();
  var warnings = [];

  // Read activated SOETA staff from the RAOS view.
  var url = _raosConsumerUrl_('raos_staff_master_hris', ['select=*', 'limit=5000']);
  var rows;
  try {
    rows = _raosConsumerGet_(url) || [];
  } catch (e) {
    throw new Error('Gagal membaca raos_staff_master_hris: ' + e.message);
  }

  // Fetch existing employees to avoid overwriting join_date.
  var existing = _raosConsumerGet_(_raosConsumerUrl_('employees', [
    'select=employee_id',
    'limit=5000'
  ])) || [];
  var existingById = {};
  existing.forEach(function(r) {
    if (r.employee_id) existingById[String(r.employee_id).toUpperCase()] = true;
  });

  var upserted = 0;
  var skipped = 0;
  var errors = [];
  var todayStr = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd');

  rows.forEach(function(r) {
    var empId = String(r.employee_id || '').toUpperCase().trim();
    if (!empId) { skipped++; return; }
    if (r.is_activated !== true) { skipped++; return; }

    var basePayload = {
      full_name:    r.full_name,
      email:        r.email || null,
      phone:        r.phone || null,
      branch:       r.branch,
      position:     r.position,
      status:       r.status,
      updated_at:   new Date().toISOString(),
    };

    try {
      if (existingById[empId]) {
        // Update only — do not touch join_date or company_code.
        _raosConsumerPatch_(
          _raosConsumerUrl_('employees', ['employee_id=eq.' + encodeURIComponent(empId)]),
          basePayload
        );
      } else {
        // New employee — set defaults for HRIS-managed fields.
        var insertPayload = Object.assign({}, basePayload, {
          employee_id:     empId,
          company_code:    'RIFIM',
          employment_type: 'PKWT',
          join_date:       todayStr,
          created_at:      new Date().toISOString(),
        });
        _raosConsumerPost_(_raosConsumerUrl_('employees', []), insertPayload);
      }
      upserted++;
    } catch (e) {
      errors.push({ employee_id: empId, error: e.message });
    }
  });

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
    var msg = '✅ Sync SOETA Staff dari RAOS selesai.\n\n' +
              'Upserted : ' + r.upserted + '\n' +
              'Skipped  : ' + r.skipped + '\n' +
              'Errors   : ' + r.errors.length + '\n' +
              'Durasi   : ' + r.duration_ms + ' ms';
    if (r.errors.length) {
      msg += '\n\nErrors (5 pertama):\n' + JSON.stringify(r.errors.slice(0, 5), null, 2);
    }
    SpreadsheetApp.getUi().alert(msg);
  } catch (e) {
    SpreadsheetApp.getUi().alert('❌ Sync SOETA Staff gagal:\n' + e.message);
    throw e;
  }
}
