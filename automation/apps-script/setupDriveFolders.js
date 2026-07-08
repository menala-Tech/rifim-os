/**
 * RIFIM OS — Drive Folder Setup
 * Jalankan setupDriveFolders() SATU KALI untuk membuat
 * seluruh struktur folder di Google Drive.
 *
 * Struktur yang dibuat:
 * 📁 [Root RIFIM OS]
 *   └── 📁 Dokumen
 *         ├── 📁 Surat
 *         │     └── 📁 Juli 2026   ← dibuat otomatis saat dokumen digenerate
 *         ├── 📁 Invoice
 *         ├── 📁 Kwitansi
 *         ├── 📁 Proposal
 *         ├── 📁 Company Profile
 *         ├── 📁 MOU
 *         ├── 📁 Perjanjian Kerjasama
 *         ├── 📁 Kontrak Karyawan  ← PKWT, SPG, SMT, PI
 *         ├── 📁 Surat Peringatan  ← SP1, SP2, SP3, PHK
 *         ├── 📁 Berita Acara
 *         └── 📁 Form Checklist
 */

// ── ID folder root RIFIM OS di Google Drive ──────────────────
const DRIVE_ROOT_FOLDER_ID = '19taBn0YXxjXTb-SxqFXGhwOPShZ4VlIt';

// ── Nama-nama subfolder per kategori dokumen ─────────────────
const DOC_TYPE_FOLDERS = [
  'Surat',
  'Invoice',
  'Kwitansi',
  'Proposal',
  'Company Profile',
  'MOU',
  'Perjanjian Kerjasama',
  'Kontrak Karyawan',
  'Surat Peringatan',
  'Berita Acara',
  'Form Checklist',
];

// ── Mapping kode dokumen → nama folder ───────────────────────
const DOC_CODE_TO_FOLDER = {
  SURAT: 'Surat',
  ST:    'Surat',
  SIZ:   'Surat',
  SKT:   'Surat',
  INV:   'Invoice',
  KWT:   'Kwitansi',
  PROP:  'Proposal',
  CP:    'Company Profile',
  MOU:   'MOU',
  PKS:   'Perjanjian Kerjasama',
  PKWT:  'Kontrak Karyawan',
  SPG:   'Kontrak Karyawan',
  SMT:   'Kontrak Karyawan',
  PI:    'Kontrak Karyawan',
  SP1:   'Surat Peringatan',
  SP2:   'Surat Peringatan',
  SP3:   'Surat Peringatan',
  PHK:   'Surat Peringatan',
  BA:    'Berita Acara',
  FCO:   'Form Checklist',
};


/**
 * Fungsi utama — jalankan satu kali dari Apps Script editor.
 */
function setupDriveFolders() {
  var root     = DriveApp.getFolderById(DRIVE_ROOT_FOLDER_ID);
  var dokumen  = _getOrCreateFolder(root, 'Dokumen');

  var folderIds = { root: DRIVE_ROOT_FOLDER_ID, dokumen: dokumen.getId() };

  Logger.log('📁 Root     : ' + root.getName() + ' (' + root.getId() + ')');
  Logger.log('📁 Dokumen  : ' + dokumen.getName() + ' (' + dokumen.getId() + ')');

  DOC_TYPE_FOLDERS.forEach(function(name) {
    var sub = _getOrCreateFolder(dokumen, name);
    folderIds[name] = sub.getId();
    Logger.log('  📁 ' + name + ' → ' + sub.getId());
  });

  // Simpan semua folder ID ke company_config
  _saveFolderIdsToConfig(folderIds);

  Logger.log('=================================================');
  Logger.log('✅ Folder Drive berhasil dibuat!');
  Logger.log('📁 Root    : ' + root.getName() + ' (' + root.getId() + ')');
  Logger.log('📁 Dokumen : ' + dokumen.getId());
  Logger.log('Total subfolder: ' + DOC_TYPE_FOLDERS.length);
  Logger.log('Subfolder bulan dibuat OTOMATIS saat dokumen digenerate.');
  Logger.log('=================================================');
}


/**
 * Simpan folder IDs ke sheet company_config.
 * @private
 */
function _saveFolderIdsToConfig(folderIds) {
  var ss    = _getDB();
  var sheet = ss.getSheetByName('company_config');

  // Jika sheet belum ada (setupRIFIMDatabase() belum dijalankan), buat dulu
  if (!sheet) {
    Logger.log('⚠️ Sheet company_config tidak ditemukan — membuat sheet baru...');
    sheet = ss.insertSheet('company_config');
    sheet.appendRow(['key', 'value', 'description']);
    sheet.getRange(1, 1, 1, 3).setBackground('#C40000').setFontColor('#FFFFFF').setFontWeight('bold');
    Logger.log('✅ Sheet company_config berhasil dibuat');
  }

  var data = sheet.getDataRange().getValues();

  var updates = {
    'drive_root_folder_id':    folderIds['root'],
    'drive_dokumen_folder_id': folderIds['dokumen'],
    'drive_folder_surat':      folderIds['Surat']           || '',
    'drive_folder_invoice':    folderIds['Invoice']         || '',
    'drive_folder_kwitansi':   folderIds['Kwitansi']        || '',
    'drive_folder_proposal':   folderIds['Proposal']        || '',
    'drive_folder_cp':         folderIds['Company Profile'] || '',
    'drive_folder_mou':        folderIds['MOU']             || '',
    'drive_folder_pks':        folderIds['Perjanjian Kerjasama'] || '',
    'drive_folder_kontrak':    folderIds['Kontrak Karyawan']    || '',
    'drive_folder_sp':         folderIds['Surat Peringatan']    || '',
    'drive_folder_ba':         folderIds['Berita Acara']        || '',
    'drive_folder_fco':        folderIds['Form Checklist']      || '',
  };

  // Update baris yang sudah ada, tambah yang belum ada
  var existing = {};
  for (var i = 1; i < data.length; i++) {
    existing[data[i][0]] = i + 1; // key → row number (1-based)
  }

  Object.keys(updates).forEach(function(key) {
    if (existing[key]) {
      // Update nilai di baris yang sudah ada
      sheet.getRange(existing[key], 2).setValue(updates[key]);
    } else {
      // Tambah baris baru
      sheet.appendRow([key, updates[key], 'ID folder Google Drive — set by setupDriveFolders()']);
    }
  });

  Logger.log('✅ Folder IDs tersimpan ke company_config');
}


/**
 * Helper: ambil atau buat subfolder dalam parent.
 * @private
 */
function _getOrCreateFolder(parentFolder, name) {
  var it = parentFolder.getFoldersByName(name);
  if (it.hasNext()) return it.next();
  return parentFolder.createFolder(name);
}
