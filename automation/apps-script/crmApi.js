/**
 * RIFIM OS — CRM API (sesi 2026-08-02)
 * Endpoint yang di-consume oleh modul CRM di `rifim-os.vercel.app/crm`.
 *
 * Cara install: file ini di-push via clasp bersama file .js lain.
 * TAMBAHKAN 3 baris ini di TOP of doGet(e) di webApp.js:
 *
 *   function doGet(e) {
 *     var crmResp = crmHandleGet(e);
 *     if (crmResp) return crmResp;
 *     // ... existing doGet logic
 *   }
 *
 * Semua endpoint return JSON: { success: bool, ... payload / message }
 * Wajib admin-only untuk write. Auth check via header X-Portal-User atau
 * query param ?user=<email>, dicocokkan ke company_config.allowed_emails
 * + role check via configLoader.
 */

// ═══════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════
var CRM_WRITE_ROLES = ['admin','management','direksi','direktur'];

// ═══════════════════════════════════════════════════════════════════════
// Dispatcher — dipanggil dari webApp.js doGet
// ═══════════════════════════════════════════════════════════════════════
function crmHandleGet(e) {
  var action = e && e.parameter && e.parameter.action;
  if (!action) return null;

  try {
    // ─── Company Config ──────────────────────────────────
    if (action === 'company_config_list')   return _crmJson({ success: true, config: _crmReadKV_('company_config') });
    if (action === 'company_config_set')    return _crmJson(_crmSetKV_('company_config', e.parameter));

    // ─── Whitelist Portal ────────────────────────────────
    if (action === 'whitelist_list')        return _crmJson({ success: true, whitelist: _crmWhitelistList_() });
    if (action === 'whitelist_add')         return _crmJson(_crmWhitelistMutate_('add',    e.parameter));
    if (action === 'whitelist_remove')      return _crmJson(_crmWhitelistMutate_('remove', e.parameter));
    if (action === 'whitelist_update')      return _crmJson(_crmWhitelistUpdate_(e.parameter));

    // ─── Audit log tail (dari SYSTEM_LOG sheet, cache 60s) ──
    if (action === 'crm_audit_tail')        return _crmJson({ success: true, logs: _crmAuditTail_(parseInt(e.parameter.limit) || 100) });

    return null; // bukan CRM action, delegate ke handler lain di doGet
  } catch (err) {
    return _crmJson({ success: false, message: 'CRM API error: ' + err.message });
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Company Config (sheet `company_config` di Smart Office DB)
// ═══════════════════════════════════════════════════════════════════════
function _crmReadKV_(sheetName) {
  var sh = SpreadsheetApp.getActive().getSheetByName(sheetName);
  if (!sh) throw new Error('Sheet ' + sheetName + ' tidak ditemukan');
  var data = sh.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < data.length; i++) {
    var key = String(data[i][0] || '').trim();
    if (!key) continue;
    out.push({ key: key, value: data[i][1], description: data[i][2] || '' });
  }
  return out;
}

function _crmSetKV_(sheetName, params) {
  _crmRequireAdmin_(params);
  var key = String(params.key || '').trim();
  var value = params.value == null ? '' : String(params.value);
  if (!key) return { success: false, message: 'Parameter key wajib' };

  var sh = SpreadsheetApp.getActive().getSheetByName(sheetName);
  if (!sh) return { success: false, message: 'Sheet ' + sheetName + ' tidak ditemukan' };

  var data = sh.getDataRange().getValues();
  var before = null;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === key) {
      before = data[i][1];
      sh.getRange(i + 1, 2).setValue(value);
      _crmAuditWrite_(params, before === null ? 'add' : 'edit', sheetName, key, before, value);
      return { success: true, key: key, value: value, before: before };
    }
  }
  // key baru — append row
  sh.appendRow([key, value, params.description || '']);
  _crmAuditWrite_(params, 'add', sheetName, key, null, value);
  return { success: true, key: key, value: value, before: null, appended: true };
}

// ═══════════════════════════════════════════════════════════════════════
// Whitelist Portal (dari company_config.allowed_emails, comma-separated)
// ═══════════════════════════════════════════════════════════════════════
function _crmWhitelistList_() {
  var cfg = getCompanyConfig();
  var raw = String(cfg.allowed_emails || '');
  return raw.split(',').map(function(e) { return e.trim().toLowerCase(); }).filter(Boolean);
}

function _crmWhitelistMutate_(op, params) {
  _crmRequireAdmin_(params);
  var email = String(params.email || '').trim().toLowerCase();
  if (!email || email.indexOf('@') === -1) return { success: false, message: 'Email invalid' };

  var current = _crmWhitelistList_();
  var before = current.slice();
  var next;

  if (op === 'add') {
    if (current.indexOf(email) !== -1) return { success: false, message: 'Email sudah di whitelist' };
    next = current.concat([email]);
  } else if (op === 'remove') {
    next = current.filter(function(e) { return e !== email; });
    if (next.length === current.length) return { success: false, message: 'Email tidak ada di whitelist' };
  } else {
    return { success: false, message: 'Unknown op' };
  }

  // Write balik ke company_config.allowed_emails
  var result = _crmSetKV_('company_config', {
    user:  params.user,
    key:   'allowed_emails',
    value: next.join(','),
    description: 'Comma-separated emails yang boleh login portal',
  });
  _crmAuditWrite_(params, op, 'whitelist', email, before.join(','), next.join(','));
  return { success: true, op: op, email: email, whitelist: next };
}

function _crmWhitelistUpdate_(params) {
  _crmRequireAdmin_(params);
  var oldEmail = String(params.email     || '').trim().toLowerCase();
  var newEmail = String(params.new_email || '').trim().toLowerCase();
  if (!oldEmail || oldEmail.indexOf('@') === -1) return { success: false, message: 'Email lama invalid' };
  if (!newEmail || newEmail.indexOf('@') === -1) return { success: false, message: 'Email baru invalid' };
  if (oldEmail === newEmail) return { success: false, message: 'Email lama dan baru sama' };

  var current = _crmWhitelistList_();
  var before  = current.slice();
  var idx     = current.indexOf(oldEmail);
  if (idx === -1) return { success: false, message: 'Email lama tidak ada di whitelist' };
  if (current.indexOf(newEmail) !== -1) return { success: false, message: 'Email baru sudah ada di whitelist' };

  var next = current.slice();
  next[idx] = newEmail;

  _crmSetKV_('company_config', {
    user:  params.user,
    key:   'allowed_emails',
    value: next.join(','),
    description: 'Comma-separated emails yang boleh login portal',
  });
  _crmAuditWrite_(params, 'update', 'whitelist', oldEmail + ' → ' + newEmail, before.join(','), next.join(','));
  return { success: true, op: 'update', email: oldEmail, new_email: newEmail, whitelist: next };
}

// ═══════════════════════════════════════════════════════════════════════
// Audit log — pakai sheet SYSTEM_LOG existing (kolom: timestamp, user, action, target, before, after)
// Kalau SYSTEM_LOG tidak ada, auto-create dengan header standar.
// ═══════════════════════════════════════════════════════════════════════
function _crmAuditWrite_(params, action, targetType, targetKey, before, after) {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName('CRM_AUDIT_LOG');
  if (!sh) {
    sh = ss.insertSheet('CRM_AUDIT_LOG');
    sh.appendRow(['timestamp','actor_email','action','target_type','target_key','before','after','ip','user_agent']);
    sh.setFrozenRows(1);
  }
  sh.appendRow([
    new Date(),
    String(params.user || 'unknown'),
    action,
    targetType,
    targetKey,
    before === null ? '' : String(before),
    after  === null ? '' : String(after),
    String(params.ip || ''),
    String(params.ua || ''),
  ]);
}

function _crmAuditTail_(limit) {
  var sh = SpreadsheetApp.getActive().getSheetByName('CRM_AUDIT_LOG');
  if (!sh) return [];
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return [];
  var start = Math.max(2, lastRow - limit + 1);
  var rows = sh.getRange(start, 1, lastRow - start + 1, 9).getValues();
  return rows.reverse().map(function(r) {
    return {
      timestamp: r[0], actor_email: r[1], action: r[2],
      target_type: r[3], target_key: r[4], before: r[5], after: r[6],
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════
// Role check — email harus ada di whitelist DAN role ∈ CRM_WRITE_ROLES
// ═══════════════════════════════════════════════════════════════════════
function _crmRequireAdmin_(params) {
  var email = String(params.user || '').toLowerCase().trim();
  if (!email) throw new Error('Parameter user (email) wajib untuk write action');

  var verified = authVerifyUser(email);
  if (!verified.success) throw new Error('Email ' + email + ' tidak diizinkan');

  var role = String(verified.user && verified.user.role || '').toLowerCase();
  if (CRM_WRITE_ROLES.indexOf(role) === -1) {
    throw new Error('Role ' + role + ' tidak boleh edit CRM (perlu admin/mgmt/direksi)');
  }
  return verified.user;
}

// ═══════════════════════════════════════════════════════════════════════
// JSON helper
// ═══════════════════════════════════════════════════════════════════════
function _crmJson(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
