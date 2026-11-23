// Cache sederhana via localStorage dengan TTL.
// Dipakai sebagai fallback offline + loading cepat saat buka dashboard.

import { CONFIG } from './config.js';

const KEY = CONFIG.CACHE_KEY;
const TTL = CONFIG.CACHE_TTL_MS;

/**
 * Simpan payload JSON ke localStorage dengan timestamp.
 * @param {object} data - payload dari API (sudah termasuk .data + .updated_at)
 */
export function saveCache(data) {
  try {
    const entry = {
      saved_at: Date.now(),
      payload: data
    };
    localStorage.setItem(KEY, JSON.stringify(entry));
  } catch (err) {
    console.warn('saveCache gagal:', err.message);
  }
}

/**
 * Baca cache terakhir. Return null kalau tidak ada atau sudah expired.
 * @returns {object|null}
 */
export function loadCache() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (!entry || !entry.saved_at) return null;
    if (Date.now() - entry.saved_at > TTL) return null;
    return entry.payload;
  } catch (err) {
    console.warn('loadCache gagal:', err.message);
    return null;
  }
}

/**
 * Baca cache tanpa cek TTL - dipakai sebagai last-resort fallback offline
 * ketika TTL sudah lewat tapi kita masih mau tampilkan snapshot lama
 * dibanding kosong total.
 * @returns {object|null}
 */
export function loadStaleCache() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    return entry ? entry.payload : null;
  } catch (err) {
    return null;
  }
}

export function clearCache() {
  try { localStorage.removeItem(KEY); } catch (e) {}
}
