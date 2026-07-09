/**
 * RIFIM OS — Config Loader
 * Ambil konfigurasi perusahaan dari sheet company_config.
 * Semua nilai sensitif (folder ID, template ID) disimpan di sini.
 */

// ── ID Google Spreadsheet RIFIM OS Database ──────────────────
const SPREADSHEET_ID = '1jHeA-w1bM32S3-AU-ENN2UjiaCb4iLzRhaf4G7y4ozM';

/**
 * Helper: buka database RIFIM OS.
 * Dipakai oleh semua engine file agar tidak hardcode ID di mana-mana.
 * @returns {Spreadsheet}
 */
function _getDB() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

let _configCache = null;

/**
 * Ambil semua konfigurasi perusahaan.
 * Hasil di-cache selama satu eksekusi untuk efisiensi.
 * @returns {object} Key-value config object
 */
function getCompanyConfig() {
  if (_configCache) return _configCache;

  const ss    = _getDB();
  const sheet = ss.getSheetByName('company_config');

  if (!sheet) throw new Error('Sheet company_config tidak ditemukan.');

  const data   = sheet.getDataRange().getValues();
  const config = {};

  // Skip header row (row 0)
  for (let i = 1; i < data.length; i++) {
    const key   = data[i][0];
    const value = data[i][1];
    if (key) config[key] = value;
  }

  _configCache = config;
  return config;
}

/**
 * Reset cache (untuk testing atau update config).
 */
function resetConfigCache() {
  _configCache = null;
}

/**
 * Ambil daftar semua perusahaan dari sheet companies.
 * @returns {Array<object>}
 */
function getCompanies() {
  var sheet = _getDB().getSheetByName('companies');
  if (!sheet) return [];
  var data    = sheet.getDataRange().getValues();
  var headers = data[0];
  var list    = [];
  for (var i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    var company = {};
    headers.forEach(function(h, j) { company[String(h).trim()] = data[i][j]; });
    if (String(company.is_active).toUpperCase() !== 'FALSE') list.push(company);
  }
  return list;
}

/**
 * Ambil data satu perusahaan berdasarkan code.
 * @param {string} code  - RIFIM / MIG / LAILAN
 * @returns {object|null}
 */
function getCompanyByCode(code) {
  var list = getCompanies();
  for (var i = 0; i < list.length; i++) {
    if (String(list[i].code).trim() === String(code).trim()) return list[i];
  }
  return null;
}
