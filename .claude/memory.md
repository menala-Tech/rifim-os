# RIFIM OS — Project Memory

> File ini dibaca otomatis oleh Claude Code di setiap sesi baru.
> Update file ini setiap ada perubahan signifikan.

Last Updated: 2026-07-10

---

## Identitas Proyek

| Field | Value |
|-------|-------|
| Nama | RIFIM OS — Enterprise Operating System |
| Perusahaan | PT. RIFIM Internasional Gemilang |
| Lokasi | Fanindo Blok S No. 20, Tanjung Uncang, Batu Aji, Kota Batam |
| Email | rifiminternasionalgemilang@gmail.com |
| WhatsApp | +62 821 7010 2349 |
| Website (target) | www.rifimgroup.com (belum dibeli) |
| Repo | https://github.com/menala-Tech/rifim-os |

---

## Perusahaan yang Dikelola

| Code | Nama Perusahaan |
|------|-----------------|
| RIFIM | PT. RIFIM Internasional Gemilang |
| MIG | (subsidiary) |
| LAILAN | (subsidiary) |

---

## Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Frontend | HTML + CSS + Vanilla JS (PWA) |
| Backend | Google Apps Script (GAS) |
| Database Phase 1 | Google Sheets |
| Database Phase 2 | Supabase PostgreSQL |
| Hosting | Vercel |
| Repository | GitHub (menala-Tech/rifim-os) |
| CI/CD GAS | GitHub Actions → clasp push |
| AI | Claude Code |

---

## Database

- **Google Spreadsheet ID**: `1jHeA-w1bM32S3-AU-ENN2UjiaCb4iLzRhaf4G7y4ozM`
- Diakses via `configLoader.js` → `getCompanyConfig()`
- Jangan hardcode ID ini di file lain

### Sheet yang Ada
- `company_config` — konfigurasi perusahaan (folder ID, template ID, dll)
- `companies` — daftar perusahaan (RIFIM, MIG, LAILAN)
- `documents` — log semua dokumen yang digenerate
- `employees` — data karyawan (HRIS)
- `activity_log` — log aktivitas semua modul

---

## GAS Deployment

- **Script ID**: `1IK8-2anrxahce1X1MG7Bi3aGe6e-_4e3obanTRprT6brYSdla9rEYOxp`
- **File**: `automation/apps-script/.clasp.json`
- **Deploy**: GitHub Actions auto-push saat ada commit ke `main` yang mengubah `automation/apps-script/**`
- **Secret dibutuhkan**: `CLASPRC_JSON` di GitHub Secrets (credential clasp)
- **Web App URL**: disimpan di sheet `company_config` dengan key `gas_web_app_url`
- **Access**: Anyone (no auth) — auth dilakukan di layer GAS sendiri

### Cara Deploy Manual (perlu laptop)
```bash
cd automation/apps-script
clasp login
clasp push --force
# Lalu di Google Apps Script → Deploy → Manage Deployments → Update
```

---

## GAS Engines (semua di `automation/apps-script/`)

| File | Fungsi | Status |
|------|--------|--------|
| `configLoader.js` | Load config dari Sheets, cache per eksekusi | ✅ Done |
| `documentEngine.js` | Generate semua jenis dokumen dari template | ✅ Done |
| `documentTypes.js` | Registry semua tipe dokumen + config-nya | ✅ Done |
| `numberingEngine.js` | Auto-generate nomor dokumen berformat | ✅ Done |
| `placeholderEngine.js` | Replace `{{PLACEHOLDER}}` di template Google Docs | ✅ Done |
| `driveManager.js` | Kelola folder & file di Google Drive | ✅ Done |
| `databaseLayer.js` | Abstraksi akses Google Sheets (CRUD) | ✅ Done |
| `notificationEngine.js` | Kirim email & WhatsApp notifikasi | ✅ Done |
| `authEngine.js` | Auth & RBAC (ADMIN > DIREKTUR > KOORDINATOR > STAFF > DRIVER) | ✅ Done |
| `hrisLayer.js` | CRUD karyawan, absensi, cuti, gaji | ✅ Done |
| `hrisSyncLayer.js` | Sync data karyawan ke Spreadsheet | ✅ Done |
| `backupEngine.js` | Backup otomatis spreadsheet ke Drive | ✅ Done |
| `setupDatabase.js` | Setup sheet awal (jalankan sekali) | ✅ Done |
| `setupDriveFolders.js` | Setup folder Drive (jalankan sekali) | ✅ Done |
| `setupTemplates.js` | Setup template dokumen (jalankan sekali) | ✅ Done |
| `setupCompanies.js` | Setup data perusahaan awal (jalankan sekali) | ✅ Done |
| `webApp.js` | Entry point `doPost()` — routing semua request | ✅ Done |

### Format Nomor Dokumen
```
[SEQ]/[COMPANY]-[TYPE]/[BULAN-ROMAWI]/[TAHUN]
Contoh: 001/RIFIM/SURAT/VII/2026
        045/RIG-ADV/INV/VI/2026
```

---

## Frontend Modules (Vercel)

| URL Path | File | Status |
|----------|------|--------|
| `/` | `index.html` | ✅ Landing page RIFIM Group |
| `/portal` | `modules/portal/index.html` | ✅ Portal utama (login + navigasi modul) |
| `/smart-office` | `modules/smart-office/index.html` | ✅ Generate dokumen (surat, invoice, PKWT, dll) |
| `/hris` | `modules/hris/index.html` | ✅ Manajemen karyawan |
| `/offline` | `offline.html` | ✅ Fallback offline |

### Alur Login
1. User masuk portal `/portal` atau modul langsung
2. Input email → call GAS `authVerifyUser(email)`
3. GAS cek `allowed_emails` di config → lalu cek Supabase
4. Return `{ success, user: { email, full_name, role, company_code } }`
5. Session disimpan di `sessionStorage`

### GAS_WEB_APP_URL
- Setiap module HTML punya variabel `GAS_WEB_APP_URL`
- Nilainya diambil dari sheet `company_config` key `gas_web_app_url`
- Atau di-hardcode sementara selama development
- **WAJIB diupdate setiap kali deploy baru di GAS**

---

## Frontend Engines (Browser)

| File | Fungsi | Status |
|------|--------|--------|
| `engines/connectivity-engine.js` | Network detect, offline queue (IndexedDB), retry backoff | ✅ Done (PR #1) |
| `sw.js` | Service Worker — Cache First + Network First | ✅ Done (PR #1) |
| `offline.html` | Halaman offline branded | ✅ Done (PR #1) |

### Cara Pakai Connectivity Engine
```html
<script src="/engines/connectivity-engine.js"></script>
<script>
  ConnectivityEngine.init();
  // Ganti fetch() biasa:
  ConnectivityEngine.fetch(GAS_WEB_APP_URL, { method: 'POST', body: JSON.stringify(data) });
  // Events:
  ConnectivityEngine.on('offline', () => { /* tampilkan warning */ });
  ConnectivityEngine.on('sync-done', ({ synced, total }) => { /* notifikasi */ });
</script>
```

---

## Document Templates (semua di `templates/smart-office/`)

| Template | File | Status |
|----------|------|--------|
| Surat | `surat/surat-template.html` | ✅ |
| Invoice | `invoice/invoice-template.html` | ✅ |
| Kwitansi | `kwitansi/kwitansi-template.html` | ✅ |
| MOU | `mou/mou-template.html` | ✅ |
| PKWT | `pkwt/pkwt-template.html` | ✅ |
| Proposal | `proposal/proposal-template.html` | ✅ |
| Surat Peringatan 1 | `sp/sp1-template.html` | ✅ |
| Surat Peringatan 2 | `sp/sp2-template.html` | ✅ |
| Surat Peringatan 3 | `sp/sp3-template.html` | ✅ |
| Berita Acara | `berita-acara/berita-acara-template.html` | ✅ |
| Surat Tugas | `surat-tugas/surat-tugas-template.html` | ✅ |
| Surat Keterangan | `surat-keterangan/surat-keterangan-template.html` | ✅ |
| Surat Izin | `surat-izin/surat-izin-template.html` | ✅ |
| Surat Mutasi | `surat-mutasi/surat-mutasi-template.html` | ✅ |
| Surat Pengangkatan | `surat-pengangkatan/surat-pengangkatan-template.html` | ✅ |
| Surat PHK | `surat-phk/surat-phk-template.html` | ✅ |
| PKS | `perjanjian-kerjasama/pks-template.html` | ✅ |
| Pakta Integritas | `pakta-integritas/pakta-integritas-template.html` | ✅ |
| Form Checklist | `form-checklist/form-checklist-template.html` | ✅ |
| Company Profile | `company-profile/company-profile-template.html` | ✅ |

---

## Vercel Projects

| Project | ID | URL |
|---------|----|-----|
| rifim-os | `prj_S4XfkcurSujcUHHc2tWg0hTthZjn` | rifim-os.vercel.app |
| isi_saldo | `prj_C6u1DohbiwhjdwzO4PvBC4YeI43A` | — |
| rifim-monitor-saldo | `prj_Vg84iuBuw8Cj2iXZqqFZEsWwoOO2` | — |
| rifim-monitor-koordinator | `prj_qo8wftEaAHdJwlAQhAtnn1Dqo634` | — |
| document-center | `prj_ohpiBeJNbsa8ZDtHpjTwloyQMXG7` | — |
| rifim-finance-pwa | `prj_uhUcrbBDZMpn9WKNNRhDoboWuVMi` | — |
| rifim-monitor-order | `prj_aeqHuJBRFl2WovJySImM5YTAx26B` | — |
| raos | `prj_z7JfXHFSvbpiIYWjzGiFy0FtLKKs` | — |
| radms-driver | `prj_dny34CacqE4gNyMgxfXq5yptPRyG` | — |
| radms-dashboard | `prj_NfcN1dxUxTVAPgoe7xQvH8BsCnOh` | — |

**Vercel Team ID**: `team_PpkAToo3Pg1CgnG0vefYMO52`

---

## Domain

| Domain | Status | Harga | Keterangan |
|--------|--------|-------|------------|
| `rifimgroup.com` | Tersedia | $11.25/tahun | Belum dibeli |
| `rifim.com` | Tidak tersedia | — | Sudah dipakai orang lain |

### Langkah Aktivasi Domain (TODO)
1. Beli `rifimgroup.com` di Niagahoster / Namecheap / Vercel
2. Di Vercel: project `rifim-os` → Settings → Domains → Add `rifimgroup.com`
3. Set DNS A Record ke `76.76.21.21` di registrar
4. Tunggu propagasi 5–60 menit

---

## Pull Requests

| PR | Judul | Status |
|----|-------|--------|
| #1 | feat(pwa): Connectivity Engine | Draft — belum di-merge |

---

## Role & Auth

```
ADMIN (5) > DIREKTUR (4) > KOORDINATOR (3) > STAFF (2) > DRIVER (1)
```

### Permissions
| Permission | Roles |
|-----------|-------|
| `document.generate` | STAFF, KOORDINATOR, DIREKTUR, ADMIN |
| `hris.write` | KOORDINATOR, DIREKTUR, ADMIN |
| `hris.payroll.write` | DIREKTUR, ADMIN |
| `admin.users` | ADMIN only |

---

## Modul Roadmap

| Modul | Status | Phase |
|-------|--------|-------|
| Smart Office | ✅ Live | Phase 1 |
| HRIS | ✅ Live | Phase 2 |
| Portal | ✅ Live | Phase 2 |
| Finance | ⏳ Belum | Phase 4 |
| RAOS | ⏳ Belum | Phase 3 |
| CRM | ⏳ Belum | Phase 5 |
| AI Assistant | ⏳ Belum | Phase 5 |
| Executive Dashboard | ⏳ Belum | Phase 6 |

---

## Next Steps (Prioritas)

- [ ] Merge PR #1 (Connectivity Engine) ke main
- [ ] Beli domain `rifimgroup.com` (~$11.25)
- [ ] Hubungkan domain ke Vercel project `rifim-os`
- [ ] Tambahkan `CLASPRC_JSON` secret di GitHub untuk CI/CD GAS
- [ ] Integrasikan `ConnectivityEngine` ke Smart Office & HRIS
- [ ] Deploy GAS terbaru (perlu laptop + clasp login)
- [ ] Kembangkan modul Finance (Phase 4)

---

## Sesi Log

### 2026-07-10
- Research domain rifimgroup.com → tersedia $11.25/tahun
- Bangun Connectivity Engine (engines/connectivity-engine.js)
- Bangun Service Worker (sw.js) dengan Cache First + Network First
- Bangun offline.html (halaman fallback)
- Update index.html dengan SW registration
- Buat PR #1, Vercel deploy Ready
- Update CHANGELOG.md
- Buat file memory ini

### 2026-07-09
- Sprint 0: inisialisasi repository
- Setup struktur folder (77 folder)
- Setup semua dokumentasi dasar
- Build GAS engines: Document, Numbering, Placeholder, PDF, Drive, Database
- Build Auth Engine + HRIS Layer
- Build Smart Office module (frontend)
- Build Portal module (frontend)
- Build HRIS module (frontend)
- Setup GitHub Actions untuk auto-deploy GAS
