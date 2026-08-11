/**
 * RIFIM OS — Canonical Drive Storage V4
 *
 * Satu resolver untuk SEMUA writer Google Drive di RIFIM OS.
 * Layout canonical:
 *   <MODULE_ROOT>/<YYYY>/<MM_Bulan>/<JENIS_DATA>/...
 * dan untuk database perusahaan:
 *   <COMPANY_ROOT>/<YYYY>/<MM_Bulan>/<JENIS_DATA>/...
 *
 * company_config adalah SSOT untuk seluruh root folder. Tidak ada hard-code
 * folder tujuan di writer modul. Folder tahun/bulan/jenis dibuat idempotent.
 */

var CANONICAL_DRIVE_LAYOUT_VERSION = '2.0-monthly-canonical';

var CANONICAL_DRIVE_MODULE_KEYS = {
  crm:          'drive_module_crm_folder_id',
  smart_office: 'drive_module_smart_office_folder_id',
  hris:         'drive_module_hris_folder_id',
  finance:      'drive_module_finance_folder_id',
  payroll:      'drive_module_payroll_folder_id',
  kpi:          'drive_module_kpi_folder_id',
  master_data:  'drive_module_master_data_folder_id',
  raos_pwa:     'drive_module_raos_pwa_folder_id',
  portal:       'drive_module_portal_folder_id',
  driver:       'drive_module_driver_folder_id',
  absensi:      'drive_module_absensi_folder_id',
  cuti:         'drive_module_cuti_folder_id'
};

var CANONICAL_DRIVE_COMPANY_KEYS = {
  RIFIM:  'drive_company_rifim_folder_id',
  MENALA: 'drive_company_menala_folder_id',
  MIG:    'drive_company_menala_folder_id',
  LAILAN: 'drive_company_lailan_folder_id'
};

var CANONICAL_DRIVE_DATA_FOLDERS = {
  foto_absensi:       '01_FOTO_ABSENSI',
  data_tabel:         '02_DATA_TABEL',
  pdf:                '03_PDF',
  backup_spreadsheet: '04_BACKUP_SPREADSHEET',
  database_staff:     '05_DATABASE_STAFF',
  database_driver:    '06_DATABASE_DRIVER',
  database_keuangan:  '07_DATABASE_KEUANGAN',
  database_cuti:      '08_DATABASE_CUTI',
  database_payroll:   '09_DATABASE_PAYROLL',
  semua_database:     '10_SEMUA_DATABASE',
  media_karyawan:     '11_MEDIA_KARYAWAN'
};

var CANONICAL_DRIVE_MONTHS_ID = [
  'Januari','Februari','Maret','April','Mei','Juni',
  'Juli','Agustus','September','Oktober','November','Desember'
];

function canonicalDriveNormalizeModuleKey_(value) {
  var key = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  var aliases = {
    smartoffice: 'smart_office',
    master: 'master_data',
    masterdata: 'master_data',
    raos: 'raos_pwa',
    pwa_raos: 'raos_pwa',
    attendance: 'absensi',
    leave: 'cuti'
  };
  return aliases[key] || key;
}

function canonicalDriveNormalizeDataType_(value) {
  var key = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  var aliases = {
    foto: 'foto_absensi',
    attendance_photo: 'foto_absensi',
    table: 'data_tabel',
    tables: 'data_tabel',
    csv: 'data_tabel',
    json: 'data_tabel',
    spreadsheet_backup: 'backup_spreadsheet',
    backup: 'backup_spreadsheet',
    staff: 'database_staff',
    driver: 'database_driver',
    finance: 'database_keuangan',
    keuangan: 'database_keuangan',
    cuti: 'database_cuti',
    payroll: 'database_payroll',
    all_database: 'semua_database',
    database_all: 'semua_database',
    employee_media: 'media_karyawan',
    hris_media: 'media_karyawan'
  };
  return aliases[key] || key;
}

function canonicalDriveGetConfig_() {
  if (typeof getCompanyConfig !== 'function') {
    throw new Error('getCompanyConfig() tidak tersedia; canonical storage wajib memakai company_config SSOT');
  }
  var cfg = getCompanyConfig() || {};
  var version = String(cfg.drive_storage_layout_version || '').trim();
  if (version && version !== CANONICAL_DRIVE_LAYOUT_VERSION) {
    throw new Error('Versi layout Drive tidak sesuai: ' + version + ' (expected ' + CANONICAL_DRIVE_LAYOUT_VERSION + ')');
  }
  return cfg;
}

function canonicalDriveRequiredFolderId_(cfg, configKey) {
  var id = String(cfg[configKey] || '').trim();
  if (!id) throw new Error('company_config.' + configKey + ' belum diisi');
  return id;
}

function canonicalDriveGetOrCreateFolder_(parent, name) {
  var safe = String(name || '').trim();
  if (!safe) throw new Error('Nama folder kosong');
  var it = parent.getFoldersByName(safe);
  if (it.hasNext()) return it.next();
  return parent.createFolder(safe);
}

function canonicalDriveMonthParts_(when) {
  var d = when instanceof Date ? when : (when ? new Date(when) : new Date());
  if (isNaN(d.getTime())) throw new Error('Tanggal storage tidak valid: ' + when);
  var year = String(d.getFullYear());
  var monthIndex = d.getMonth();
  var monthNo = ('0' + String(monthIndex + 1)).slice(-2);
  return {
    year: year,
    month: monthNo + '_' + CANONICAL_DRIVE_MONTHS_ID[monthIndex],
    date: d
  };
}

function canonicalDriveModuleRoot_(moduleKey, cfg) {
  var normalized = canonicalDriveNormalizeModuleKey_(moduleKey);
  var configKey = CANONICAL_DRIVE_MODULE_KEYS[normalized];
  if (!configKey) throw new Error('Module storage tidak dikenal: ' + moduleKey);
  var id = canonicalDriveRequiredFolderId_(cfg || canonicalDriveGetConfig_(), configKey);
  return DriveApp.getFolderById(id);
}

function canonicalDriveCompanyRoot_(companyCode, cfg) {
  var code = String(companyCode || '').trim().toUpperCase();
  var configKey = CANONICAL_DRIVE_COMPANY_KEYS[code];
  if (!configKey) throw new Error('Company storage tidak dikenal: ' + companyCode);
  var id = canonicalDriveRequiredFolderId_(cfg || canonicalDriveGetConfig_(), configKey);
  return DriveApp.getFolderById(id);
}

function canonicalDriveDataFolderName_(dataType) {
  var normalized = canonicalDriveNormalizeDataType_(dataType);
  var name = CANONICAL_DRIVE_DATA_FOLDERS[normalized];
  if (!name) throw new Error('Jenis data storage tidak dikenal: ' + dataType);
  return name;
}

function canonicalDriveMonthFolderFromRoot_(rootFolder, dataType, when) {
  var parts = canonicalDriveMonthParts_(when);
  var yearFolder = canonicalDriveGetOrCreateFolder_(rootFolder, parts.year);
  var monthFolder = canonicalDriveGetOrCreateFolder_(yearFolder, parts.month);
  var dataFolder = canonicalDriveGetOrCreateFolder_(monthFolder, canonicalDriveDataFolderName_(dataType));
  return dataFolder;
}

function canonicalDriveGetMonthFolder(moduleKey, dataType, when) {
  var cfg = canonicalDriveGetConfig_();
  return canonicalDriveMonthFolderFromRoot_(canonicalDriveModuleRoot_(moduleKey, cfg), dataType, when);
}

function canonicalDriveGetCompanyMonthFolder(companyCode, dataType, when) {
  var cfg = canonicalDriveGetConfig_();
  return canonicalDriveMonthFolderFromRoot_(canonicalDriveCompanyRoot_(companyCode, cfg), dataType, when);
}

function canonicalDriveGetModuleSubfolder(moduleKey, dataType, subfolderName, when) {
  var parent = canonicalDriveGetMonthFolder(moduleKey, dataType, when);
  return subfolderName ? canonicalDriveGetOrCreateFolder_(parent, subfolderName) : parent;
}

function canonicalDriveSaveBlob(moduleKey, dataType, blob, fileName, when, subfolderName) {
  if (!blob) throw new Error('Blob wajib');
  var folder = canonicalDriveGetModuleSubfolder(moduleKey, dataType, subfolderName, when);
  if (fileName) blob = blob.copyBlob().setName(String(fileName));
  return folder.createFile(blob);
}

function canonicalDriveMoveFile(moduleKey, dataType, file, when, subfolderName) {
  if (!file || typeof file.moveTo !== 'function') throw new Error('Drive file wajib');
  var folder = canonicalDriveGetModuleSubfolder(moduleKey, dataType, subfolderName, when);
  file.moveTo(folder);
  return file;
}

function canonicalDriveSaveJson(moduleKey, objectValue, fileName, when, subfolderName) {
  var name = fileName || ('data-' + Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyyMMdd-HHmmss') + '.json');
  var blob = Utilities.newBlob(JSON.stringify(objectValue == null ? null : objectValue, null, 2), 'application/json', name);
  return canonicalDriveSaveBlob(moduleKey, 'data_tabel', blob, name, when, subfolderName);
}

function canonicalDriveSaveCsv(moduleKey, csvText, fileName, when, subfolderName) {
  var name = fileName || ('table-' + Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyyMMdd-HHmmss') + '.csv');
  var blob = Utilities.newBlob(String(csvText || ''), 'text/csv', name);
  return canonicalDriveSaveBlob(moduleKey, 'data_tabel', blob, name, when, subfolderName);
}

function canonicalDriveBackupSpreadsheet(spreadsheetId, moduleKey, when) {
  var source = DriveApp.getFileById(String(spreadsheetId));
  var folder = canonicalDriveGetMonthFolder(moduleKey || 'master_data', 'backup_spreadsheet', when);
  var stamp = Utilities.formatDate(when instanceof Date ? when : new Date(), 'Asia/Jakarta', 'yyyyMMdd-HHmmss');
  return source.makeCopy(source.getName() + ' BACKUP ' + stamp, folder);
}

function canonicalDriveBackupMasterSpreadsheet(when) {
  var cfg = canonicalDriveGetConfig_();
  var ssId = String(cfg.raos_ss_id || '').trim();
  if (!ssId) throw new Error('company_config.raos_ss_id belum diisi');
  var rootId = canonicalDriveRequiredFolderId_(cfg, 'drive_backup_spreadsheet_folder_id');
  var root = DriveApp.getFolderById(rootId);
  var parts = canonicalDriveMonthParts_(when);
  var yearFolder = canonicalDriveGetOrCreateFolder_(root, parts.year);
  var monthFolder = canonicalDriveGetOrCreateFolder_(yearFolder, parts.month);
  var source = DriveApp.getFileById(ssId);
  var stamp = Utilities.formatDate(parts.date, 'Asia/Jakarta', 'yyyyMMdd-HHmmss');
  return source.makeCopy(source.getName() + ' BACKUP ' + stamp, monthFolder);
}

function canonicalDriveSaveCompanyBlob(companyCode, dataType, blob, fileName, when, subfolderName) {
  if (!blob) throw new Error('Blob wajib');
  var base = canonicalDriveGetCompanyMonthFolder(companyCode, dataType, when);
  var folder = subfolderName ? canonicalDriveGetOrCreateFolder_(base, subfolderName) : base;
  if (fileName) blob = blob.copyBlob().setName(String(fileName));
  return folder.createFile(blob);
}

function canonicalDriveEnsureMonthLayout(moduleKey, when) {
  var created = [];
  Object.keys(CANONICAL_DRIVE_DATA_FOLDERS).forEach(function(dataType) {
    // media_karyawan hanya HRIS; jangan buat di semua modul kecuali diminta writer.
    if (dataType === 'media_karyawan') return;
    var folder = canonicalDriveGetMonthFolder(moduleKey, dataType, when);
    created.push({ data_type: dataType, id: folder.getId(), name: folder.getName() });
  });
  return created;
}

function canonicalDriveEnsureAllModulesMonth(when) {
  var out = {};
  Object.keys(CANONICAL_DRIVE_MODULE_KEYS).forEach(function(moduleKey) {
    out[moduleKey] = canonicalDriveEnsureMonthLayout(moduleKey, when);
  });
  return out;
}

function canonicalDriveEnsureCompanyMonth(companyCode, when) {
  var out = [];
  Object.keys(CANONICAL_DRIVE_DATA_FOLDERS).forEach(function(dataType) {
    if (dataType === 'media_karyawan') return;
    var folder = canonicalDriveGetCompanyMonthFolder(companyCode, dataType, when);
    out.push({ data_type: dataType, id: folder.getId(), name: folder.getName() });
  });
  return out;
}

function canonicalDriveEnsureAllCompaniesMonth(when) {
  return {
    RIFIM: canonicalDriveEnsureCompanyMonth('RIFIM', when),
    MENALA: canonicalDriveEnsureCompanyMonth('MENALA', when),
    LAILAN: canonicalDriveEnsureCompanyMonth('LAILAN', when)
  };
}

function canonicalDriveParentContains_(childFolder, parentId) {
  var parents = childFolder.getParents();
  while (parents.hasNext()) {
    if (parents.next().getId() === parentId) return true;
  }
  return false;
}

function canonicalDriveAudit() {
  var cfg = canonicalDriveGetConfig_();
  var issues = [];
  var checked = [];

  function checkFolder(configKey, expectedParentKey) {
    var id = String(cfg[configKey] || '').trim();
    if (!id) {
      issues.push({ key: configKey, code: 'MISSING_CONFIG', message: 'ID folder belum diisi' });
      return null;
    }
    try {
      var folder = DriveApp.getFolderById(id);
      var item = { key: configKey, id: id, name: folder.getName(), ok: true };
      if (expectedParentKey) {
        var parentId = String(cfg[expectedParentKey] || '').trim();
        if (!parentId || !canonicalDriveParentContains_(folder, parentId)) {
          item.ok = false;
          item.code = 'WRONG_PARENT';
          item.expected_parent_key = expectedParentKey;
          issues.push(item);
        }
      }
      checked.push(item);
      return folder;
    } catch (err) {
      var bad = { key: configKey, id: id, ok: false, code: 'NOT_FOUND', message: err.message || String(err) };
      issues.push(bad);
      checked.push(bad);
      return null;
    }
  }

  checkFolder('drive_root_folder_id', null);
  checkFolder('drive_archive_root_folder_id', 'drive_root_folder_id');
  checkFolder('drive_system_root_folder_id', 'drive_root_folder_id');
  checkFolder('drive_modules_root_folder_id', 'drive_root_folder_id');
  checkFolder('drive_database_3_company_root_folder_id', 'drive_root_folder_id');
  checkFolder('drive_spreadsheet_master_folder_id', 'drive_system_root_folder_id');
  checkFolder('drive_backup_spreadsheet_folder_id', 'drive_system_root_folder_id');
  checkFolder('drive_branding_folder_id', 'drive_system_root_folder_id');
  checkFolder('drive_templates_folder_id', 'drive_system_root_folder_id');
  checkFolder('drive_month_template_folder_id', 'drive_system_root_folder_id');

  Object.keys(CANONICAL_DRIVE_MODULE_KEYS).forEach(function(moduleKey) {
    checkFolder(CANONICAL_DRIVE_MODULE_KEYS[moduleKey], 'drive_modules_root_folder_id');
  });
  ['RIFIM','MENALA','LAILAN'].forEach(function(code) {
    checkFolder(CANONICAL_DRIVE_COMPANY_KEYS[code], 'drive_database_3_company_root_folder_id');
  });

  var version = String(cfg.drive_storage_layout_version || '').trim();
  if (version !== CANONICAL_DRIVE_LAYOUT_VERSION) {
    issues.push({ key: 'drive_storage_layout_version', ok: false, code: 'VERSION_MISMATCH', value: version, expected: CANONICAL_DRIVE_LAYOUT_VERSION });
  }

  return {
    success: true,
    healthy: issues.length === 0,
    layout_version: version,
    expected_layout_version: CANONICAL_DRIVE_LAYOUT_VERSION,
    checked: checked.length,
    issues: issues,
    items: checked
  };
}
