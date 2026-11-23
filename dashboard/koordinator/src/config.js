// Konfigurasi dashboard. API_URL harus di-set ke Web App Google Apps Script
// yang baru di-deploy. Jangan commit URL produksi ke repo publik — kalau URL ini
// bocor, ganti deployment-nya (/exec baru) dan update di sini.

export const CONFIG = {
  // URL Web App Google Apps Script. Isi setelah deploy.
  // Format: https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec
  API_URL: 'https://script.google.com/macros/s/AKfycbxYKrPEt_cfbDyK_UOb5gIriRwSP3hwago3uneoSlXjfNYrHOcXE6oYVSigXhD0ItESow/exec',

  // Interval auto-refresh di sisi client (ms). 5 menit = 300000.
  REFRESH_INTERVAL_MS: 300_000,

  // Key untuk cache di localStorage.
  CACHE_KEY: 'menala_dashboard_cache',

  // TTL cache client (ms). 1 jam.
  CACHE_TTL_MS: 60 * 60 * 1000,

};

export default CONFIG;
