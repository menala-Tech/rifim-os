// ============================================================
// maintenance.js — One-shot maintenance helpers untuk Rifim OS
// ============================================================
//
// Fungsi di sini dijalankan MANUAL sekali dari Apps Script Editor
// (pilih fungsi di dropdown → tekan ▶ Run). BUKAN via Web App / cron.
// Cek Logger.log ("Log eksekusi" di editor) untuk hasil.

/**
 * Hapus 5 tab OVERLAP dengan RAOS di sheet Rifim OS Smart Office Database
 * (audit cross-file duplicate 2026-08-04). Data primary sudah live di RAOS
 * (sheet 1eYS2mM3Sy... + Supabase raos_attendance / raos_driver_queue /
 * raos_saldo_requests / user_profiles).
 */
function deleteRifimosOverlapTabs() {
  var SHEET_ID = '1jHeA-w1bM32S3-AU-ENN2UjiaCb4iLzRhaf4G7y4ozM';
  var TABS_TO_DELETE = [
    'Absensi Staff',              // → RAOS ABSENSI + Supabase raos_attendance
    'Antrian Bandara',            // → RAOS Antrian Driver + Supabase raos_driver_queue
    'Database Staff',             // → SSOT MASTER DATA STAFF + Supabase user_profiles
    'Form Input Saldo PWA',       // → RAOS Form Isi Saldo + Supabase raos_saldo_requests
    'Database Input Saldo PWA',   // → sama, redundant
  ];
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var results = [];
  TABS_TO_DELETE.forEach(function(name) {
    var sh = ss.getSheetByName(name);
    if (!sh) { results.push(name + ': SKIP (tab tidak ada)'); return; }
    var lastRow = sh.getLastRow();
    // Guard: tab yg diaudit rata-rata <20 rows. Kalau ternyata sudah membengkak,
    // skip dulu supaya user bisa cek isi manual.
    if (lastRow > 20) {
      results.push(name + ': SKIP (' + lastRow + ' rows > 20, cek manual dulu)');
      return;
    }
    try {
      ss.deleteSheet(sh);
      results.push(name + ': DELETED (' + lastRow + ' rows)');
    } catch (e) {
      results.push(name + ': ERROR ' + e.message);
    }
  });
  var summary = results.join('\n');
  Logger.log('=== deleteRifimosOverlapTabs ===\n' + summary);
  return summary;
}
