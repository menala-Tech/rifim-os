# CHANGELOG

> Semua perubahan signifikan pada proyek ini dicatat di sini.

Format mengikuti [Keep a Changelog](https://keepachangelog.com/).

---

## [Unreleased]

## [0.2.0] — 2026-07-10

### Added
- `engines/connectivity-engine.js` — Connectivity Engine reusable:
  - Network detection (online/offline monitor)
  - Offline queue berbasis IndexedDB (auto-enqueue saat signal putus)
  - Retry mechanism dengan exponential backoff (2s → 4s → 8s, max 3x)
  - Status banner otomatis (merah: offline, hijau: kembali online)
  - syncQueue() — auto-sync semua pending request saat online kembali
- `sw.js` — Service Worker PWA:
  - Cache First strategy untuk asset statis (HTML, JS, CSS, gambar)
  - Network First strategy untuk GAS API (script.google.com)
  - Fallback ke cache saat offline, fallback ke offline.html jika tidak ada cache
  - Auto clean old cache saat activate
- `offline.html` — Halaman fallback branded RIFIM saat tidak ada koneksi:
  - Auto-reload saat koneksi kembali
  - Tips troubleshooting untuk user
- `index.html` — Update: registrasi Service Worker otomatis saat halaman dimuat

### Research
- Domain `rifimgroup.com`: **TERSEDIA**, harga $11.25 USD/tahun (~Rp 185rb)
- Domain `rifim.com`: tidak tersedia (sudah diambil)
- Domain belum dibeli dan belum terhubung ke Vercel

### Notes
- PR #1: https://github.com/menala-Tech/rifim-os/pull/1 (draft)
- Vercel Preview: auto-deploy dari PR, status Ready
- Tidak memerlukan akses Google Apps Script untuk implementasi ini
- Connectivity Engine dapat langsung digunakan di semua modul:
  ```html
  <script src="/engines/connectivity-engine.js"></script>
  <script>
    ConnectivityEngine.init();
    ConnectivityEngine.fetch(GAS_URL, options); // ganti fetch() biasa
  </script>
  ```

### Next Steps
- [ ] Beli domain `rifimgroup.com`
- [ ] Hubungkan domain ke Vercel project `rifim-os`
- [ ] Merge PR #1 Connectivity Engine ke main
- [ ] Integrasikan Connectivity Engine ke modul Smart Office
- [ ] Deploy GAS (perlu laptop)

---

## [0.1.0] — 2026-07-09

### Added
- Inisialisasi Enterprise Repository structure
- README.md — gambaran umum proyek
- CLAUDE.md — operating manual untuk Claude Code
- PROJECT_RULES.md — aturan proyek
- CHANGELOG.md — catatan perubahan
- .gitignore — konfigurasi git ignore
- Seluruh struktur folder sesuai blueprint (77 folder)
- README placeholder untuk setiap folder utama

### Notes
- Sprint 0: Enterprise Foundation
- Belum ada business logic atau Apps Script
- Fase ini hanya foundation & dokumentasi
