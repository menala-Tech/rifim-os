/**
 * RIFIM OS — Setup RAOS Sheets
 * Kolom mengikuti struktur file Batch aktual (bukan generik)
 *
 * WARNA HEADER:
 *   KUNING (#FBBC04) = input manual / paste dari AIST oleh admin
 *   HIJAU  (#34A853) = auto-fill dari Database Driver / Staff (VLOOKUP/GAS)
 *   BIRU   (#4285F4) = kalkulasi otomatis (fee, potongan, hak driver)
 *   MERAH  (#EA4335) = alert / warning / SLA system
 *   TEAL   (#46BDC6) = system-generated (ID, timestamp, status)
 *
 * Jalankan di GAS Editor:  setupRaosSheets()
 * Verifikasi             :  verifyRaosSheets()
 * Reset (HATI-HATI)      :  resetRaosSheets()
 */

var RAOS_SS_ID = '1jHeA-w1bM32S3-AU-ENN2UjiaCb4iLzRhaf4G7y4ozM';

// Konstanta warna
var _Y = '#FBBC04'; // Kuning  — manual / paste dari AIST
var _G = '#34A853'; // Hijau   — auto dari Database / VLOOKUP
var _B = '#4285F4'; // Biru    — kalkulasi fee / potongan
var _R = '#EA4335'; // Merah   — alert / SLA
var _T = '#46BDC6'; // Teal    — system (ID, status, timestamp)

/**
 * Pilih warna teks: kuning pakai hitam, semua lain putih
 */
function _fc(bg) {
  return bg === _Y ? '#000000' : '#FFFFFF';
}

/**
 * Definisi sheet — kolom mengikuti file Batch aktual
 *
 * cfg.cols: array {h: 'Header', c: '#warna'}
 *   h = header text (sesuai nama kolom di file Batch)
 *   c = warna header (gunakan konstanta di atas)
 */
var RAOS_SHEETS = [

  // ══════════════════════════════════════════════════════════
  // MASTER DATA (sync dari Supabase — JANGAN edit manual)
  // ══════════════════════════════════════════════════════════

  {
    name: 'Database Staff',
    note: 'SSoT data staff — sync dari Supabase employees. Jangan edit manual.',
    cols: [
      {h:'ID Staff',    c:_T}, {h:'Nama',        c:_T}, {h:'Jabatan',     c:_T},
      {h:'ID Cabang',   c:_T}, {h:'Nama Cabang', c:_T}, {h:'Gaji Pokok',  c:_T},
      {h:'No WA Staff', c:_T}, {h:'Email',        c:_T}, {h:'Pin',         c:_T},
      {h:'Status',      c:_T}, {h:'Updated At',  c:_T},
    ]
  },

  {
    name: 'Database Driver External',
    note: 'Driver non-airport (Batam, Jambi Luar) — sync dari Supabase drivers zone=non_airport.',
    cols: [
      {h:'NO',           c:_T}, {h:'ID Driver',   c:_T}, {h:'Nama Driver', c:_T},
      {h:'Id Cabang',    c:_T}, {h:'Status',      c:_T},
      {h:'Tanggal Daftar', c:_T}, {h:'Updated At', c:_T},
    ]
  },

  {
    name: 'Database Driver Airport',
    note: 'Driver airport (konvensional + ASK) — sync dari Supabase drivers zone=airport.',
    cols: [
      {h:'NO',           c:_T}, {h:'ID Driver',   c:_T}, {h:'Nama Driver', c:_T},
      {h:'Cabang',       c:_T}, {h:'Tipe',        c:_T}, {h:'Status',      c:_T},
      {h:'Tanggal Daftar', c:_T}, {h:'Updated At', c:_T},
    ]
  },

  // ══════════════════════════════════════════════════════════
  // PENGISIAN SALDO DRIVER
  // Gambar 1 — Pengisian Saldo spreadsheet aktual
  // ══════════════════════════════════════════════════════════

  {
    name: 'Form Input Saldo PWA',
    note: 'Raw input dari staff via PWA isisaldo. KUNING = input form staff. HIJAU = auto sistem. MERAH = alert.',
    cols: [
      // Kolom A-E: kuning — diisi staff via form PWA
      {h:'Timestamp',       c:_Y},
      {h:'Cabang',          c:_Y},
      {h:'Nama Staff',      c:_Y},
      {h:'Nominal',         c:_Y},
      {h:'ID Login Driver', c:_Y},
      // Kolom F: hijau — auto VLOOKUP dari Database Driver
      {h:'Nama Driver',     c:_G},
      // Kolom G-H: hijau — checkbox auto oleh GAS
      {h:'Sudah Diisi',     c:_G},
      {h:'Alert Terkirim',  c:_G},
      // Kolom I: merah — alert terakhir oleh SLA engine
      {h:'Alert Terakhir',  c:_R},
    ]
  },

  {
    name: 'Database Input Saldo PWA',
    note: 'Saldo PWA setelah sync & verifikasi awal (BELUM TERVERIFIKASI → TERVERIFIKASI setelah match AIST).',
    cols: [
      // Dari form (kuning)
      {h:'Timestamp',        c:_Y},
      {h:'Cabang',           c:_Y},
      {h:'Nama Staff',       c:_Y},
      {h:'ID Login Driver',  c:_Y},
      {h:'Nominal',          c:_Y},
      // Auto dari DB Driver (hijau)
      {h:'Nama Driver',      c:_G},
      // System (teal)
      {h:'Status',           c:_T},  // BELUM TERVERIFIKASI / TERVERIFIKASI
      {h:'SLA Alert',        c:_R},
      {h:'Verified At',      c:_T},
    ]
  },

  // ══════════════════════════════════════════════════════════
  // FORM INPUT SALDO AIST (HY MELA style)
  // Gambar 2 — kolom manual paste warna kuning
  // ══════════════════════════════════════════════════════════

  {
    name: 'Form Input Saldo AIST',
    note: 'KUNING A-C = paste dari web AIST (Tanggal dd.MM.yyyy, SUM "195 000", Credit Account). D (Login ID) = isi manual admin. Kolom E-H otomatis.',
    cols: [
      // Kolom A-C: KUNING — paste dari web AIST
      {h:'Tanggal',         c:_Y},
      {h:'SUM',             c:_Y},
      {h:'Credit Account',  c:_Y},
      // Kolom D: KUNING — isi manual oleh admin (Login ID driver, bukan dari AIST paste)
      {h:'Login ID',        c:_Y},
      // Kolom E-G: hijau — auto dari Database Driver (VLOOKUP Login ID)
      {h:'Nominal Tagihan', c:_G},
      {h:'Nama Driver',     c:_G},
      {h:'Cabang',          c:_G},
      // Kolom H: teal — status auto
      {h:'STATUS',          c:_T},
    ]
  },

  {
    name: 'Database AIST',
    note: 'Hasil proses Form Input Saldo AIST setelah validasi GAS. Status: MATCH/SELISIH/HANYA_PWA/HANYA_AIST.',
    cols: [
      {h:'ID',              c:_T},
      {h:'Tanggal',         c:_Y},
      {h:'Login ID',        c:_Y},
      {h:'Credit Account',  c:_Y},
      {h:'Nama Driver',     c:_G},
      {h:'Cabang',          c:_G},
      {h:'Nominal Tagihan', c:_G},
      {h:'Status Match',    c:_T},  // MATCH / SELISIH / HANYA_PWA / HANYA_AIST
      {h:'Created At',      c:_T},
    ]
  },

  // ══════════════════════════════════════════════════════════
  // POTONGAN ORDER
  // Gambar 3 — kolom manual paste warna kuning, kalkulasi biru
  // ══════════════════════════════════════════════════════════

  {
    name: 'Input Potongan 1',
    note: 'Paste B/C/D sekaligus dari AIST: B=Price (104600), C=Login ID (204753205), D=Waktu Order ("11.07.2026 18:40"). OnEdit auto-isi A & H + konversi D ke Date.',
    cols: [
      // Kolom A: hijau — auto dari Login ID (lookup DB Driver → Id Cabang)
      {h:'Id Cabang',       c:_G},
      // Kolom B-D: KUNING — admin paste dari web AIST
      {h:'Price',           c:_Y},
      {h:'Login ID',        c:_Y},
      {h:'Waktu Order',     c:_Y},
      // Kolom E: kuning — manual ceklis jika order offline
      {h:'Offline?',        c:_Y},
      // Kolom F-G: hijau — auto dari logic GAS (kode cabang, pembanding)
      {h:'Kode Opsional',   c:_G},
      {h:'Pembanding PKU',  c:_G},
      // Kolom H: hijau — auto VLOOKUP dari Database Driver
      {h:'Nama Driver',     c:_G},
      // Kolom I: BIRU — kalkulasi dari CONFIG_FEE_KANTOR per cabang
      {h:'Potongan Kantor', c:_B},
      // Kolom J: biru — kalkulasi Price - Potongan
      {h:'Hak Driver',      c:_B},
      // Kolom K: teal — status auto
      {h:'Status',          c:_T},
    ]
  },

  {
    name: 'Input Potongan 2',
    note: 'Paralel dengan Input Potongan 1 — multi-admin tanpa conflict. Paste B/C/D dari AIST, A & H auto-isi, D auto-konversi ke Date. Struktur identik.',
    cols: [
      {h:'Id Cabang',       c:_G},
      {h:'Price',           c:_Y},
      {h:'Login ID',        c:_Y},
      {h:'Waktu Order',     c:_Y},
      {h:'Offline?',        c:_Y},
      {h:'Kode Opsional',   c:_G},
      {h:'Pembanding PKU',  c:_G},
      {h:'Nama Driver',     c:_G},
      {h:'Potongan Kantor', c:_B},
      {h:'Hak Driver',      c:_B},
      {h:'Status',          c:_T},
    ]
  },

  {
    name: 'Database Potongan',
    note: 'Master data potongan per order. Source: Input Potongan 1 & 2 + CONFIG_FEE_KANTOR. Sync ke Supabase order_deductions.',
    cols: [
      {h:'ID',                c:_T},
      {h:'Tanggal',           c:_Y},
      {h:'Id Cabang',         c:_G},
      {h:'Login ID',          c:_Y},
      {h:'Nama Driver',       c:_G},
      {h:'Price',             c:_Y},
      {h:'Kode Order',        c:_G},
      {h:'Tipe Waktu',        c:_G},  // SIANG / MALAM / DINI
      {h:'Offline',           c:_Y},  // TRUE / FALSE
      {h:'Potongan Kantor',   c:_B},
      {h:'Hak Driver',        c:_B},
      {h:'Surcharge Offline', c:_B},  // Price × 12% jika offline
      {h:'Total Potongan',    c:_B},
      {h:'Status',            c:_T},
      {h:'Created At',        c:_T},
    ]
  },

];

// ══════════════════════════════════════════════════════════════════
// MAIN FUNCTIONS
// ══════════════════════════════════════════════════════════════════

/**
 * Jalankan SEKALI untuk membuat semua sheet RAOS dengan kolom aktual.
 */
function setupRaosSheets() {
  var ss       = SpreadsheetApp.openById(RAOS_SS_ID);
  var existing = ss.getSheets().map(function(s) { return s.getName(); });
  var created  = [];
  var skipped  = [];

  RAOS_SHEETS.forEach(function(cfg) {
    if (existing.indexOf(cfg.name) !== -1) {
      skipped.push(cfg.name);
      Logger.log('⚠️  SKIP (sudah ada): ' + cfg.name);
      return;
    }

    var sheet = ss.insertSheet(cfg.name);

    // ── Header per kolom (warna berbeda sesuai tipe) ──
    cfg.cols.forEach(function(col, i) {
      var cell = sheet.getRange(1, i + 1);
      cell.setValue(col.h);
      cell.setBackground(col.c);
      cell.setFontColor(_fc(col.c));
      cell.setFontWeight('bold');
      cell.setFontSize(11);
      cell.setHorizontalAlignment('center');
      cell.setVerticalAlignment('middle');
      sheet.setColumnWidth(i + 1, 160);
    });

    sheet.setRowHeight(1, 36);
    sheet.setFrozenRows(1);

    // ── Note keterangan sheet di baris 2 ──
    var noteCell = sheet.getRange(2, 1, 1, cfg.cols.length);
    noteCell.merge();
    noteCell.setValue('ℹ️  ' + cfg.note);
    noteCell.setFontColor('#888888');
    noteCell.setFontStyle('italic');
    noteCell.setFontSize(10);
    sheet.setRowHeight(2, 24);

    created.push(cfg.name);
    Logger.log('✅  DIBUAT: ' + cfg.name + ' (' + cfg.cols.length + ' kolom)');
  });

  Logger.log('');
  Logger.log('══════════════════════════════════════════');
  Logger.log('SELESAI: ' + created.length + ' sheet dibuat, ' + skipped.length + ' sheet di-skip.');
  Logger.log('Spreadsheet: https://docs.google.com/spreadsheets/d/' + RAOS_SS_ID);
  Logger.log('══════════════════════════════════════════');
  Logger.log('');
  Logger.log('Legenda warna:');
  Logger.log('  KUNING  = kolom manual / paste dari AIST oleh admin');
  Logger.log('  HIJAU   = auto-fill dari Database Driver / Staff');
  Logger.log('  BIRU    = kalkulasi otomatis (fee, potongan, hak driver)');
  Logger.log('  MERAH   = alert / SLA system');
  Logger.log('  TEAL    = system-generated (ID, status, timestamp)');
}

/**
 * Verifikasi semua sheet RAOS sudah ada dan jumlah kolomnya benar.
 */
function verifyRaosSheets() {
  var ss       = SpreadsheetApp.openById(RAOS_SS_ID);
  var sheets   = {};
  ss.getSheets().forEach(function(s) { sheets[s.getName()] = s; });

  var ok = [], missing = [], mismatch = [];

  RAOS_SHEETS.forEach(function(cfg) {
    if (!sheets[cfg.name]) {
      missing.push(cfg.name);
      return;
    }
    var sheet      = sheets[cfg.name];
    var lastCol    = sheet.getLastColumn();
    var expected   = cfg.cols.length;
    if (lastCol < expected) {
      mismatch.push(cfg.name + ' (ada ' + lastCol + ' kolom, harusnya ' + expected + ')');
    } else {
      ok.push(cfg.name);
    }
  });

  Logger.log('══ VERIFY RAOS SHEETS ══════════════════');
  Logger.log('✅  OK      (' + ok.length + '): ' + (ok.join(', ') || '-'));
  Logger.log('❌  KURANG  (' + missing.length + '): ' + (missing.join(', ') || '-'));
  Logger.log('⚠️   MISMATCH(' + mismatch.length + '): ' + (mismatch.join(', ') || '-'));
}

/**
 * Hapus dan buat ulang sheet RAOS tertentu.
 * Pakai saat kolom perlu diubah setelah sheet sudah ada.
 * @param {string} sheetName - nama sheet yang mau direset
 */
function resetSingleRaosSheet(sheetName) {
  var ss    = SpreadsheetApp.openById(RAOS_SS_ID);
  var cfg   = RAOS_SHEETS.find(function(c) { return c.name === sheetName; });
  if (!cfg) { Logger.log('Sheet tidak ditemukan di config: ' + sheetName); return; }

  var existing = ss.getSheetByName(sheetName);
  if (existing) {
    if (!Browser.msgBox('⚠️ Hapus & buat ulang sheet "' + sheetName + '"?\nDATA AKAN HILANG!',
        Browser.Buttons.OK_CANCEL) === 'ok') return;
    ss.deleteSheet(existing);
    Logger.log('🗑️  Dihapus: ' + sheetName);
  }

  // Hapus dari existing list agar setupRaosSheets bisa membuatnya ulang
  RAOS_SHEETS.forEach(function(c) {
    if (c.name !== sheetName) return;
    var sheet = ss.insertSheet(c.name);
    c.cols.forEach(function(col, i) {
      var cell = sheet.getRange(1, i + 1);
      cell.setValue(col.h);
      cell.setBackground(col.c);
      cell.setFontColor(_fc(col.c));
      cell.setFontWeight('bold');
      cell.setFontSize(11);
      cell.setHorizontalAlignment('center');
      sheet.setColumnWidth(i + 1, 160);
    });
    sheet.setRowHeight(1, 36);
    sheet.setFrozenRows(1);
    Logger.log('✅  Dibuat ulang: ' + c.name);
  });
}

/**
 * Reset SEMUA sheet RAOS. SANGAT BERBAHAYA — hanya untuk setup awal.
 */
function resetRaosSheets() {
  var ss        = SpreadsheetApp.openById(RAOS_SS_ID);
  var raosNames = RAOS_SHEETS.map(function(c) { return c.name; });
  ss.getSheets().forEach(function(sheet) {
    if (raosNames.indexOf(sheet.getName()) !== -1) {
      if (ss.getSheets().length === 1) return;
      ss.deleteSheet(sheet);
      Logger.log('🗑️  Dihapus: ' + sheet.getName());
    }
  });
  Logger.log('Reset selesai. Jalankan setupRaosSheets() untuk membuat ulang.');
}
