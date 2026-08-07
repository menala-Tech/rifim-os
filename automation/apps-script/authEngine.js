/**
 * RIFIM OS — Auth Engine
 * Phase 2 Engine: Authentication & Role-Based Access Control
 *
 * Role hierarchy: ADMIN > DIREKTUR > KOORDINATOR > STAFF > DRIVER
 */

var AUTH_ROLES = {
  ADMIN:       5,
  DIREKTUR:    4,
  KOORDINATOR: 3,
  STAFF:       2,
  DRIVER:      1,
};

var AUTH_PERMISSIONS = {
  'hris.read':          ['STAFF', 'KOORDINATOR', 'DIREKTUR', 'ADMIN'],
  'hris.write':         ['KOORDINATOR', 'DIREKTUR', 'ADMIN'],
  'hris.delete':        ['DIREKTUR', 'ADMIN'],
  'hris.approve_leave': ['KOORDINATOR', 'DIREKTUR', 'ADMIN'],
  'hris.payroll.read':  ['KOORDINATOR', 'DIREKTUR', 'ADMIN'],
  'hris.payroll.write': ['DIREKTUR', 'ADMIN'],
  'document.generate':  ['STAFF', 'KOORDINATOR', 'DIREKTUR', 'ADMIN'],
  'document.delete':    ['DIREKTUR', 'ADMIN'],
  'admin.users':        ['ADMIN'],
};

/**
 * Verifikasi user dan ambil profil (cek allowed_emails dulu, lalu Supabase).
 * @param {string} email
 * @returns {{ success, user: { email, full_name, role, company_code, is_active } }}
 */
function authVerifyUser(email) {
  if (!email) return { success: false, message: 'Email diperlukan.' };
  email = email.toLowerCase().trim();

  var config      = getCompanyConfig();
  var allowedList = _buildAllowedList(config);

  if (allowedList.indexOf(email) === -1) {
    return { success: false, message: 'Email tidak diizinkan.' };
  }

  try {
    var sbUser = _supabaseGetUser(email);
    if (sbUser && sbUser.is_active) {
      _supabaseUpdateLastLogin(sbUser.id);
      return {
        success: true,
        user: {
          email:        sbUser.email,
          full_name:    sbUser.full_name,
          role:         sbUser.role,
          company_code: sbUser.company_code,
          is_active:    sbUser.is_active,
        },
      };
    }
  } catch (e) {
    console.warn('AuthEngine Supabase unavailable, fail closed:', e.message);
    return { success: false, code: 'AUTH_BACKEND_UNAVAILABLE', message: 'Layanan autentikasi tidak tersedia.' };
  }

  return { success: false, code: 'PROFILE_NOT_FOUND', message: 'Profil user aktif tidak ditemukan.' };
}

/**
 * Validasi access token Supabase ke Auth server dan derive actor dari token.sub.
 * GAS Web App tidak mengekspos request Authorization header, sehingga caller
 * mengirim token di JSON POST body; token tidak boleh masuk query string/log.
 *
 * @param {string} accessToken
 * @returns {{success:boolean, code?:string, message?:string, user?:Object}}
 */
function authVerifyAccessToken(accessToken) {
  var token = String(accessToken || '').trim();
  if (!token) return { success: false, code: 'TOKEN_REQUIRED', message: 'Session token diperlukan.' };

  var cfg = _getSupabaseConfig();
  var authRes;
  try {
    authRes = UrlFetchApp.fetch(cfg.url + '/auth/v1/user', {
      method: 'GET',
      headers: {
        'apikey': cfg.key,
        'Authorization': 'Bearer ' + token,
      },
      muteHttpExceptions: true,
    });
  } catch (e) {
    return { success: false, code: 'AUTH_BACKEND_UNAVAILABLE', message: 'Layanan autentikasi tidak tersedia.' };
  }

  if (authRes.getResponseCode() !== 200) {
    return { success: false, code: 'TOKEN_INVALID', message: 'Session tidak valid atau kedaluwarsa.' };
  }

  var authUser;
  try { authUser = JSON.parse(authRes.getContentText()); }
  catch (_) { return { success: false, code: 'TOKEN_INVALID', message: 'Response autentikasi tidak valid.' }; }
  if (!authUser || !authUser.id) {
    return { success: false, code: 'TOKEN_INVALID', message: 'Token tidak memiliki subject.' };
  }

  var profileRes = UrlFetchApp.fetch(
    cfg.url + '/rest/v1/user_profiles?id=eq.' + encodeURIComponent(authUser.id) +
      '&select=id,email,full_name,role,branch_id,is_active&limit=1',
    {
      method: 'GET',
      headers: { 'apikey': cfg.key, 'Authorization': 'Bearer ' + cfg.key },
      muteHttpExceptions: true,
    }
  );
  if (profileRes.getResponseCode() !== 200) {
    return { success: false, code: 'PROFILE_LOOKUP_FAILED', message: 'Profil user gagal dibaca.' };
  }

  var profiles;
  try { profiles = JSON.parse(profileRes.getContentText()); }
  catch (_) { profiles = []; }
  var profile = profiles && profiles[0];
  if (!profile || !profile.is_active) {
    return { success: false, code: 'PROFILE_NOT_FOUND', message: 'Profil user aktif tidak ditemukan.' };
  }

  return {
    success: true,
    user: {
      id: profile.id,
      email: profile.email || authUser.email || '',
      full_name: profile.full_name || '',
      role: profile.role || '',
      branch_id: profile.branch_id || null,
      is_active: true,
    },
  };
}

/**
 * Cek apakah user punya permission tertentu.
 * @param {string} email
 * @param {string} permission - mis: 'hris.write'
 * @returns {boolean}
 */
function authHasPermission(email, permission) {
  var result = authVerifyUser(email);
  if (!result.success || !result.user.is_active) return false;
  var allowed = AUTH_PERMISSIONS[permission] || [];
  return allowed.indexOf(result.user.role) > -1;
}

/**
 * Tambah atau update user di tabel Supabase.
 * @param {{ email, full_name, role, company_code }} userData
 */
function authUpsertUser(userData) {
  var cfg = _getSupabaseConfig();
  var url = cfg.url + '/rest/v1/users?on_conflict=email';
  UrlFetchApp.fetch(url, {
    method:             'POST',
    headers:            {
      'apikey':       cfg.key,
      'Authorization': 'Bearer ' + cfg.key,
      'Content-Type': 'application/json',
      'Prefer':       'resolution=merge-duplicates',
    },
    payload:            JSON.stringify({
      email:        userData.email.toLowerCase().trim(),
      full_name:    userData.full_name,
      role:         userData.role        || 'STAFF',
      company_code: userData.company_code || 'RIFIM',
      is_active:    true,
      updated_at:   new Date().toISOString(),
    }),
    muteHttpExceptions: true,
  });
}

// ─── Private ────────────────────────────────────────────────────

// Hardcoded admin emails yang SELALU boleh akses portal — safety net
// supaya akun direksi utama tidak pernah ter-lockout meski sheet
// `company_config.allowed_emails` bermasalah / kosong.
// Sesi 2026-08-02: admin@menala.com adalah account direksi utama
// (rename dari rifiminternationalgemilang@gmail.com). Tetap listing
// email lama supaya session lama tidak putus.
var _EMERGENCY_ADMIN_EMAILS = [
  'admin@menala.com',
  'rifiminternationalgemilang@gmail.com',
];

function _buildAllowedList(config) {
  var list = [];
  if (config.company_email) list.push(config.company_email.toLowerCase().trim());
  if (config.allowed_emails) {
    config.allowed_emails.split(',').forEach(function(e) {
      var t = e.toLowerCase().trim();
      if (t) list.push(t);
    });
  }
  _EMERGENCY_ADMIN_EMAILS.forEach(function(e) {
    if (list.indexOf(e) === -1) list.push(e);
  });
  return list;
}

function _supabaseGetUser(email) {
  var cfg = _getSupabaseConfig();
  var url = cfg.url + '/rest/v1/users?email=eq.' + encodeURIComponent(email) + '&select=*&limit=1';
  var res = UrlFetchApp.fetch(url, {
    method:             'GET',
    headers:            { 'apikey': cfg.key, 'Authorization': 'Bearer ' + cfg.key },
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) return null;
  var rows = JSON.parse(res.getContentText());
  return rows.length > 0 ? rows[0] : null;
}

function _supabaseUpdateLastLogin(userId) {
  try {
    var cfg = _getSupabaseConfig();
    var url = cfg.url + '/rest/v1/users?id=eq.' + userId;
    UrlFetchApp.fetch(url, {
      method:             'PATCH',
      headers:            {
        'apikey':        cfg.key,
        'Authorization': 'Bearer ' + cfg.key,
        'Content-Type':  'application/json',
      },
      payload:            JSON.stringify({ last_login: new Date().toISOString() }),
      muteHttpExceptions: true,
    });
  } catch (e) { /* non-critical */ }
}
