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
