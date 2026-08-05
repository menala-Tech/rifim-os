/**
 * RIFIM OS — HRIS Sync dari SSOT MASTER DATA STAFF → Supabase `employees`
 *
 * ARAH: Sheet SSOT (satu-arah) → Supabase.
 *
 * Sumber : Spreadsheet "DATABASE STAFF" (ID hardcoded di bawah), tab
 *          "MASTER DATA STAFF". Kolom relevan:
 *            A Email · B Nama · C Gaji Staff · D ID CABANG · E ID Staff
 *            F Jabatan · G No WA Staff · H Pin
 *
 * Target : Supabase table `employees` (dipakai UI HRIS `/hris`).
 *
 * Aturan mapping ke `employees`:
 *  • Baris BARU (ID Staff belum ada di Supabase):
 *      employee_id     = kolom E
 *      full_name       = kolom B
 *      email           = kolom A
 *      phone           = kolom G (dinormalisasi ke 62xxx)
 *      branch          = kolom D
 *      position        = kolom F
 *      salary_base     = kolom C
 *      pin             = kolom H
 *      company_code    = 'RIFIM'  (default; edit manual di HRIS untuk MIG/LAILAN)
 *      employment_type = 'PKWT'
 *      join_date       = today
 *      status          = 'AKTIF'
 *
 *  • Baris EXISTING (ID Staff sudah ada):
 *      full_name / email / phone / branch / position / salary_base / pin
 *      → refresh dari sheet.
 *      company_code / employment_type / join_date / department
 *      → JANGAN diubah (ini kolom yang di-manage HRIS admin).
 *      status → kalau baris HRIS `NONAKTIF/RESIGN/PHK` sebelumnya
 *      dan sekarang muncul lagi di sheet → set 'AKTIF'.
 *
 *  • Baris HILANG dari sheet SSOT (employee_id ada di Supabase tapi
 *    tidak ada di sheet lagi): set status='NONAKTIF' (soft-delete
 *    supaya FK ke tabel lain aman).
 *
 * NOTE: sheet SSOT tidak punya kolom `company_code` / `department` /
 * `join_date` / `employment_type` — kolom itu ADMIN-MANAGED di HRIS UI.
 * Jadi begitu staff baru di-sync, admin harus set company_code
 * (RIFIM/MIG/LAILAN) via HRIS `/hris` kalau bukan RIFIM.
 */

var MASTER_STAFF_SSOT_ID = '1fcraq3QHqIaD-13Ebzt6stT9aA6j_loTXeAtpNX12kw';
var MASTER_STAFF_TAB     = 'MASTER DATA STAFF';

// 0-based column index sheet SSOT
var _SSOT_COL = {
  EMAIL:    0,  // A
  NAMA:     1,  // B
  GAJI:     2,  // C
  CABANG:   3,  // D
  ID_STAFF: 4,  // E
  JABATAN:  5,  // F
  WA:       6,  // G
  PIN:      7,  // H
};

/**
 * Sync satu arah: MASTER DATA STAFF sheet → Supabase `employees`.
 * Return { upserted, deactivated, skipped, errors }.
 */
function syncEmployeesFromMasterStaff() {
  var startTs = new Date();
  var ss  = SpreadsheetApp.openById(MASTER_STAFF_SSOT_ID);
  var sh  = ss.getSheetByName(MASTER_STAFF_TAB);
  if (!sh) throw new Error('Tab "' + MASTER_STAFF_TAB + '" tidak ada di spreadsheet SSOT.');

  var lastRow = sh.getLastRow();
  if (lastRow < 2) {
    Logger.log('Sheet SSOT kosong.');
    return { upserted: 0, deactivated: 0, skipped: 0, errors: [] };
  }

  var range = sh.getRange(2, 1, lastRow - 1, 8).getValues();
  var sheetById = {};   // employee_id → row payload dari sheet
  var skipped = 0;
  var errors  = [];

  range.forEach(function(row, i) {
    var empId = String(row[_SSOT_COL.ID_STAFF] || '').trim().toUpperCase();
    var nama  = String(row[_SSOT_COL.NAMA]     || '').trim();
    if (!empId || !nama) { skipped++; return; }

    sheetById[empId] = {
      employee_id : empId,
      full_name   : nama,
      email       : String(row[_SSOT_COL.EMAIL]   || '').trim().toLowerCase() || null,
      phone       : _normalizePhone(row[_SSOT_COL.WA]),
      branch      : String(row[_SSOT_COL.CABANG]  || '').trim() || null,
      position    : String(row[_SSOT_COL.JABATAN] || '').trim() || null,
      salary_base : _parseSalary(row[_SSOT_COL.GAJI]),
      pin         : _normalizePin(row[_SSOT_COL.PIN]),
      _sheet_row  : i + 2,
    };
  });

  // Fetch semua existing employees dari Supabase (batch)
  var existing = _sbGet(_sbUrl('employees', [
    'select=employee_id,company_code,status',
    'limit=5000',
  ]));
  var existingById = {};
  existing.forEach(function(r) {
    existingById[String(r.employee_id || '').toUpperCase()] = r;
  });

  var upserted = 0, deactivated = 0;
  var todayStr = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd');

  // Upsert setiap baris sheet ke Supabase
  Object.keys(sheetById).forEach(function(empId) {
    var payload   = sheetById[empId];
    var sheetRow  = payload._sheet_row;
    delete payload._sheet_row;

    var current = existingById[empId];
    try {
      if (!current) {
        // INSERT baru
        payload.company_code    = 'RIFIM';
        payload.employment_type = 'PKWT';
        payload.join_date       = todayStr;
        payload.status          = 'AKTIF';
        payload.created_at      = new Date().toISOString();
        payload.updated_at      = payload.created_at;
        _sbPost('employees', payload);
      } else {
        // UPDATE — hanya field SSoT + reaktivasi kalau perlu
        var patch = {
          full_name  : payload.full_name,
          email      : payload.email,
          phone      : payload.phone,
          branch     : payload.branch,
          position   : payload.position,
          salary_base: payload.salary_base,
          pin        : payload.pin,
          updated_at : new Date().toISOString(),
        };
        // Reaktivasi kalau sebelumnya NONAKTIF/RESIGN/PHK
        var curStatus = String(current.status || '').toUpperCase();
        if (curStatus === 'NONAKTIF' || curStatus === 'RESIGN' || curStatus === 'PHK') {
          patch.status = 'AKTIF';
        }
        _sbPatch('employees', 'employee_id=eq.' + encodeURIComponent(empId), patch);
      }
      upserted++;
    } catch (err) {
      errors.push({ row: sheetRow, employee_id: empId, error: err.message });
    }
  });

  // Soft-delete: employees yang ada di Supabase tapi hilang dari sheet
  Object.keys(existingById).forEach(function(empId) {
    if (sheetById[empId]) return;
    var current = existingById[empId];
    if (String(current.status || '').toUpperCase() === 'NONAKTIF') return;

    try {
      _sbPatch('employees', 'employee_id=eq.' + encodeURIComponent(empId), {
        status     : 'NONAKTIF',
        updated_at : new Date().toISOString(),
      });
      deactivated++;
    } catch (err) {
      errors.push({ employee_id: empId, error: 'deactivate: ' + err.message });
    }
  });

  var summary = {
    upserted    : upserted,
    deactivated : deactivated,
    skipped     : skipped,
    errors      : errors,
    duration_ms : new Date().getTime() - startTs.getTime(),
  };
  Logger.log('syncEmployeesFromMasterStaff: ' + JSON.stringify(summary));
  return summary;
}

/**
 * Runner ramah UI — tampil alert hasil, dipanggil dari menu Sheets.
 */
function syncEmployeesFromMasterStaff_MENU() {
  try {
    var r = syncEmployeesFromMasterStaff();
    var msg = '✅ Sync selesai.\n\n' +
              'Upserted    : ' + r.upserted    + '\n' +
              'Deactivated : ' + r.deactivated + '\n' +
              'Skipped     : ' + r.skipped     + '\n' +
              'Errors      : ' + r.errors.length + '\n' +
              'Durasi      : ' + r.duration_ms + ' ms';
    if (r.errors.length) msg += '\n\nErrors:\n' + JSON.stringify(r.errors, null, 2).substring(0, 500);
    SpreadsheetApp.getUi().alert(msg);
  } catch (e) {
    SpreadsheetApp.getUi().alert('❌ Sync gagal:\n' + e.message);
    throw e;
  }
}

/**
 * Trigger auto-sync tiap 10 menit.
 * Hapus trigger lama dulu (idempotent).
 */
function setupEmployeesFromMasterStaffTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'syncEmployeesFromMasterStaff') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('syncEmployeesFromMasterStaff').timeBased().everyMinutes(10).create();
  Logger.log('✅ Trigger syncEmployeesFromMasterStaff tiap 10 menit terpasang.');
  try {
    SpreadsheetApp.getUi().alert('✅ Auto-sync HRIS Karyawan dari SSOT MASTER DATA STAFF aktif (tiap 10 menit).');
  } catch (e) {}
}

// ─── HELPERS ─────────────────────────────────────────────────────

/**
 * Normalisasi nomor WA ke format 62xxxxxxxx.
 * "62 895-0827-7445" → "62895082774450" (setelah strip non-digit).
 */
function _normalizePhone(raw) {
  if (raw === null || raw === undefined) return null;
  var s = String(raw).replace(/\D/g, '');
  if (!s) return null;
  if (s.charAt(0) === '0') s = '62' + s.substring(1);
  return s;
}

/**
 * Parse "Rp 1.700.000" / "1700000" / 1700000 → 1700000 (number).
 */
function _parseSalary(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'number') return raw;
  var s = String(raw).replace(/[^\d]/g, '');
  return s ? Number(s) : null;
}

/**
 * Normalisasi PIN: string digit-only atau null.
 */
function _normalizePin(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  var s = String(raw).replace(/\D/g, '');
  return s || null;
}
