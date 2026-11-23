// Dashboard Keuangan MENALA - entry point
// Fetch data dari Apps Script, cache ke localStorage, render 4 kartu + net flow.

import { CONFIG } from './config.js';
import { saveCache, loadCache, loadStaleCache } from './cache.js';
import { renderCard, renderSkeleton } from './components/card.js';
import { showDrillDown } from './components/drill-down.js';

// ------- Util -------
export function formatRupiah(angka) {
  return 'Rp ' + Number(angka || 0).toLocaleString('id-ID');
}

function formatWaktu(iso) {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    return d.toLocaleString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch (e) { return iso; }
}

// ------- Fetch -------
let lastFetchMs = 0;
async function ambilDataDariAPI() {
  const res = await fetch(CONFIG.API_URL, { cache: 'no-store' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const json = await res.json();
  if (!json || json.ok !== true) {
    throw new Error((json && json.error) || 'Response tidak valid');
  }
  return json;
}

async function muatData({ force = false } = {}) {
  // Loading state - skeleton
  renderLoading();

  // Pakai cache dulu kalau ada & tidak force
  const cached = loadCache();
  if (cached && !force) {
    renderDashboard(cached, { fromCache: true });
  }

  try {
    const fresh = await ambilDataDariAPI();
    lastFetchMs = Date.now();
    saveCache(fresh);
    renderDashboard(fresh, { fromCache: false });
  } catch (err) {
    console.warn('Fetch gagal:', err.message);
    const stale = cached || loadStaleCache();
    if (stale) {
      renderDashboard(stale, { fromCache: true, stale: true, error: err.message });
    } else {
      renderError(err.message);
    }
  }
}

// ------- Render -------
function renderLoading() {
  document.getElementById('periode').textContent = 'memuat…';
  const container = document.getElementById('cards');
  container.innerHTML = '';
  for (let i = 0; i < 4; i++) container.appendChild(renderSkeleton());
  document.getElementById('net-flow').innerHTML =
    '<p class="label">Net Flow Estimasi 30 Hari</p><p class="value skeleton-line"></p>';
}

function renderError(msg) {
  const container = document.getElementById('cards');
  container.innerHTML = `
    <div class="error-state">
      <p><strong>Gagal memuat data.</strong></p>
      <p class="delta">${msg}</p>
      <button class="btn-ghost" id="retry">Coba lagi</button>
    </div>`;
  document.getElementById('retry').addEventListener('click', () => muatData({ force: true }));
  document.getElementById('net-flow').innerHTML = '';
}

function renderDashboard(payload, meta = {}) {
  const data = payload.data || payload; // backward compat
  const updatedAt = payload.updated_at;

  const periodeText = (meta.stale ? '⚠ offline · ' : '') +
    (data.periode || formatWaktu(updatedAt));
  document.getElementById('periode').textContent = periodeText;

  const cards = [
    { id: 'pemasukan',       label: 'Pemasukan (Bulan Berjalan)',    value: data.pemasukan,        variant: 'income' },
    { id: 'pengeluaran',     label: 'Pengeluaran (Bulan Berjalan)',  value: data.pengeluaran,      variant: 'expense' },
    { id: 'est-pendapatan',  label: 'Estimasi Pendapatan 30 Hari',   value: data.estPendapatan,    variant: 'proj-income',  delta: 'WMA 3 bulan + kontrak' },
    { id: 'est-pengeluaran', label: 'Estimasi Pengeluaran 30 Hari',  value: data.estPengeluaran,   variant: 'proj-expense', delta: 'Termasuk gaji & sewa' }
  ];

  const container = document.getElementById('cards');
  container.innerHTML = '';
  cards.forEach((c) => {
    const el = renderCard(c, formatRupiah);
    el.addEventListener('click', () => showDrillDown(c, data, formatRupiah));
    container.appendChild(el);
  });

  const netFlow = (data.estPendapatan || 0) - (data.estPengeluaran || 0);
  const netEl = document.getElementById('net-flow');
  netEl.className = 'net-flow-card ' + (netFlow >= 0 ? 'positive' : 'negative');
  netEl.innerHTML = `
    <p class="label">Net Flow Estimasi 30 Hari</p>
    <p class="value">${formatRupiah(netFlow)}</p>
    <p class="delta">Terakhir diperbarui: ${formatWaktu(updatedAt)}</p>
  `;
}

// ------- Bootstrap -------
document.getElementById('btn-refresh').addEventListener('click', () => muatData({ force: true }));
muatData();

// Auto-refresh berkala
setInterval(() => muatData({ force: true }), CONFIG.REFRESH_INTERVAL_MS);

// Re-fetch saat tab kembali visible, dengan debounce 30 detik.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (Date.now() - lastFetchMs < 30_000) return;
  muatData({ force: true });
});
