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

    // ─── System Config RAOS: sheet sync only (Supabase mirror di frontend RPC)
    if (action === 'sistem_config_set')     return _crmJson(_crmSistemConfigSetSheet_(e.parameter));

    // ─── User Supabase RAOS proxy (bypass RLS via service_role, admin-only via GAS auth)
    if (action === 'raos_users_list')       return _crmJson(_crmRaosUsersList_(e.parameter));
    if (action === 'raos_users_update')     return _crmJson(_crmRaosUsersUpdate_(e.parameter));
    if (action === 'raos_users_reset_pin')  return _crmJson(_crmRaosUsersResetPin_(e.parameter));

    // ─── Portal PIN (raos_credentials): admin-only. `list` return map
    // {user_id: {has_pin, staff_code, updated_at}} untuk merge di UI.
    if (action === 'raos_credentials_list')       return _crmJson(_crmRaosCredentialsList_(e.parameter));
    if (action === 'raos_credentials_reset_pin')  return _crmJson(_crmRaosCredentialsResetPin_(e.parameter));
    // ─── SSOT PIN (kolom H sheet MASTER DATA STAFF) — edit langsung tanpa
    // buka spreadsheet. Sync harian propagate ke Supabase Auth password.
    if (action === 'raos_ssot_pin_update')        return _crmJson(_crmRaosSsotPinUpdate_(e.parameter));

    // ─── CRM Kontak Eksternal (tabel Supabase crm_contacts, service_role via GAS)
    if (action === 'contacts_list')         return _crmJson(_crmContactsList_(e.parameter));
    if (action === 'contacts_upsert')       return _crmJson(_crmContactsUpsert_(e.parameter));
    if (action === 'contacts_delete')       return _crmJson(_crmContactsDelete_(e.parameter));

    // ─── Finance module (spreadsheet 1AgpEqhpDU4B... — LIA master + Tagihan + per-cabang)
    if (action === 'finance_list')          return _crmJson(_finLedgerList_(e.parameter));
    if (action === 'finance_cabang_list')   return _crmJson(_finCabangList_(e.parameter));
    if (action === 'finance_tagihan_list')  return _crmJson(_finTagihanList_(e.parameter));
    if (action === 'finance_tagihan_add')   return _crmJson(_finTagihanAdd_(e.parameter));
    if (action === 'finance_tagihan_mark_paid') return _crmJson(_finTagihanMarkPaid_(e.parameter));
    if (action === 'finance_rekap_harian')  return _crmJson(_finRekapHarian_(e.parameter));
    if (action === 'finance_rekap_bulanan') return _crmJson(_finRekapBulanan_(e.parameter));
    if (action === 'finance_log_list')      return _crmJson(_finLogList_(e.parameter));
    if (action === 'finance_saldo_raos_list') return _crmJson(_finSaldoRaosList_(e.parameter));
    if (action === 'finance_saldo_raos_mark_paid') return _crmJson(_finSaldoRaosMarkPaid_(e.parameter));

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

// ═══════════════════════════════════════════════════════════════════════
// Supabase REST helpers — pakai service_role dari Script Properties
// (bypass RLS, jadi role check dilakukan di sisi GAS via _crmRequireAdmin_).
// _getSupabaseConfig() ada di hrisLayer.js.
// ═══════════════════════════════════════════════════════════════════════
function _crmSbFetch_(method, path, body) {
  var cfg = _getSupabaseConfig();
  var opts = {
    method: method,
    headers: {
      'apikey':        cfg.key,
      'Authorization': 'Bearer ' + cfg.key,
      'Content-Type':  'application/json',
      'Prefer':        'return=representation',
    },
    muteHttpExceptions: true,
  };
  if (body !== undefined && body !== null) opts.payload = JSON.stringify(body);
  var res = UrlFetchApp.fetch(cfg.url + path, opts);
  var code = res.getResponseCode();
  var txt  = res.getContentText();
  if (code >= 400) throw new Error('Supabase ' + method + ' ' + path + ' → ' + code + ': ' + txt.substring(0, 200));
  if (!txt) return null;
  try { return JSON.parse(txt); } catch (e) { return txt; }
}

// ═══════════════════════════════════════════════════════════════════════
// #3 System Config RAOS — sheet SISTEM CONFIG di RAOS master spreadsheet
// (Supabase mirror ditangani frontend via RPC set_system_config)
// ═══════════════════════════════════════════════════════════════════════
var RAOS_MASTER_SHEET_ID = '1eYS2mM3Sy-BNAVGfp8BUHtsZuLiGDetnJeGw-AWk__8';

function _crmSistemConfigSetSheet_(params) {
  _crmRequireAdmin_(params);
  var key   = String(params.key   || '').trim();
  var value = params.value == null ? '' : String(params.value);
  if (!key) return { success: false, message: 'Parameter key wajib' };

  try {
    var ss = SpreadsheetApp.openById(RAOS_MASTER_SHEET_ID);
    var sh = ss.getSheetByName('SISTEM CONFIG');
    if (!sh) return { success: false, message: 'Tab SISTEM CONFIG tidak ada di RAOS master' };
    var data = sh.getDataRange().getValues();
    var before = null;
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === key) {
        before = data[i][1];
        sh.getRange(i + 1, 2).setValue(value);
        _crmAuditWrite_(params, 'edit', 'sistem_config_sheet', key, before, value);
        return { success: true, key: key, value: value, before: before };
      }
    }
    sh.appendRow([key, value, '']);
    _crmAuditWrite_(params, 'add', 'sistem_config_sheet', key, null, value);
    return { success: true, key: key, value: value, appended: true };
  } catch (err) {
    return { success: false, message: 'Sheet write gagal: ' + err.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════
// #4 User Supabase RAOS — proxy ke Supabase (bypass RLS via service_role)
// ═══════════════════════════════════════════════════════════════════════
function _crmRaosUsersList_(params) {
  _crmRequireAdmin_(params);
  // Fetch user_profiles + email dari auth.users via paginate admin API
  var profiles = _crmSbFetch_('GET', '/rest/v1/user_profiles?select=id,staff_id,full_name,role,branch_id,is_active,phone,source,ssot_synced_at&order=full_name.asc');
  if (!Array.isArray(profiles)) profiles = [];

  // Ambil email map dari auth admin users (paginated)
  var emailMap = {};
  var page = 1, perPage = 200, maxPage = 10;
  while (page <= maxPage) {
    var res = _crmSbFetch_('GET', '/auth/v1/admin/users?page=' + page + '&per_page=' + perPage);
    var users = (res && res.users) || [];
    for (var i = 0; i < users.length; i++) emailMap[users[i].id] = users[i].email || '';
    if (users.length < perPage) break;
    page++;
  }

  // Ambil branch mapping (id → name)
  var branchMap = {};
  try {
    var branches = _crmSbFetch_('GET', '/rest/v1/branches?select=id,name,slug');
    if (Array.isArray(branches)) {
      for (var j = 0; j < branches.length; j++) branchMap[branches[j].id] = branches[j];
    }
  } catch (_) { /* branches optional */ }

  var out = profiles.map(function(p) {
    var b = p.branch_id ? branchMap[p.branch_id] : null;
    return {
      id:              p.id,
      email:           emailMap[p.id] || '',
      staff_id:        p.staff_id || '',
      full_name:       p.full_name || '',
      role:            p.role || '',
      is_active:       p.is_active,
      phone:           p.phone || '',
      source:          p.source || '',
      branch_id:       p.branch_id || null,
      branch_name:     b ? b.name : '',
      branch_slug:     b ? b.slug : '',
      ssot_synced_at:  p.ssot_synced_at || null,
    };
  });
  return { success: true, users: out, total: out.length };
}

function _crmRaosUsersUpdate_(params) {
  _crmRequireAdmin_(params);
  var id = String(params.id || '').trim();
  if (!id) return { success: false, message: 'Parameter id wajib' };

  var patch = {};
  if (params.role       !== undefined) patch.role       = String(params.role).toLowerCase();
  if (params.branch_id  !== undefined) patch.branch_id  = params.branch_id === 'null' || params.branch_id === '' ? null : params.branch_id;
  if (params.is_active  !== undefined) patch.is_active  = String(params.is_active) === 'true';
  if (params.full_name  !== undefined) patch.full_name  = String(params.full_name);
  if (params.phone      !== undefined) patch.phone      = String(params.phone);
  if (Object.keys(patch).length === 0) return { success: false, message: 'Tidak ada field yang di-update' };

  var before = _crmSbFetch_('GET', '/rest/v1/user_profiles?id=eq.' + encodeURIComponent(id) + '&select=*');
  if (!Array.isArray(before) || before.length === 0) return { success: false, message: 'User tidak ditemukan' };

  // Warn kalau source ssot_master_staff akan ter-overwrite di sync 1 jam
  var warn = null;
  if (String(before[0].source || '') === 'ssot_master_staff') {
    var protectedKeys = ['role','full_name','phone'];
    for (var k = 0; k < protectedKeys.length; k++) {
      if (patch[protectedKeys[k]] !== undefined) {
        warn = 'PERHATIAN: field ' + protectedKeys[k] + ' akan ter-overwrite sync SSOT 1 jam. Update juga di sheet MASTER DATA STAFF.';
        break;
      }
    }
  }

  var res = _crmSbFetch_('PATCH', '/rest/v1/user_profiles?id=eq.' + encodeURIComponent(id), patch);
  _crmAuditWrite_(params, 'edit', 'raos_user', id, JSON.stringify(before[0]).substring(0, 200), JSON.stringify(patch));
  var out = { success: true, user: (Array.isArray(res) && res[0]) || null };
  if (warn) out.warning = warn;
  return out;
}

function _crmRaosUsersResetPin_(params) {
  _crmRequireAdmin_(params);
  var id  = String(params.id || '').trim();
  var pin = String(params.pin || '').trim();
  if (!id) return { success: false, message: 'Parameter id wajib' };
  if (!/^\d{6,}$/.test(pin)) return { success: false, message: 'PIN harus minimal 6 digit angka' };

  var res = _crmSbFetch_('PUT', '/auth/v1/admin/users/' + encodeURIComponent(id), { password: pin });
  _crmAuditWrite_(params, 'reset_pin', 'raos_user', id, '', 'PIN direset (' + pin.length + ' digit)');
  return { success: true, id: id, email: (res && res.email) || '' };
}

// ═══════════════════════════════════════════════════════════════════════
// Portal PIN — tabel raos_credentials (PIN untuk login Portal Rifim OS,
// beda dari SSOT PIN yang jadi Supabase Auth password PWA RAOS).
// PIN plaintext untuk MVP; migrate ke bcrypt kalau sudah stabil.
// ═══════════════════════════════════════════════════════════════════════
function _crmRaosCredentialsList_(params) {
  _crmRequireAdmin_(params);
  var rows = _crmSbFetch_('GET', '/rest/v1/raos_credentials?select=user_id,raos_staff_code,updated_at,ssot_pin');
  if (!Array.isArray(rows)) rows = [];
  var out = {};
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    out[r.user_id] = {
      has_portal_pin:  true,          // NOT NULL di skema — kalau row ada, pasti punya PIN
      staff_code:      r.raos_staff_code || '',
      updated_at:      r.updated_at || null,
      has_ssot_pin:    !!r.ssot_pin,
    };
  }
  return { success: true, credentials: out, total: rows.length };
}

function _crmRaosCredentialsResetPin_(params) {
  _crmRequireAdmin_(params);
  var id  = String(params.id || '').trim();      // user_profiles.id (uuid)
  var pin = String(params.pin || '').trim();
  if (!id) return { success: false, message: 'Parameter id wajib' };
  if (!/^\d{6,}$/.test(pin)) return { success: false, message: 'PIN Portal harus minimal 6 digit angka' };

  // Upsert via PATCH kalau row ada, INSERT kalau tidak
  var existing = _crmSbFetch_('GET', '/rest/v1/raos_credentials?user_id=eq.' + encodeURIComponent(id) + '&select=user_id');
  var body = { raos_pin: pin, updated_at: new Date().toISOString() };
  if (Array.isArray(existing) && existing.length > 0) {
    _crmSbFetch_('PATCH', '/rest/v1/raos_credentials?user_id=eq.' + encodeURIComponent(id), body);
  } else {
    body.user_id = id;
    _crmSbFetch_('POST', '/rest/v1/raos_credentials', body);
  }
  _crmAuditWrite_(params, 'reset_portal_pin', 'raos_credentials', id, '', 'PIN Portal direset (' + pin.length + ' digit)');
  return { success: true, id: id };
}

// ═══════════════════════════════════════════════════════════════════════
// SSOT PIN update — edit kolom H (Pin) sheet MASTER DATA STAFF untuk staff
// tertentu (by ID Staff / RIF****). Sinkron ke Supabase Auth password
// terjadi di sync cycle berikutnya (max 6 jam) atau via Force Refresh
// Staff Auth di /sistem.
// Kolom sheet (0-based): E(4)=ID Staff · H(7)=Pin
// ═══════════════════════════════════════════════════════════════════════
var MASTER_STAFF_SHEET_ID = '1fcraq3QHqIaD-13Ebzt6stT9aA6j_loTXeAtpNX12kw';
var MASTER_STAFF_TAB_NAME = 'MASTER DATA STAFF';

function _crmRaosSsotPinUpdate_(params) {
  _crmRequireAdmin_(params);
  var staffCode = String(params.staff_id || '').trim();  // RIF****
  var pin       = String(params.pin || '').trim();
  if (!staffCode) return { success: false, message: 'Parameter staff_id wajib' };
  if (!/^\d{6,}$/.test(pin)) return { success: false, message: 'PIN SSOT harus minimal 6 digit angka' };

  try {
    var ss = SpreadsheetApp.openById(MASTER_STAFF_SHEET_ID);
    var sh = ss.getSheetByName(MASTER_STAFF_TAB_NAME);
    if (!sh) return { success: false, message: 'Tab "' + MASTER_STAFF_TAB_NAME + '" tidak ada' };

    var lastRow = sh.getLastRow();
    if (lastRow < 2) return { success: false, message: 'Sheet kosong' };

    // Cari row by kolom E (index 4 = kolom 5 di 1-based)
    var idCol = sh.getRange(2, 5, lastRow - 1, 1).getValues();
    var rowIndex = -1;
    for (var i = 0; i < idCol.length; i++) {
      if (String(idCol[i][0] || '').trim().toUpperCase() === staffCode.toUpperCase()) {
        rowIndex = i + 2;  // 1-based + skip header
        break;
      }
    }
    if (rowIndex === -1) return { success: false, message: 'ID Staff ' + staffCode + ' tidak ditemukan di sheet SSOT' };

    // Set kolom H (8 di 1-based)
    var pinCell = sh.getRange(rowIndex, 8);
    var before = pinCell.getValue();
    pinCell.setValue(pin);

    // Sync juga ke raos_credentials.ssot_pin supaya bridge login Portal langsung akurat
    // (raos_verify_and_bridge return message "sync ulang dari GAS" kalau ssot_pin NULL).
    // Optional: skip kalau raos_credentials row belum ada.
    try {
      // Lookup user_id dari user_profiles by staff_id
      var profiles = _crmSbFetch_('GET', '/rest/v1/user_profiles?staff_id=eq.' + encodeURIComponent(staffCode) + '&select=id');
      if (Array.isArray(profiles) && profiles.length > 0) {
        var uid = profiles[0].id;
        var existing = _crmSbFetch_('GET', '/rest/v1/raos_credentials?user_id=eq.' + encodeURIComponent(uid) + '&select=user_id');
        if (Array.isArray(existing) && existing.length > 0) {
          _crmSbFetch_('PATCH', '/rest/v1/raos_credentials?user_id=eq.' + encodeURIComponent(uid),
            { ssot_pin: pin, updated_at: new Date().toISOString() });
        }
      }
    } catch (_) { /* best effort, non-fatal */ }

    _crmAuditWrite_(params, 'update_ssot_pin', 'sheet_master_staff', staffCode,
      before ? '(hidden)' : '(empty)', 'PIN diupdate (' + pin.length + ' digit) row ' + rowIndex);
    return {
      success: true,
      staff_id: staffCode,
      row: rowIndex,
      note: 'PIN sheet SSOT diupdate. Supabase Auth password akan sync di cycle berikutnya (max 6 jam) atau klik "Force Refresh Staff Auth" di /sistem untuk propagate segera.'
    };
  } catch (err) {
    return { success: false, message: 'Sheet write gagal: ' + err.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════
// #5 CRM Kontak Eksternal — tabel Supabase crm_contacts
// ═══════════════════════════════════════════════════════════════════════
function _crmContactsList_(params) {
  _crmRequireAdmin_(params);
  var qs = 'select=*&order=updated_at.desc';
  if (params.category && params.category !== '') qs += '&category=eq.' + encodeURIComponent(params.category);
  if (params.search   && params.search   !== '') {
    // ilike di name/company/email
    var s = '%' + String(params.search).trim() + '%';
    qs += '&or=(name.ilike.' + encodeURIComponent(s) + ',company.ilike.' + encodeURIComponent(s) + ',email.ilike.' + encodeURIComponent(s) + ')';
  }
  var rows = _crmSbFetch_('GET', '/rest/v1/crm_contacts?' + qs);
  return { success: true, contacts: Array.isArray(rows) ? rows : [], total: Array.isArray(rows) ? rows.length : 0 };
}

function _crmContactsUpsert_(params) {
  _crmRequireAdmin_(params);
  var id = params.id ? String(params.id).trim() : '';

  // Sparse body — hanya include field yg explicit di params (mirror pattern
  // raos_users_update). Cegah PATCH tidak sengaja meng-nullify field yang
  // user tidak sentuh saat edit via API (mis. curl kirim id+name+notes saja).
  var body = {};
  if (params.name     !== undefined) body.name     = String(params.name).trim();
  if (params.email    !== undefined) body.email    = params.email    ? String(params.email).trim().toLowerCase() : null;
  if (params.phone    !== undefined) body.phone    = params.phone    ? String(params.phone).trim() : null;
  if (params.company  !== undefined) body.company  = params.company  ? String(params.company).trim() : null;
  if (params.category !== undefined) body.category = params.category ? String(params.category).trim() : 'lainnya';
  if (params.notes    !== undefined) body.notes    = params.notes    ? String(params.notes) : null;
  if (params.tags     !== undefined) body.tags     = String(params.tags).split(',').map(function(t) { return t.trim(); }).filter(Boolean);

  var res, action;
  if (id) {
    if (Object.keys(body).length === 0) return { success: false, message: 'Tidak ada field yang di-update' };
    res = _crmSbFetch_('PATCH', '/rest/v1/crm_contacts?id=eq.' + encodeURIComponent(id), body);
    action = 'edit';
  } else {
    // CREATE — nama wajib. created_by biarkan NULL (kolom uuid FK ke
    // user_profiles dari migration crm_066; GAS proxy pakai service_role
    // tidak punya lookup aktor-email → user_profiles.id). Aktor tetap
    // tercatat lengkap di CRM_AUDIT_LOG (sheet + audit table).
    if (!body.name) return { success: false, message: 'Nama wajib diisi' };
    res = _crmSbFetch_('POST', '/rest/v1/crm_contacts', body);
    action = 'add';
  }
  var row = Array.isArray(res) ? res[0] : res;
  _crmAuditWrite_(params, action, 'contact', (row && row.id) || id || name, id ? name : '', name);
  return { success: true, contact: row };
}

function _crmContactsDelete_(params) {
  _crmRequireAdmin_(params);
  var id = String(params.id || '').trim();
  if (!id) return { success: false, message: 'Parameter id wajib' };

  var before = _crmSbFetch_('GET', '/rest/v1/crm_contacts?id=eq.' + encodeURIComponent(id) + '&select=name');
  var name = (Array.isArray(before) && before[0] && before[0].name) || '';
  _crmSbFetch_('DELETE', '/rest/v1/crm_contacts?id=eq.' + encodeURIComponent(id));
  _crmAuditWrite_(params, 'remove', 'contact', id, name, '');
  return { success: true, id: id };
}

// ═══════════════════════════════════════════════════════════════════════
// FINANCE MODULE — 9 endpoint yg baca/tulis spreadsheet Finance RIFIM
// (1AgpEqhpDU4B..., sheet LIA/Tagihan/TABEL HARIAN/TABEL BULANAN/SYSTEM LOG
// + 10 tab per-cabang). Semua read+write pakai SpreadsheetApp.openById()
// dengan cache 60s untuk data set besar (LIA 470+ rows).
// ═══════════════════════════════════════════════════════════════════════
var FINANCE_SHEET_ID = '1AgpEqhpDU4BUxcN_i_jaF8Ccw6RwptV2TOJjyTCVPSo';
var FIN_CABANG_LIST = [
  'Operasional','ID Rifim Airport Batam','ID Rifim Airport Pekanbaru','ID Rifim Airport Manado',
  'ID Rifim Airport Balikpapan','ID Rifim Airport Jambi','ID Rifim Airport Makassar',
  'ID Rifim Batam','ID Rifim Jambi','ID Rifim Jambi Luar','ID Massage Batam/Jakarta',
];

function _finOpen_() { return SpreadsheetApp.openById(FINANCE_SHEET_ID); }

function _finRead_(sheetName, opts) {
  var ss = _finOpen_();
  var sh = ss.getSheetByName(sheetName);
  if (!sh) throw new Error('Tab "' + sheetName + '" tidak ada di Finance sheet');
  var last = sh.getLastRow();
  if (last < 2) return { headers: [], rows: [] };
  var lastCol = sh.getLastColumn();
  var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) { return String(h || '').trim(); });
  var rows = sh.getRange(2, 1, last - 1, lastCol).getValues();
  return { headers: headers, rows: rows };
}

function _finRowToObj_(headers, row) {
  var o = {};
  for (var i = 0; i < headers.length; i++) o[headers[i] || ('col' + i)] = row[i];
  return o;
}

function _finRoleGate_(params) {
  var email = String(params.user || '').toLowerCase().trim();
  if (!email) throw new Error('Parameter user (email) wajib');
  var verified = authVerifyUser(email);
  if (!verified.success) throw new Error('Email ' + email + ' tidak diizinkan');
  var role = String(verified.user && verified.user.role || '').toLowerCase();
  if (['admin','management','direksi','direktur'].indexOf(role) === -1) {
    throw new Error('Role ' + role + ' tidak boleh akses Finance (perlu admin/mgmt/direksi)');
  }
  return verified.user;
}

// ─── Dashboard: LIA master ledger, filter tanggal/jenis/cabang/search
function _finLedgerList_(params) {
  _finRoleGate_(params);
  var data = _finRead_('LIA');
  var from  = params.from ? new Date(params.from + 'T00:00:00+07:00').getTime() : 0;
  var to    = params.to   ? new Date(params.to   + 'T23:59:59+07:00').getTime() : Infinity;
  var jenis = String(params.jenis || '').toLowerCase();
  var cabang = String(params.cabang || '');
  var search = String(params.search || '').toLowerCase();

  var out = [];
  for (var i = 0; i < data.rows.length; i++) {
    var o = _finRowToObj_(data.headers, data.rows[i]);
    var ts = o.Timestamp ? new Date(o.Timestamp).getTime() : 0;
    if (ts < from || ts > to) continue;
    if (cabang && String(o.Cabang || '') !== cabang) continue;
    var isPemasukan = Number(o.Pemasukan) > 0;
    var isPengeluaran = Number(o.Pengeluaran) > 0;
    if (jenis === 'pemasukan' && !isPemasukan) continue;
    if (jenis === 'pengeluaran' && !isPengeluaran) continue;
    if (search) {
      var hay = (String(o.Keterangan || '') + ' ' + String(o['Nama Staff (Kasbon)'] || o['Nama Staff'] || '') + ' ' + String(o.Email || '')).toLowerCase();
      if (hay.indexOf(search) === -1) continue;
    }
    out.push({
      timestamp:  o.Timestamp,
      email:      o.Email,
      pemasukan:  Number(o.Pemasukan) || 0,
      pengeluaran:Number(o.Pengeluaran) || 0,
      cabang:     o.Cabang || '',
      keterangan: o.Keterangan || '',
      bukti_foto: o['Bukti Foto'] || '',
      nama_staff: o['Nama Staff (Kasbon)'] || o['Nama Staff'] || '',
    });
  }
  // Sort terbaru dulu
  out.sort(function(a, b) { return new Date(b.timestamp) - new Date(a.timestamp); });
  // Optional pagination
  var limit  = parseInt(params.limit)  || 200;
  var offset = parseInt(params.offset) || 0;
  return { success: true, total: out.length, rows: out.slice(offset, offset + limit) };
}

// ─── Cabang: sheet per cabang (nama tab = nama cabang persis)
function _finCabangList_(params) {
  _finRoleGate_(params);
  var sheet = String(params.sheet || '');
  if (!sheet) return { success: false, message: 'Parameter sheet (nama cabang) wajib' };
  var data = _finRead_(sheet);
  var search = String(params.search || '').toLowerCase();
  var out = [];
  var saldo = 0;
  for (var i = 0; i < data.rows.length; i++) {
    var o = _finRowToObj_(data.headers, data.rows[i]);
    var pemas = Number(o.Pemasukan) || 0;
    var penge = Number(o.Pengeluaran) || 0;
    saldo += pemas - penge;
    if (search) {
      var hay = (String(o.Keterangan || '') + ' ' + String(o['Nama Staff (Kasbon)'] || o['Nama Staff'] || '')).toLowerCase();
      if (hay.indexOf(search) === -1) continue;
    }
    out.push({
      timestamp:  o.Timestamp,
      pemasukan:  pemas,
      pengeluaran:penge,
      saldo:      saldo,
      keterangan: o.Keterangan || '',
      nama_staff: o['Nama Staff (Kasbon)'] || o['Nama Staff'] || '',
    });
  }
  out.reverse(); // terbaru dulu
  return { success: true, cabang: sheet, total: out.length, rows: out };
}

// ─── Tagihan
function _finTagihanList_(params) {
  _finRoleGate_(params);
  var data = _finRead_('Tagihan');
  var status = String(params.status || '').toLowerCase();
  var bulan  = String(params.bulan  || '');
  var search = String(params.search || '').toLowerCase();
  var out = [];
  for (var i = 0; i < data.rows.length; i++) {
    var o = _finRowToObj_(data.headers, data.rows[i]);
    var noTag = String(o['No Tagihan'] || o['No.Tagihan'] || '').trim();
    var instansi = String(o.Instansi || '').trim();
    if (!noTag && !instansi) continue;
    var tglBayar = o['Tanggal Bayar'] || o['Tgl Bayar'] || '';
    var jumlah = Number(o.Jumlah) || 0;
    var isPaid = !!tglBayar;
    var st = isPaid ? 'sudah_bayar' : 'belum_bayar';
    if (status === 'sudah_bayar' && !isPaid) continue;
    if (status === 'belum_bayar' && isPaid) continue;
    if (bulan && String(o.Bulan || '') !== bulan) continue;
    if (search) {
      var hay = (noTag + ' ' + instansi + ' ' + String(o.Jenis || '')).toLowerCase();
      if (hay.indexOf(search) === -1) continue;
    }
    out.push({
      row_index:  i + 2, // 1-index + header
      no_tagihan: noTag,
      instansi:   instansi,
      jenis:      o.Jenis || '',
      bulan:      o.Bulan || '',
      jumlah:     jumlah,
      no_rekening:o['No Rekening'] || o['No.Rekening'] || '',
      tgl_bayar:  tglBayar,
      status:     st,
    });
  }
  return { success: true, total: out.length, rows: out };
}

function _finTagihanAdd_(params) {
  _finRoleGate_(params);
  var body = {
    Jenis:        String(params.jenis || '').trim(),
    'No Tagihan': String(params.no_tagihan || '').trim(),
    Instansi:     String(params.instansi || '').trim(),
    Bulan:        String(params.bulan || '').trim(),
    Jumlah:       Number(params.jumlah) || 0,
    'No Rekening':String(params.no_rekening || '').trim(),
  };
  if (!body.Instansi || !body['No Tagihan']) return { success: false, message: 'no_tagihan + instansi wajib' };

  var ss = _finOpen_();
  var sh = ss.getSheetByName('New Tagihan') || ss.getSheetByName('Tagihan');
  if (!sh) return { success: false, message: 'Tab New Tagihan / Tagihan tidak ada' };
  var last = sh.getLastRow();
  var lastCol = sh.getLastColumn();
  var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) { return String(h || '').trim(); });
  var row = headers.map(function(h) { return body[h] !== undefined ? body[h] : ''; });
  sh.appendRow(row);
  _crmAuditWrite_(params, 'add', 'tagihan', body['No Tagihan'], null, body.Instansi + ' · ' + body.Jumlah);
  return { success: true, no_tagihan: body['No Tagihan'], row: last + 1 };
}

function _finTagihanMarkPaid_(params) {
  _finRoleGate_(params);
  var noTag = String(params.no_tagihan || '').trim();
  if (!noTag) return { success: false, message: 'Parameter no_tagihan wajib' };
  var tglBayar = String(params.tgl_bayar || Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd')).trim();

  var ss = _finOpen_();
  var sh = ss.getSheetByName('Tagihan');
  if (!sh) return { success: false, message: 'Tab Tagihan tidak ada' };
  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();
  var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) { return String(h || '').trim(); });
  var idxNo    = headers.indexOf('No Tagihan');    if (idxNo < 0) idxNo = headers.indexOf('No.Tagihan');
  var idxBayar = headers.indexOf('Tanggal Bayar'); if (idxBayar < 0) idxBayar = headers.indexOf('Tgl Bayar');
  if (idxNo < 0 || idxBayar < 0) return { success: false, message: 'Kolom No Tagihan / Tanggal Bayar tidak ditemukan' };
  var data = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][idxNo]).trim() === noTag) {
      sh.getRange(i + 2, idxBayar + 1).setValue(tglBayar);
      _crmAuditWrite_(params, 'mark_paid', 'tagihan', noTag, '', tglBayar);
      return { success: true, no_tagihan: noTag, tgl_bayar: tglBayar, row: i + 2 };
    }
  }
  return { success: false, message: 'No Tagihan ' + noTag + ' tidak ditemukan' };
}

// ─── Rekap (parse pivot tabel jadi array)
function _finRekapHarian_(params) {
  _finRoleGate_(params);
  var ss = _finOpen_();
  var sh = ss.getSheetByName('TABEL HARIAN');
  if (!sh) return { success: false, message: 'Tab TABEL HARIAN tidak ada' };
  var last = sh.getLastRow();
  var lastCol = sh.getLastColumn();
  var raw = sh.getRange(1, 1, last, lastCol).getValues();
  return { success: true, headers_row_1: raw[0], rows_from_2: raw.slice(1) };
}

function _finRekapBulanan_(params) {
  _finRoleGate_(params);
  var ss = _finOpen_();
  var sh = ss.getSheetByName('TABEL BULANAN');
  if (!sh) return { success: false, message: 'Tab TABEL BULANAN tidak ada' };
  var last = sh.getLastRow();
  var lastCol = sh.getLastColumn();
  var raw = sh.getRange(1, 1, last, lastCol).getValues();
  return { success: true, headers_row_1: raw[0], rows_from_2: raw.slice(1) };
}

// ─── System Log
function _finLogList_(params) {
  _finRoleGate_(params);
  var data = _finRead_('SYSTEM LOG');
  var status = String(params.status || '').toUpperCase();
  var search = String(params.search || '').toLowerCase();
  var limit  = parseInt(params.limit) || 200;

  var out = [];
  for (var i = data.rows.length - 1; i >= 0 && out.length < limit; i--) {
    var o = _finRowToObj_(data.headers, data.rows[i]);
    var st = String(o.Status || '').toUpperCase();
    if (status && st !== status) continue;
    if (search) {
      var hay = (String(o.Fungsi || '') + ' ' + String(o.Pesan || '')).toLowerCase();
      if (hay.indexOf(search) === -1) continue;
    }
    out.push({
      tanggal: o.Tanggal,
      jam:     o.Jam,
      fungsi:  o.Fungsi || '',
      status:  st,
      pesan:   o.Pesan || '',
    });
  }
  return { success: true, total: out.length, rows: out };
}

// ─── Saldo RAOS (proxy Supabase raos_saldo_requests, bypass RLS via service_role)
function _finSaldoRaosList_(params) {
  _finRoleGate_(params);
  var qs = 'select=id,staff_id,branch_id,nominal,status,is_processed,processed_at,processed_by,created_at&order=created_at.desc&limit=200';
  var status = String(params.status || '');
  var branchId = String(params.branch_id || '');
  if (status === 'pending')   qs += '&is_processed=eq.false&status=eq.pending';
  if (status === 'approved')  qs += '&is_processed=eq.false&status=eq.approved';
  if (status === 'paid')      qs += '&is_processed=eq.true';
  if (status === 'rejected')  qs += '&status=eq.rejected';
  if (branchId) qs += '&branch_id=eq.' + encodeURIComponent(branchId);

  var rows = _crmSbFetch_('GET', '/rest/v1/raos_saldo_requests?' + qs);
  if (!Array.isArray(rows)) rows = [];

  // Enrich dengan nama staff & driver & cabang
  var staffIds = {}, branchIds = {};
  rows.forEach(function(r) {
    if (r.staff_id)  staffIds[r.staff_id] = true;
    if (r.branch_id) branchIds[r.branch_id] = true;
  });
  var staffMap = {}, branchMap = {};
  if (Object.keys(staffIds).length) {
    var ids = Object.keys(staffIds).map(function(x) { return encodeURIComponent(x); }).join(',');
    try {
      var ss = _crmSbFetch_('GET', '/rest/v1/user_profiles?select=id,full_name,staff_id&id=in.(' + ids + ')');
      (ss || []).forEach(function(u) { staffMap[u.id] = u; });
    } catch (_) {}
  }
  if (Object.keys(branchIds).length) {
    var bids = Object.keys(branchIds).map(function(x) { return encodeURIComponent(x); }).join(',');
    try {
      var bb = _crmSbFetch_('GET', '/rest/v1/branches?select=id,name,slug&id=in.(' + bids + ')');
      (bb || []).forEach(function(b) { branchMap[b.id] = b; });
    } catch (_) {}
  }

  var out = rows.map(function(r) {
    var s = r.staff_id  ? staffMap[r.staff_id]  : null;
    var b = r.branch_id ? branchMap[r.branch_id]: null;
    return {
      id:            r.id,
      staff_name:    s ? s.full_name : '',
      staff_code:    s ? s.staff_id : '',
      branch_name:   b ? b.name : '',
      branch_slug:   b ? b.slug : '',
      nominal:       Number(r.nominal) || 0,
      status:        r.status,
      is_processed:  r.is_processed,
      processed_at:  r.processed_at,
      processed_by:  r.processed_by,
      created_at:    r.created_at,
    };
  });
  return { success: true, total: out.length, rows: out };
}

function _finSaldoRaosMarkPaid_(params) {
  _finRoleGate_(params);
  var id = String(params.id || '').trim();
  if (!id) return { success: false, message: 'Parameter id wajib' };
  var body = {
    is_processed: true,
    processed_at: new Date().toISOString(),
    processed_by: String(params.user || ''),
  };
  var res = _crmSbFetch_('PATCH', '/rest/v1/raos_saldo_requests?id=eq.' + encodeURIComponent(id), body);
  _crmAuditWrite_(params, 'mark_paid', 'saldo_raos', id, '', 'Lunas oleh ' + params.user);
  return { success: true, id: id, row: Array.isArray(res) ? res[0] : res };
}
