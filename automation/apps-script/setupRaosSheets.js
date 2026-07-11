/**
 * RIFIM OS — Setup RAOS Sheets
 * Tambahkan ke spreadsheet "Document Rifim OS" (ID: 1jHeA-w1bM32S3-AU-ENN2UjiaCb4iLzRhaf4G7y4ozM)
 *
 * Jalankan SEKALI di GAS Editor:  setupRaosSheets()
 * Cek setelah selesai         :  verifyRaosSheets()
 */

var RAOS_SS_ID = '1jHeA-w1bM32S3-AU-ENN2UjiaCb4iLzRhaf4G7y4ozM';

var RAOS_SHEET_CONFIGS = [
  {
    name: 'Database Staff',
    color: '#1a73e8',
    headers: [
      'ID Staff', 'Nama', 'Jabatan', 'ID Cabang', 'Nama Cabang',
      'Gaji Pokok', 'No WA', 'Email', 'Pin', 'Status', 'Updated At'
    ],
    note: 'SSoT data staff — sync dari Supabase employees table'
  },
  {
    name: 'Database Driver External',
    color: '#34a853',
    headers: [
      'NO', 'ID Driver', 'Nama Driver', 'Zona/Cabang',
      'Status', 'Tanggal Daftar', 'Updated At'
    ],
    note: 'Driver non-airport (Batam, Jambi Luar) — sync dari Supabase drivers (zone=non_airport)'
  },
  {
    name: 'Database Driver Airport',
    color: '#fbbc04',
    headers: [
      'NO', 'ID Driver', 'Nama Driver', 'Cabang',
      'Tipe', 'Status', 'Tanggal Daftar', 'Updated At'
    ],
    note: 'Driver airport (konvensional/ASK) — sync dari Supabase drivers (zone=airport)'
  },
  {
    name: 'Form Input Saldo PWA',
    color: '#46bdc6',
    headers: [
      'Timestamp', 'ID Staff', 'Nama Staff', 'Cabang',
      'ID Driver', 'Nama Driver', 'Nominal', 'Metode', 'Keterangan',
      'Status Verifikasi'
    ],
    note: 'Raw input dari PWA isisaldo — status awal: BELUM TERVERIFIKASI'
  },
  {
    name: 'Database Input Saldo PWA',
    color: '#4285f4',
    headers: [
      'ID', 'Tanggal', 'ID Driver', 'Nama Driver', 'Cabang',
      'Nominal', 'Staff Input', 'Metode', 'Status', 'Verified At'
    ],
    note: 'Saldo dari PWA setelah diverifikasi — source: Form Input Saldo PWA'
  },
  {
    name: 'Form Input Saldo AIST',
    color: '#ea4335',
    headers: [
      'Timestamp', 'Admin', 'ID Driver', 'Nominal AIST',
      'Tanggal', 'Keterangan'
    ],
    note: 'Input manual admin dari web AIST — untuk cross-check dengan PWA'
  },
  {
    name: 'Database AIST',
    color: '#ff6d00',
    headers: [
      'ID', 'Tanggal', 'ID Driver', 'Nama Driver', 'Cabang',
      'Nominal PWA', 'Nominal AIST', 'Status Match',
      'Saldo Final', 'Created At'
    ],
    note: 'Hasil matching PWA vs AIST — MATCH/SELISIH/HANYA_PWA/HANYA_AIST'
  },
  {
    name: 'Input Potongan 1',
    color: '#7c4dff',
    headers: [
      'Timestamp', 'Price', 'Login ID', 'Waktu Order', 'Admin', 'Status'
    ],
    note: 'Input Dock 1 — copy 3 kolom dari web AIST (Price, Login ID, Waktu)'
  },
  {
    name: 'Input Potongan 2',
    color: '#7c4dff',
    headers: [
      'Timestamp', 'Price', 'Login ID', 'Waktu Order', 'Admin', 'Status'
    ],
    note: 'Input Dock 2 — paralel dengan Dock 1 agar multi-admin tidak conflict'
  },
  {
    name: 'Database Potongan',
    color: '#0097a7',
    headers: [
      'ID', 'Tanggal', 'ID Driver', 'Nama Driver', 'Cabang',
      'Price', 'Kode Order', 'Tipe Waktu', 'Offline',
      'Potongan Kantor', 'Hak Driver', 'Surcharge Offline',
      'Total Potongan', 'Status', 'Created At'
    ],
    note: 'Hasil kalkulasi potongan per order — source: Input Potongan 1 & 2 + CONFIG_FEE'
  },
];

/**
 * Jalankan sekali untuk membuat semua sheet RAOS.
 */
function setupRaosSheets() {
  var ss          = SpreadsheetApp.openById(RAOS_SS_ID);
  var existing    = ss.getSheets().map(function(s) { return s.getName(); });
  var created     = [];
  var skipped     = [];

  RAOS_SHEET_CONFIGS.forEach(function(cfg) {
    if (existing.indexOf(cfg.name) !== -1) {
      skipped.push(cfg.name);
      Logger.log('⚠️  SKIP (sudah ada): ' + cfg.name);
      return;
    }

    var sheet = ss.insertSheet(cfg.name);

    // ── Header ──────────────────────────────────────────────
    var hRange = sheet.getRange(1, 1, 1, cfg.headers.length);
    hRange.setValues([cfg.headers]);
    hRange.setBackground(cfg.color);
    hRange.setFontColor('#ffffff');
    hRange.setFontWeight('bold');
    hRange.setFontSize(11);
    hRange.setHorizontalAlignment('center');

    // ── Freeze + lebar kolom ────────────────────────────────
    sheet.setFrozenRows(1);
    for (var i = 1; i <= cfg.headers.length; i++) {
      sheet.setColumnWidth(i, 150);
    }

    // ── Row pertama: note/keterangan ────────────────────────
    sheet.getRange(2, 1).setValue('[' + cfg.note + ']');
    sheet.getRange(2, 1).setFontColor('#888888').setFontStyle('italic');

    created.push(cfg.name);
    Logger.log('✅  DIBUAT: ' + cfg.name + ' (' + cfg.headers.length + ' kolom)');
  });

  Logger.log('');
  Logger.log('══════════════════════════════');
  Logger.log('SELESAI: ' + created.length + ' sheet dibuat, ' + skipped.length + ' sheet di-skip.');
  Logger.log('Spreadsheet: https://docs.google.com/spreadsheets/d/' + RAOS_SS_ID);
  Logger.log('══════════════════════════════');
}

/**
 * Verifikasi semua sheet RAOS sudah ada.
 */
function verifyRaosSheets() {
  var ss       = SpreadsheetApp.openById(RAOS_SS_ID);
  var existing = ss.getSheets().map(function(s) { return s.getName(); });
  var ok = [], missing = [];

  RAOS_SHEET_CONFIGS.forEach(function(cfg) {
    if (existing.indexOf(cfg.name) !== -1) ok.push(cfg.name);
    else missing.push(cfg.name);
  });

  Logger.log('✅  Ada   (' + ok.length + '): ' + ok.join(', '));
  Logger.log('❌  Kurang(' + missing.length + '): ' + missing.join(', '));
}

/**
 * Reset / hapus semua sheet RAOS (HATI-HATI: hapus data!).
 * Jalankan hanya jika perlu setup ulang dari awal.
 */
function resetRaosSheets() {
  var ss       = SpreadsheetApp.openById(RAOS_SS_ID);
  var existing = ss.getSheets();
  var raosNames = RAOS_SHEET_CONFIGS.map(function(c) { return c.name; });

  existing.forEach(function(sheet) {
    if (raosNames.indexOf(sheet.getName()) !== -1) {
      if (ss.getSheets().length === 1) return; // tidak bisa hapus sheet terakhir
      ss.deleteSheet(sheet);
      Logger.log('🗑️  Dihapus: ' + sheet.getName());
    }
  });
}
