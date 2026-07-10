/**
 * RIFIM OS — Backup Engine
 * Copy otomatis spreadsheet RIFIM OS ke subfolder "Backup Database"
 * di dalam folder induk yang sama dengan spreadsheet utama.
 *
 * Setup (jalankan sekali di GAS Editor):
 *   setupBackupTrigger()   — daftarkan trigger harian jam 02.00 WIB
 *
 * Jalankan manual kapan saja:
 *   runBackup()
 */

var BACKUP_SUBFOLDER_NAME = 'Backup Database';
var BACKUP_KEEP_COUNT     = 7;
var BACKUP_FILE_PREFIX    = 'RIFIM OS Database - Backup';

/**
 * Fungsi utama backup. Dipanggil oleh trigger harian.
 * 1. Temukan/buat subfolder "Backup Database" di folder induk spreadsheet.
 * 2. Copy spreadsheet ke subfolder dengan nama bertanggal.
 * 3. Hapus copy lama jika jumlahnya melebihi BACKUP_KEEP_COUNT.
 */
function runBackup() {
  var ss      = _getDB();
  var file    = DriveApp.getFileById(ss.getId());
  var parents = file.getParents();

  if (!parents.hasNext()) {
    Logger.log('Backup gagal: spreadsheet tidak punya folder induk.');
    return;
  }

  var parentFolder  = parents.next();
  var backupFolder  = _getOrCreateSubfolder(parentFolder, BACKUP_SUBFOLDER_NAME);
  var dateStr       = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
  var backupName    = BACKUP_FILE_PREFIX + ' ' + dateStr;

  file.makeCopy(backupName, backupFolder);
  Logger.log('Backup dibuat: ' + backupName);

  _deleteOldBackups(backupFolder);
}

/**
 * Daftarkan trigger harian untuk backup otomatis jam 02.00 WIB.
 * Jalankan sekali di GAS Editor. Trigger akan terus aktif sampai dihapus.
 */
function setupBackupTrigger() {
  // Hapus trigger runBackup yang sudah ada agar tidak duplikat
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'runBackup') {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger('runBackup')
    .timeBased()
    .everyDays(1)
    .atHour(2)
    .create();

  Logger.log('Trigger backup harian jam 02.00 berhasil didaftarkan.');
}

/**
 * Hapus trigger backup (jika ingin mematikan backup otomatis).
 */
function removeBackupTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'runBackup') {
      ScriptApp.deleteTrigger(t);
      Logger.log('Trigger backup dihapus.');
    }
  });
}

/**
 * Tampilkan info backup terakhir di log.
 */
function checkBackupStatus() {
  var ss           = _getDB();
  var file         = DriveApp.getFileById(ss.getId());
  var parents      = file.getParents();
  if (!parents.hasNext()) { Logger.log('Tidak ada folder induk.'); return; }

  var backupFolder = _getOrCreateSubfolder(parents.next(), BACKUP_SUBFOLDER_NAME);
  var files        = _getBackupFiles(backupFolder);

  Logger.log('Subfolder backup : ' + backupFolder.getName() + ' (' + backupFolder.getId() + ')');
  Logger.log('Jumlah backup    : ' + files.length + ' (maks ' + BACKUP_KEEP_COUNT + ')');
  if (files.length > 0) {
    Logger.log('Backup terbaru   : ' + files[0].getName());
    Logger.log('Backup terlama   : ' + files[files.length - 1].getName());
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _getOrCreateSubfolder(parentFolder, name) {
  var it = parentFolder.getFoldersByName(name);
  if (it.hasNext()) return it.next();
  var newFolder = parentFolder.createFolder(name);
  Logger.log('Subfolder baru dibuat: ' + name);
  return newFolder;
}

function _getBackupFiles(folder) {
  var it    = folder.getFilesByName;
  var files = [];
  var allIt = folder.getFiles();
  while (allIt.hasNext()) {
    var f = allIt.next();
    if (f.getName().indexOf(BACKUP_FILE_PREFIX) === 0) files.push(f);
  }
  // Urutkan dari terbaru ke terlama berdasarkan nama (format tanggal sortable)
  files.sort(function(a, b) {
    return b.getName().localeCompare(a.getName());
  });
  return files;
}

function _deleteOldBackups(folder) {
  var files = _getBackupFiles(folder);
  if (files.length <= BACKUP_KEEP_COUNT) return;
  var toDelete = files.slice(BACKUP_KEEP_COUNT);
  toDelete.forEach(function(f) {
    f.setTrashed(true);
    Logger.log('Backup lama dihapus: ' + f.getName());
  });
}
