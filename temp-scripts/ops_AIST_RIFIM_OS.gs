/**
 * ═══════════════════════════════════════════════════════════════
 * OPS_AIST_RIFIM_OS.GS  — SCRIPT SEMENTARA (TAMBAH & HAPUS SESUAI BUTUH)
 * PT. RIFIM INTERNATIONAL GEMILANG — RIFIM OS
 *
 * CARA PAKAI:
 *  1. Buka GAS Editor spreadsheet RIFIM OS (Script ID project)
 *  2. Tambahkan file ini ke project (+ File → Paste isi file ini)
 *  3. Update AIST_COOKIE di bawah (lihat instruksi baris 30)
 *  4. Jalankan dari menu 🚛 RIFIM OS → 💳 Saldo AIST → "Ambil Data AIST"
 *  5. Data masuk ke "Form Input Saldo AIST" (baris 3 ke bawah, kolom A-C)
 *  6. Admin isi manual kolom D (Login ID) untuk tiap baris
 *  7. Klik "Pindahkan Transaksi AIST → Database AIST"
 *  8. HAPUS FILE INI dari project GAS (klik kanan → Delete)
 *
 * KENAPA DIPISAH:
 *  - Cookie tidak tersimpan permanen di project (hanya ada saat diperlukan)
 *  - Lebih aman dari audit/review project GAS
 *  - Script permanen (raosMenuEngine.js dll) tetap tanpa kode AIST
 *
 * PERBEDAAN DARI VERSI PENGISIAN SALDO:
 *  - Target sheet : "Form Input Saldo AIST" (bukan "INPUT_DOCK_1")
 *  - Start row    : 3 (bukan 4)
 *  - Spreadsheet  : openById(RAOS_SS_ID) ← dari raosConfig.js/webApp.js
 * ═══════════════════════════════════════════════════════════════
 */

// ╔═══════════════════════════════════════════════════════════════╗
// ║ KONFIGURASI — UPDATE COOKIE DI SINI SEBELUM JALANKAN         ║
// ╚═══════════════════════════════════════════════════════════════╝

// ⚠️ Cookie expired dalam beberapa jam setelah login.
//    Cara update: Login AIST → F12 → Network → filter "wksapi" →
//    klik request "view?" → Headers → copy nilai "Cookie:" → paste di sini.
var AIST_COOKIE = "PASTE_COOKIE_ANDA_DI_SINI";

// Konfigurasi API — tidak perlu diubah
var _A_URL      = "https://wksapi-aist-id.taxsee.com/api/v2/views/T_DOCUM/V_DOCUM_USER/view" +
                  "?long-to-string=true&ui-culture=en&auto-request=false" +
                  "&timezone=Asia%2FJakarta&use-field-cache=true&include-sql=true&async-request=true";
var _A_TZ       = "Asia/Jakarta";
var _A_TYPE     = "Balance replenishment";
var _A_SUMS     = [45000, 95000, 145000, 195000];
var _A_PAGESIZE = 200;
var _A_MAXPAGES = 50;

// Target sheet RIFIM OS — sesuai setupRaosSheets.js
var _A_SHEET    = "Form Input Saldo AIST";
var _A_START_ROW = 3;  // baris 1=header, 2=note, 3+=data

// ╔═══════════════════════════════════════════════════════════════╗
// ║ HEADER BROWSER-LIKE                                           ║
// ╚═══════════════════════════════════════════════════════════════╝

function _buatHeader(cookie) {
  return {
    "User-Agent":       "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
                        "AppleWebKit/537.36 (KHTML, like Gecko) " +
                        "Chrome/125.0.6422.113 Safari/537.36",
    "Accept":           "application/json, text/plain, */*",
    "Accept-Language":  "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
    "Content-Type":     "application/json",
    "Origin":           "https://aist-id.taxsee.com",
    "Referer":          "https://aist-id.taxsee.com/",
    "Sec-Fetch-Dest":   "empty",
    "Sec-Fetch-Mode":   "cors",
    "Sec-Fetch-Site":   "same-site",
    "Sec-Ch-Ua":          '"Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
    "Sec-Ch-Ua-Mobile":   "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
    "Cookie":           cookie
  };
}

// Delay acak 50–200ms antar page request agar tidak terdeteksi sebagai bot
function _jeda() {
  Utilities.sleep(50 + Math.floor(Math.random() * 150));
}

// ╔═══════════════════════════════════════════════════════════════╗
// ║ FUNGSI UTAMA: AMBIL DATA AIST → Form Input Saldo AIST         ║
// ╚═══════════════════════════════════════════════════════════════╝

function ambilDataAIST() {
  var ui         = SpreadsheetApp.getUi();
  var ss         = SpreadsheetApp.openById(RAOS_SS_ID);  // RAOS_SS_ID dari raosConfig/webApp
  var props      = PropertiesService.getScriptProperties();
  var adminEmail = Session.getActiveUser().getEmail();
  var adminTime  = Utilities.formatDate(new Date(), _A_TZ, "dd/MM/yyyy HH:mm:ss");

  // Validasi cookie
  if (!AIST_COOKIE || AIST_COOKIE === "PASTE_COOKIE_ANDA_DI_SINI") {
    ui.alert(
      "❌ COOKIE BELUM DIISI\n\n" +
      "Update AIST_COOKIE di baris 30 file ini dulu.\n\n" +
      "Cara:\n1. Buka aist-id.taxsee.com & login\n" +
      "2. F12 → Network → filter 'wksapi'\n" +
      "3. Klik request 'view?' → Headers → copy Cookie\n" +
      "4. Paste ke AIST_COOKIE di file ini");
    return;
  }

  // Tanya tanggal
  var defaultDate = new Date(new Date().getTime() - 24 * 60 * 60 * 1000);
  var defaultStr  = Utilities.formatDate(defaultDate, _A_TZ, "dd/MM/yyyy");

  var resp = ui.prompt(
    "📅 Ambil Data AIST → Form Input Saldo AIST",
    "Masukkan tanggal (DD/MM/YYYY).\n" +
    "Kosongkan untuk default: " + defaultStr + " (kemarin).",
    ui.ButtonSet.OK_CANCEL
  );
  if (resp.getSelectedButton() !== ui.Button.OK) return;

  var inputStr = resp.getResponseText().trim() || defaultStr;
  var parts    = inputStr.split("/");
  if (parts.length !== 3) { ui.alert("❌ Format salah. Gunakan DD/MM/YYYY"); return; }

  var dd = parseInt(parts[0]), mm = parseInt(parts[1]), yyyy = parseInt(parts[2]);
  var fromDate = new Date(yyyy, mm - 1, dd);
  if (isNaN(fromDate.getTime())) { ui.alert("❌ Tanggal tidak valid: " + inputStr); return; }

  // Cek Lock
  var lockKey   = "AIST_LOCK_" + Utilities.formatDate(fromDate, _A_TZ, "yyyyMMdd");
  var lockValue = props.getProperty(lockKey);
  if (lockValue) {
    var lockInfo = JSON.parse(lockValue);
    var konfirm  = ui.alert(
      "⚠️ DATA SUDAH DIAMBIL",
      "Tanggal " + inputStr + " sudah pernah diambil:\n\n" +
      "👤 Admin : " + lockInfo.admin + "\n" +
      "🕐 Waktu : " + lockInfo.time + "\n" +
      "📊 Baris : " + lockInfo.rows + "\n\n" +
      "Ambil ulang (data akan ditambahkan, bukan diganti)?",
      ui.ButtonSet.YES_NO
    );
    if (konfirm !== ui.Button.YES) return;
  }

  // Range tanggal
  var dateFrom = Utilities.formatDate(fromDate, _A_TZ, "yyyy-MM-dd");
  var toDate   = new Date(fromDate.getTime() + 24 * 60 * 60 * 1000);
  var dateTo   = Utilities.formatDate(toDate, _A_TZ, "yyyy-MM-dd");

  // Fetch pagination
  var allItems  = [];
  var page      = 0;
  var cursorId  = null;
  var keepGoing = true;
  var header    = _buatHeader(AIST_COOKIE);

  while (keepGoing && page < _A_MAXPAGES) {
    var filter = {
      "C_TYPE_DOC":    { "like": _A_TYPE + "%" },
      "C_STATUS_NAME": { "like": "Posted%" },
      "C_DATE":        { "gte": dateFrom + "T00:00:00", "lt": dateTo + "T00:00:00" },
      "C_SUM":         { "gte": 45000 }
    };
    if (cursorId !== null) filter["ID"] = { "lt": cursorId };

    var options = {
      "method":             "post",
      "payload":            JSON.stringify({ "filter": filter, "limit": _A_PAGESIZE, "order": { "ID": "desc" } }),
      "headers":            header,
      "muteHttpExceptions": true
    };

    if (page > 0) _jeda();

    var response = UrlFetchApp.fetch(_A_URL, options);
    var code     = response.getResponseCode();

    if (code === 401 || code === 403) {
      ui.alert(
        "❌ COOKIE EXPIRED (HTTP " + code + ")\n\n" +
        "Cara update cookie:\n" +
        "1. Buka aist-id.taxsee.com & login\n" +
        "2. F12 → Network → filter 'wksapi'\n" +
        "3. Klik request 'view?' → Headers → copy Cookie\n" +
        "4. Paste ke AIST_COOKIE di baris 30 file ini");
      return;
    }

    var json;
    try { json = JSON.parse(response.getContentText()); }
    catch (e) {
      ui.alert("❌ Gagal parse response (HTTP " + code + "):\n" + response.getContentText().substring(0, 300));
      return;
    }

    var items = json.data || [];
    if (items.length === 0) {
      keepGoing = false;
    } else {
      allItems = allItems.concat(items);
      cursorId = items[items.length - 1].ID;
      if (items.length < _A_PAGESIZE) keepGoing = false;
    }
    page++;
  }

  if (allItems.length === 0) {
    ui.alert("⚠️ Tidak ada data AIST untuk tanggal " + inputStr);
    return;
  }

  // Filter: hanya nominal valid & status Posted
  var validSet = {};
  _A_SUMS.forEach(function(s) { validSet[s] = true; });
  var filtered = allItems.filter(function(item) {
    return validSet[Number(item.C_SUM)] &&
           String(item.C_STATUS_NAME || "").toLowerCase().indexOf("posted") !== -1;
  });

  if (filtered.length === 0) {
    ui.alert("⚠️ Tidak ada data lolos filter.\nTotal dari AIST: " + allItems.length + " transaksi.");
    return;
  }

  // Format helper
  function fmtDate(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    return isNaN(d.getTime()) ? iso : Utilities.formatDate(d, _A_TZ, "dd.MM.yyyy H:mm:ss");
  }

  // SUM disimpan sebagai NUMBER (bukan string "45 000") agar langsung bisa dihitung
  // di Database AIST dan LAPORAN_CABANG
  var rows = filtered.map(function(item) {
    return [
      fmtDate(item.C_DATE),      // A: Tanggal
      Number(item.C_SUM) || 0,   // B: SUM (number — bukan string berspasi)
      item.C_ACC_CT || ""        // C: Credit Account
    ];
  });

  // Tulis ke "Form Input Saldo AIST" mulai baris pertama yang kosong (≥ row 3)
  var targetSheet = ss.getSheetByName(_A_SHEET);
  if (!targetSheet) {
    ui.alert('❌ Sheet "' + _A_SHEET + '" tidak ditemukan.\nJalankan Setup → Setup Semua RAOS Sheets terlebih dahulu.');
    return;
  }

  var startRow = _A_START_ROW;
  while (startRow <= targetSheet.getLastRow() + 1 &&
         targetSheet.getRange(startRow, 1).getValue() !== "") {
    startRow++;
  }

  targetSheet.getRange(startRow, 1, rows.length, 3).setValues(rows);
  SpreadsheetApp.flush();

  // Simpan Lock
  props.setProperty(lockKey, JSON.stringify({
    admin: adminEmail,
    time:  adminTime,
    rows:  rows.length,
    date:  inputStr
  }));

  ui.alert(
    "✅ BERHASIL!\n\n" +
    "📊 Data masuk : " + rows.length + " baris\n" +
    "📅 Tanggal    : " + inputStr + "\n" +
    "📋 Sheet      : " + _A_SHEET + " (mulai baris " + startRow + ")\n\n" +
    "➡️  LANGKAH SELANJUTNYA:\n" +
    "   1. Isi kolom D (Login ID) secara manual untuk tiap baris\n" +
    "   2. Klik menu 🚛 RIFIM OS → 💳 Saldo AIST → Pindahkan Transaksi\n\n" +
    "⚠️  SETELAH SELESAI:\n" +
    "   Hapus file ops_AIST_RIFIM_OS.gs dari project GAS\n" +
    "   (klik kanan nama file di sidebar → Delete)"
  );
}

// ╔═══════════════════════════════════════════════════════════════╗
// ║ CEK STATUS LOCK & RESET LOCK                                  ║
// ╚═══════════════════════════════════════════════════════════════╝

function cekStatusLock() {
  var ui    = SpreadsheetApp.getUi();
  var props = PropertiesService.getScriptProperties();
  var all   = props.getProperties();
  var locks = [];

  for (var key in all) {
    if (key.indexOf("AIST_LOCK_") === 0) {
      try {
        var info = JSON.parse(all[key]);
        locks.push(
          "📅 " + info.date +
          " | 👤 " + info.admin +
          " | 📊 " + info.rows + " baris" +
          " | 🕐 " + info.time);
      } catch (e) {}
    }
  }

  if (locks.length === 0) {
    ui.alert("ℹ️ Belum ada data AIST yang diambil bulan ini.");
  } else {
    ui.alert("📋 RIWAYAT PENGAMBILAN DATA AIST:\n\n" + locks.join("\n\n"));
  }
}

function resetLockAIST() {
  var ui = SpreadsheetApp.getUi();
  var konfirm = ui.alert(
    "🔓 RESET LOCK AIST",
    "Hapus semua lock AIST?\n\nAdmin: " + Session.getActiveUser().getEmail(),
    ui.ButtonSet.YES_NO
  );
  if (konfirm !== ui.Button.YES) return;

  var props = PropertiesService.getScriptProperties();
  var all   = props.getProperties();
  var count = 0;
  for (var key in all) {
    if (key.indexOf("AIST_LOCK_") === 0) {
      props.deleteProperty(key);
      count++;
    }
  }
  ui.alert("✅ " + count + " lock dihapus.");
}
