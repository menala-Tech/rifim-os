/**
 * RIFIM OS — HRIS Sync Layer
 * Sinkronisasi data karyawan dari Supabase → Google Spreadsheet.
 * Sheet 'employees' dipakai Smart Office sebagai referensi data karyawan.
 */

var EMPLOYEES_SHEET_NAME   = 'employees';
var DATABASE_STAFF_NAME    = 'Database Staff';
var INPUT_STAFF_SHEET_NAME = 'Input Staff';

// Kolom Database Staff (dari screenshot: ID Staff, Nama, Jabatan, ID Cabang,
//                       Nama Cabang, Gaji Pokok, No WA Staff, Email, Pin)
var _STAFF_DB_HEADERS = [
  'ID Staff', 'Nama', 'Jabatan', 'ID Cabang',
  'Nama Cabang', 'Gaji Pokok', 'No WA Staff', 'Email', 'Pin', 'Status',
];

// Kolom Input Staff (form input admin)
var _STAFF_INPUT_COL = {
  EMPLOYEE_ID  : 1,  // A
  FULL_NAME    : 2,  // B
  JABATAN      : 3,  // C
  DEPARTMENT   : 4,  // D
  BRANCH       : 5,  // E
  COMPANY_CODE : 6,  // F
  EMP_TYPE     : 7,  // G — PKWT/PKWTT
  JOIN_DATE    : 8,  // H
  SALARY       : 9,  // I
  PHONE        : 10, // J
  EMAIL        : 11, // K
  PIN          : 12, // L
  STATUS       : 13, // M
  AKSI         : 14, // N — hasil: OK / ERROR
};

var EMPLOYEES_HEADERS = [
  'employee_id', 'full_name', 'email', 'phone',
  'company_code', 'employment_type', 'position',
  'department', 'branch', 'join_date', 'end_date',
  'salary_base', 'status', 'updated_at',
];

/**
 * Jalankan sekali di GAS Editor untuk membuat/mereset sheet employees.
 * Aman dijalankan berulang — hanya buat jika belum ada.
 */
function setupEmployeesSheet() {
  var ss    = _getDB();
  var sheet = ss.getSheetByName(EMPLOYEES_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(EMPLOYEES_SHEET_NAME);
    Logger.log('Sheet employees dibuat.');
  } else {
    sheet.clearContents();
    Logger.log('Sheet employees direset.');
  }
  sheet.getRange(1, 1, 1, EMPLOYEES_HEADERS.length).setValues([EMPLOYEES_HEADERS]);
  sheet.setFrozenRows(1);
  Logger.log('Setup sheet employees selesai.');
}

/**
 * Sinkronisasi semua karyawan dari Supabase ke sheet employees.
 * Dipanggil otomatis setelah add/update/resign karyawan.
 * @returns {{ synced: number }}
 */
function syncHrisEmployeesToSheet() {
  var employees = hrisGetEmployees({ limit: 1000 });
  var ss        = _getDB();
  var sheet     = ss.getSheetByName(EMPLOYEES_SHEET_NAME);
  if (!sheet) {
    setupEmployeesSheet();
    sheet = ss.getSheetByName(EMPLOYEES_SHEET_NAME);
  }

  // Hapus data lama (baris 2 dst), biarkan header
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, EMPLOYEES_HEADERS.length).clearContent();
  }

  if (!employees || employees.length === 0) return { synced: 0 };

  var rows = employees.map(function(emp) {
    return EMPLOYEES_HEADERS.map(function(col) {
      var val = emp[col];
      return (val === null || val === undefined) ? '' : String(val);
    });
  });

  sheet.getRange(2, 1, rows.length, EMPLOYEES_HEADERS.length).setValues(rows);
  Logger.log('Sync selesai: ' + rows.length + ' karyawan.');
  return { synced: rows.length };
}

// ══════════════════════════════════════════════════════════════════════════════
// SYNC: Supabase employees → Database Staff sheet (format operasional RAOS)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Sync Supabase employees → sheet "Database Staff".
 * Sheet ini dibaca RAOS, Finance, Payroll untuk data staff operasional.
 * Dipanggil setelah tambah/edit/resign staff, atau via trigger terjadwal.
 */
function syncStaffKeDatabaseStaff() {
  var employees = hrisGetEmployees({ limit: 500 });
  var ss        = _getDB();
  var sheet     = ss.getSheetByName(DATABASE_STAFF_NAME);

  if (!sheet) {
    SpreadsheetApp.getUi().alert(
      'Sheet "' + DATABASE_STAFF_NAME + '" belum ada.\n' +
      'Jalankan Setup → Setup Sheet Database Staff terlebih dahulu.');
    return;
  }

  // Hapus data lama (baris 3+), biarkan header baris 1 + note baris 2
  var lastRow = sheet.getLastRow();
  if (lastRow >= 3) sheet.getRange(3, 1, lastRow - 2, _STAFF_DB_HEADERS.length).clearContent();

  if (!employees || employees.length === 0) {
    Logger.log('Sync Database Staff: tidak ada data.');
    return;
  }

  var rows = employees.map(function(emp) {
    return [
      emp.employee_id      || '',
      emp.full_name        || '',
      emp.position         || '',
      emp.branch           || '',   // ID Cabang
      emp.branch           || '',   // Nama Cabang (sama, bisa di-override)
      emp.salary_base      || 0,
      emp.phone            || '',
      emp.email            || '',
      emp.pin              || '',   // dari Supabase jika ada kolom pin
      emp.status           || '',
    ];
  });

  sheet.getRange(3, 1, rows.length, _STAFF_DB_HEADERS.length).setValues(rows);
  Logger.log('✅ Database Staff: ' + rows.length + ' staff tersync.');
  try {
    SpreadsheetApp.getUi().alert('✅ Sync Database Staff selesai: ' + rows.length + ' staff.');
  } catch(e) {}
}

/**
 * Setup sheet Database Staff (header + format).
 * Panggil sekali dari menu Setup.
 */
function setupDatabaseStaffSheet() {
  var ss    = _getDB();
  var sheet = ss.getSheetByName(DATABASE_STAFF_NAME);
  if (!sheet) sheet = ss.insertSheet(DATABASE_STAFF_NAME);
  else { sheet.clearContents(); sheet.clearFormats(); }

  // Baris 1: header
  sheet.getRange(1, 1, 1, _STAFF_DB_HEADERS.length)
    .setValues([_STAFF_DB_HEADERS])
    .setBackground('#1155CC').setFontColor('#FFFFFF')
    .setFontWeight('bold').setHorizontalAlignment('center');

  // Baris 2: note
  sheet.getRange('A2').setValue('SSoT data staff — sync dari Supabase employees. Jangan edit manual.')
    .setFontStyle('italic').setFontColor('#666666');
  sheet.getRange(2, 1, 1, _STAFF_DB_HEADERS.length).merge();

  sheet.setFrozenRows(2);
  sheet.setColumnWidth(1, 90);   // ID Staff
  sheet.setColumnWidth(2, 180);  // Nama
  sheet.setColumnWidth(3, 160);  // Jabatan
  sheet.setColumnWidth(4, 220);  // ID Cabang
  sheet.setColumnWidth(5, 180);  // Nama Cabang
  sheet.setColumnWidth(6, 120);  // Gaji Pokok
  sheet.setColumnWidth(7, 130);  // No WA
  sheet.setColumnWidth(8, 200);  // Email
  sheet.setColumnWidth(9, 80);   // Pin
  sheet.setColumnWidth(10, 90);  // Status

  Logger.log('✅ Sheet Database Staff siap.');
  try { SpreadsheetApp.getUi().alert('✅ Sheet "Database Staff" siap!'); } catch(e) {}
}

// ══════════════════════════════════════════════════════════════════════════════
// INPUT STAFF — Form input untuk tambah/edit karyawan dari GAS
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Setup sheet "Input Staff" — form input admin untuk tambah karyawan baru.
 */
function setupInputStaffSheet() {
  var ss    = _getDB();
  var sheet = ss.getSheetByName(INPUT_STAFF_SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(INPUT_STAFF_SHEET_NAME);
  else { sheet.clearContents(); sheet.clearFormats(); }

  var headers = [
    'Employee ID', 'Nama Lengkap', 'Jabatan', 'Department',
    'ID Cabang', 'Kode Perusahaan', 'Tipe Kontrak', 'Tanggal Masuk',
    'Gaji Pokok', 'No WA / HP', 'Email', 'PIN (4 digit)', 'Status', 'Hasil',
  ];

  // Header baris 1
  sheet.getRange(1, 1, 1, headers.length)
    .setValues([headers])
    .setBackground('#1155CC').setFontColor('#FFFFFF')
    .setFontWeight('bold').setHorizontalAlignment('center');

  // Baris 2: instruksi
  sheet.getRange('A2').setValue(
    'Isi data karyawan baru per baris → klik menu RIFIM OS → HRIS → Proses Input Staff'
  ).setFontStyle('italic').setFontColor('#666666');
  sheet.getRange(2, 1, 1, headers.length).merge();

  // Dropdown ID Cabang
  var cabangRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(RIFIM_BRANCHES, true).setAllowInvalid(false).build();
  sheet.getRange(3, _STAFF_INPUT_COL.BRANCH, 200, 1).setDataValidation(cabangRule);

  // Dropdown Kode Perusahaan
  var companyRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['RIFIM', 'MENALA', 'LAILAN'], true).setAllowInvalid(false).build();
  sheet.getRange(3, _STAFF_INPUT_COL.COMPANY_CODE, 200, 1).setDataValidation(companyRule);

  // Dropdown Tipe Kontrak
  var kontrakRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['PKWT', 'PKWTT', 'MAGANG', 'FREELANCE'], true).setAllowInvalid(false).build();
  sheet.getRange(3, _STAFF_INPUT_COL.EMP_TYPE, 200, 1).setDataValidation(kontrakRule);

  // Dropdown Status
  var statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['AKTIF', 'NONAKTIF', 'RESIGN', 'PHK'], true).setAllowInvalid(false).build();
  sheet.getRange(3, _STAFF_INPUT_COL.STATUS, 200, 1).setDataValidation(statusRule);

  // Format kolom tanggal
  sheet.getRange(3, _STAFF_INPUT_COL.JOIN_DATE, 200, 1).setNumberFormat('dd/MM/yyyy');

  // Lebar kolom
  [90,180,150,130,220,130,110,110,120,130,200,100,100,200].forEach(function(w, i) {
    sheet.setColumnWidth(i + 1, w);
  });

  sheet.setFrozenRows(2);
  Logger.log('✅ Sheet Input Staff siap.');
  try { SpreadsheetApp.getUi().alert('✅ Sheet "Input Staff" siap!'); } catch(e) {}
}

/**
 * Proses baris di sheet Input Staff → Supabase → sync ke sheet employees + Database Staff.
 */
function prosesInputStaff() {
  var ss    = _getDB();
  var sheet = ss.getSheetByName(INPUT_STAFF_SHEET_NAME);
  if (!sheet) {
    SpreadsheetApp.getUi().alert('Sheet "Input Staff" tidak ditemukan.');
    return;
  }

  var lastRow = sheet.getLastRow();
  var sukses = 0, skip = 0, gagal = 0;

  for (var r = 3; r <= lastRow; r++) {
    var nama = sheet.getRange(r, _STAFF_INPUT_COL.FULL_NAME).getValue().toString().trim();
    if (!nama) continue;

    var aksiSel = sheet.getRange(r, _STAFF_INPUT_COL.AKSI);
    if (aksiSel.getValue().toString().trim().toUpperCase() === 'OK') { skip++; continue; }

    var empId   = sheet.getRange(r, _STAFF_INPUT_COL.EMPLOYEE_ID).getValue().toString().trim();
    var jabatan = sheet.getRange(r, _STAFF_INPUT_COL.JABATAN).getValue().toString().trim();
    var dept    = sheet.getRange(r, _STAFF_INPUT_COL.DEPARTMENT).getValue().toString().trim();
    var branch  = sheet.getRange(r, _STAFF_INPUT_COL.BRANCH).getValue().toString().trim();
    var company = sheet.getRange(r, _STAFF_INPUT_COL.COMPANY_CODE).getValue().toString().trim() || 'RIFIM';
    var empType = sheet.getRange(r, _STAFF_INPUT_COL.EMP_TYPE).getValue().toString().trim() || 'PKWT';
    var joinRaw = sheet.getRange(r, _STAFF_INPUT_COL.JOIN_DATE).getValue();
    var joinDate = (joinRaw instanceof Date)
                    ? Utilities.formatDate(joinRaw, Session.getScriptTimeZone(), 'yyyy-MM-dd')
                    : joinRaw.toString().trim();
    var salary  = Number(sheet.getRange(r, _STAFF_INPUT_COL.SALARY).getValue()) || 0;
    var phone   = sheet.getRange(r, _STAFF_INPUT_COL.PHONE).getValue().toString().trim();
    var email   = sheet.getRange(r, _STAFF_INPUT_COL.EMAIL).getValue().toString().trim();
    var pin     = sheet.getRange(r, _STAFF_INPUT_COL.PIN).getValue().toString().trim();
    var status  = sheet.getRange(r, _STAFF_INPUT_COL.STATUS).getValue().toString().trim() || 'AKTIF';

    try {
      var payload = {
        full_name      : nama,
        position       : jabatan,
        department     : dept,
        branch         : branch,
        company_code   : company,
        employment_type: empType,
        join_date      : joinDate || null,
        salary_base    : salary,
        phone          : phone,
        email          : email,
        status         : status,
      };
      if (empId) payload.employee_id = empId;
      if (pin)   payload.pin         = pin;

      _sbPost('employees', payload);
      aksiSel.setValue('OK').setBackground('#D9EAD3');
      sukses++;
    } catch (e) {
      aksiSel.setValue('ERROR: ' + e.message).setBackground('#FCE5CD');
      gagal++;
    }
  }

  // Auto-sync ke kedua sheet setelah input
  if (sukses > 0) {
    syncHrisEmployeesToSheet();
    syncStaffKeDatabaseStaff();
  }

  SpreadsheetApp.getUi().alert(
    '✅ Proses Input Staff selesai!\n\n' +
    'Berhasil : ' + sukses + '\n' +
    'Dilewati : ' + skip   + ' (sudah OK)\n' +
    'Gagal    : ' + gagal
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TRIGGER — Auto sync staff tiap 6 jam
// ══════════════════════════════════════════════════════════════════════════════

function setupStaffSyncTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'syncStaffKeDatabaseStaff') ScriptApp.deleteTrigger(t);
    if (t.getHandlerFunction() === 'syncHrisEmployeesToSheet') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('syncStaffKeDatabaseStaff').timeBased().everyHours(6).create();
  Logger.log('✅ Trigger sync staff setiap 6 jam terpasang.');
  try { SpreadsheetApp.getUi().alert('✅ Auto-sync Staff tiap 6 jam aktif.'); } catch(e) {}
}

// ─── ACTIVITY LOG ────────────────────────────────────────────────────────────

var ACTIVITY_LOG_SHEET_NAME = 'activity_log';
var ACTIVITY_LOG_HEADERS = [
  'timestamp', 'module', 'action', 'target_id',
  'target_name', 'performed_by_name', 'performed_by_email', 'detail',
];

/**
 * Jalankan sekali di GAS Editor untuk membuat sheet activity_log.
 * Aman dijalankan berulang — hanya tambah header jika sheet kosong.
 */
function setupActivityLogSheet() {
  var ss    = _getDB();
  var sheet = ss.getSheetByName(ACTIVITY_LOG_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(ACTIVITY_LOG_SHEET_NAME);
    Logger.log('Sheet activity_log dibuat.');
  }
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, ACTIVITY_LOG_HEADERS.length).setValues([ACTIVITY_LOG_HEADERS]);
    sheet.setFrozenRows(1);
  }
  Logger.log('Setup sheet activity_log selesai.');
}

/**
 * Catat satu baris aktivitas. Gagal diam-diam — tidak boleh batalkan operasi utama.
 * @param {string} module          - 'Portal' | 'HRIS' | 'Smart Office'
 * @param {string} action          - 'LOGIN' | 'LOGOUT' | 'TAMBAH' | 'EDIT' | 'RESIGN' | 'PHK' | 'BUAT DOKUMEN'
 * @param {string} targetId        - employee_id / document_number
 * @param {string} targetName      - nama karyawan / judul dokumen
 * @param {string} performedByName - nama user yang melakukan
 * @param {string} performedByEmail
 * @param {string} detail          - keterangan tambahan (field yang diubah, tipe dokumen, dsb)
 */
function logActivity(module, action, targetId, targetName, performedByName, performedByEmail, detail) {
  try {
    var ss    = _getDB();
    var sheet = ss.getSheetByName(ACTIVITY_LOG_SHEET_NAME);
    if (!sheet) {
      setupActivityLogSheet();
      sheet = ss.getSheetByName(ACTIVITY_LOG_SHEET_NAME);
    }
    var tsStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
    sheet.appendRow([
      tsStr,
      module           || '',
      action           || '',
      targetId         || '',
      targetName       || '',
      performedByName  || '',
      performedByEmail || '',
      detail           || '',
    ]);
  } catch (e) {
    console.warn('logActivity gagal:', e.message);
  }
}

/**
 * Ambil daftar karyawan dari sheet (dipakai Smart Office untuk dokumen).
 * @returns {Array<{ id, nama, jabatan, cabang, email, company_code, status }>}
 */
function getEmployeesFromSheet() {
  var ss    = _getDB();
  var sheet = ss.getSheetByName(EMPLOYEES_SHEET_NAME);
  if (!sheet) return [];

  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  var headers = data[0];
  var idx     = {};
  headers.forEach(function(h, i) { idx[h] = i; });

  var list = [];
  for (var i = 1; i < data.length; i++) {
    var row  = data[i];
    var nama = String(row[idx['full_name']] || '').trim();
    if (!nama) continue;
    list.push({
      id:           String(row[idx['employee_id']]   || '').trim(),
      nama:         nama,
      jabatan:      String(row[idx['position']]      || '').trim(),
      department:   String(row[idx['department']]    || '').trim(),
      cabang:       String(row[idx['branch']]        || '').trim(),
      email:        String(row[idx['email']]         || '').trim(),
      company_code: String(row[idx['company_code']]  || '').trim(),
      status:       String(row[idx['status']]        || '').trim(),
      salary_base:  String(row[idx['salary_base']]   || '').trim(),
      join_date:    String(row[idx['join_date']]     || '').trim(),
    });
  }
  return list;
}
