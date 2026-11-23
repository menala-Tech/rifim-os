# Dashboard Keuangan MENALA

PWA ringan untuk menampilkan 4 metrik keuangan utama MENALA/RIFIM (tanpa data cabang SOETA).

## Fitur

- **4 Kartu Metrik**: Pemasukan aktual, Pengeluaran aktual, Estimasi pendapatan 30 hari, Estimasi pengeluaran 30 hari.
- **Footer Net Flow**: Selisih estimasi pendapatan − estimasi pengeluaran.
- **Drill-down**: Tap kartu → rincian per cabang + tren 14 hari + transaksi terbaru.
- **Offline-capable**: Service worker cache shell + localStorage cache (TTL 1 jam) untuk data.
- **Auto-refresh**: setiap 5 menit + saat tab kembali visible.
- **Installable**: Manifest PWA + ikon 192/512.
- **EXCLUDE SOETA**: subdivision yang mengandung kata "Soeta" di-exclude; sisanya (termasuk Head Office, Operasional, dsb.) di-agregasi.

## Struktur

```
dashboard-keuangan-menala/
├── public/           # shell PWA statis
│   ├── index.html
│   ├── manifest.json
│   ├── sw.js
│   └── icons/
├── src/
│   ├── app.js        # entry point (fetch + cache + render)
│   ├── config.js     # template konfigurasi
│   ├── cache.js      # localStorage cache (TTL 1 jam)
│   ├── styles.css
│   └── components/
│       ├── card.js
│       └── drill-down.js
├── backend/
│   └── Code.gs       # Google Apps Script endpoint
└── docs/
    └── README.md
```

## Setup Google Apps Script Web App

1. Buka [script.google.com](https://script.google.com) → **New Project** → rename `Dashboard Keuangan MENALA`.
2. Paste isi `backend/Code.gs` ke editor.
3. Isi `SHEET_ID` di baris paling atas dengan ID spreadsheet **MENALA_LAPORAN**. Ambil dari URL:
   ```
   https://docs.google.com/spreadsheets/d/{SHEET_ID_INI_YANG_DISALIN}/edit
   ```
4. Jalankan fungsi `agregasiLengkap` sekali untuk authorize scope (Drive + Spreadsheet).
5. Jalankan `setupTrigger` sekali untuk pasang trigger 5 menit + onEdit.
6. **Deploy > New deployment**:
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
7. Salin URL yang berbentuk `https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec`.

### Test endpoint manual

Buka URL di browser - harus return JSON dengan `"ok": true`.

```json
{
  "ok": true,
  "updated_at": "2026-11-23T22:00:00+07:00",
  "data": { "pemasukan": 29850000, "pengeluaran": 19380000, ... }
}
```

## Isi Config Frontend

Buka `src/config.js` dan ganti `API_URL`:

```js
export const CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbxxxxxxx/exec',
  ...
};
```

## Jalankan Lokal

```powershell
npm run dev
```

Buka `http://localhost:5173`. Kalau `API_URL` masih `REPLACE_ME`, dashboard akan tampilkan error state + tombol "Coba lagi".

## Deploy ke Vercel

- Framework preset: **Other**
- Output directory: `public`
- Build command: *(kosongkan)*

File `src/` di-import oleh `public/index.html` via `<script type="module" src="../src/app.js">`. Vercel akan serve seluruh root repo, jadi path relatif tetap berfungsi.

## Dokumentasi Arsitektur Lengkap

Lihat `D:\MENALA\MENALA-KNOWLEDGE\05 - APLIKASI DAN SISTEM\Dashboard-Keuangan\`:
- `00-Overview.md`
- `01-Arsitektur-Data.md`
- `02-Spesifikasi-UI.md`
- `03-API-Contract.md`
- `04-Rumus-Estimasi.md`
- `05-Deployment-Guide.md`
