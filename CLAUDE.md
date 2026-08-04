# CLAUDE.md

> RIFIM OS — Claude Code Operating Manual

Version: 1.4
Status: Active
Last updated: 2026-07-19 (Document Studio — DDS v3.0 applied: kop+footer banner PNG, signature composite via Slides API, spec presisi mm; docs/09-UI-UX/document-design-system/ + docs/10-AI/AI_RULES.md reorganized)

### Referensi Sistem Dokumen (WAJIB baca sebelum ubah engine dokumen)

| Modul | File |
|---|---|
| Blueprint arsitektur | [docs/04-Architecture/DOCUMENT_ENGINE.md](docs/04-Architecture/DOCUMENT_ENGINE.md) |
| Design system induk | [docs/09-UI-UX/document-design-system/DDS_v1.0.md](docs/09-UI-UX/document-design-system/DDS_v1.0.md) |
| Spec presisi layout | [docs/09-UI-UX/document-design-system/PAGE_LAYOUT.md](docs/09-UI-UX/document-design-system/PAGE_LAYOUT.md), [HEADER_SYSTEM.md](docs/09-UI-UX/document-design-system/HEADER_SYSTEM.md), [FOOTER_SYSTEM.md](docs/09-UI-UX/document-design-system/FOOTER_SYSTEM.md), [SIGNATURE_SYSTEM.md](docs/09-UI-UX/document-design-system/SIGNATURE_SYSTEM.md) |
| Struktur & tipografi | [TYPOGRAPHY.md](docs/09-UI-UX/document-design-system/TYPOGRAPHY.md), [LETTER_STRUCTURE.md](docs/09-UI-UX/document-design-system/LETTER_STRUCTURE.md), [TABLE_SYSTEM.md](docs/09-UI-UX/document-design-system/TABLE_SYSTEM.md) |
| Export target | [PDF_EXPORT.md](docs/09-UI-UX/document-design-system/PDF_EXPORT.md), [GOOGLE_DOCS.md](docs/09-UI-UX/document-design-system/GOOGLE_DOCS.md), [MICROSOFT_WORD.md](docs/09-UI-UX/document-design-system/MICROSOFT_WORD.md), [QR_SYSTEM.md](docs/09-UI-UX/document-design-system/QR_SYSTEM.md) |
| Batasan AI | [docs/10-AI/AI_RULES.md](docs/10-AI/AI_RULES.md) |
| Spec sumber | [docs/09-UI-UX/document-design-system/_source/ROLE_Document_letterhead_dan_Footer_3_Perusahaan.md](docs/09-UI-UX/document-design-system/_source/ROLE_Document_letterhead_dan_Footer_3_Perusahaan.md) |

Implementasi engine dokumen: [automation/apps-script/htmlTemplateEngine.js](automation/apps-script/htmlTemplateEngine.js) (HTML→PDF pipeline default untuk semua dokumen).

**GAS Advanced Services yang WAJIB enabled** (`appsscript.json`): Drive v2 + Slides v1. Scope: `/auth/documents`, `/auth/drive`, `/auth/presentations`.

**Missing (belum ada, tapi link sudah disiapkan)**: `docs/09-UI-UX/document-design-system/AUTOMATION_RULES.md`.

---

## Integration Rules — SSoT Data Contract (MUTLAK, BACA PERTAMA)

## AI API Integration (Prompt Caching)

Untuk pengembangan Modul AI Assistant atau integrasi Claude API via Google Apps Script (Sprint 3+), WAJIB menerapkan **Cache Otomatis (Prompt Caching)** guna menghemat pengeluaran biaya token input hingga 90% untuk dokumen operasional statis (SOP, pedoman).

**Standar Implementasi:**
1. Header permintaan *fetch* WAJIB menyertakan flag beta: `"anthropic-beta": "prompt-caching-2024-07-31"`.
2. Parameter `"cache_control": {"type": "ephemeral"}` WAJIB disisipkan pada objek `system` atau `messages` yang memuat teks konteks berat/panjang.
3. Dokumen referensi operasional harus diposisikan di awal permintaan agar sistem AI dapat mengenali *hash* dan menggunakan skema harga *Read* ($0,20 / MTok) pada eksekusi skrip selanjutnya.

Empat aturan ini WAJIB diterapkan pada SETIAP kode yang menyentuh data
(PWA payload, Modul Backend, GAS). Detail lengkap: `PROJECT_RULES.md`
seksi **Integration Rules** (Rule 40–47). Utilitas kanonik:
`automation/apps-script/gasUtils.js` — jangan implementasi ulang.

| # | Aturan | Implementasi |
|---|--------|--------------|
| 1 | **Timestamp ISO UTC** — semua kolom storage `YYYY-MM-DDTHH:mm:ss.sssZ` | `_gasNow()`; date-only `_gasToday(ss)`; display lokal `_gasTimeDisplay(ss)` (bukan pengganti storage) |
| 2 | **Race Condition** — semua write konkuren dalam ScriptLock 10 detik | `_gasWithLock(fn)` — waitLock(10000) + releaseLock di finally; read-modify-write = satu lock utuh |
| 3 | **Validasi Tipe & Enum** — `attachment` integer; status Antrian Bandara uppercase enum `WAITING/CALLED/PICKED/DONE/CANCEL`; ID baru = UUID v4 | `_gasValidate()` di baris pertama endpoint; `_gasUuid()`; frontend kirim tipe final (`parseInt \|\| 0`) |
| 4 | **Error Logging** — semua catch → sheet `system_log` | `_gasLogError()` / `_gasLogWarn()`; return `{ok:false, error}`; kecuali di dalam logger sendiri → `console.error()` |

**Aturan kontrak payload:** perubahan nama field / tipe / enum WAJIB update
tiga sisi sekaligus (PWA + webApp + engine) dalam satu commit.

**Reminder redeploy:** perubahan `automation/apps-script/*.js` → push GitHub
(clasp auto) → **Web App wajib redeploy manual** di GAS Editor.

---

## Logo Perusahaan (WAJIB)

Setiap kali user meminta logo perusahaan — dalam dokumen, template HTML, GAS, atau output apapun — Claude WAJIB langsung mengambil file dari folder lokal berikut **tanpa menunggu konfirmasi**:

```
C:\Users\ADMIN\Documents\RIFIM\rifim-os\branding\logo\
```

### Mapping Cepat Logo

| Kata kunci / Perusahaan | File yang digunakan |
|-------------------------|---------------------|
| Menala / PT. Menala Internasional Gemilang | `branding/logo/logo-menala.png` |
| Rifim / PT. RIFIM Internasional Gemilang | `branding/logo/logo-rifim.png` |
| Lailan / CV. LailanKalilan Indonesia | `branding/logo/logo-lailan.png` |
| Maxim | `branding/logo/logo-maxim.png` |
| Rifim Group / Grup / Semua Perusahaan | `branding/logo/logo-rifim-group.jpg` |
| Icon / PWA icon | `branding/icon/icon-192.png` |
| Stempel Menala | `branding/logo/stempel-menala.png` |
| Stempel Rifim | `branding/logo/stempel-rifim.png` |
| Stempel Lailan | `branding/logo/stempel-lailan.png` |

> Mapping lengkap + aturan stempel ada di `PROJECT_RULES.md` bagian **Logo & Branding Rules**.

---

## External Resources (WAJIB PAKAI — jangan buat sumber lain)

Semua sumber daya eksternal RIFIM OS ada di lokasi berikut. Gunakan **MCP tools** (`Google_Workspace_MCP`, `Claude_Browser`, `Supabase MCP`) untuk mengaksesnya — jangan copy-paste manual atau hardcode ID di tempat lain.

| Item | Lokasi |
|------|--------|
| Folder lokal proyek | `C:\Projects\menala\rifim-os` |
| Google Drive folder (aset kop/TTD/stempel + PDF output) | https://drive.google.com/drive/folders/19taBn0YXxjXTb-SxqFXGhwOPShZ4VlIt |
| Google Spreadsheet DB | https://docs.google.com/spreadsheets/d/1jHeA-w1bM32S3-AU-ENN2UjiaCb4iLzRhaf4G7y4ozM |
| GAS Project Editor | https://script.google.com/u/0/home/projects/1IK8-2anrxahce1X1MG7Bi3aGe6e-_4e3obanTRprT6brYSdla9rEYOxp/edit |
| GAS Web App URL (aktif) | https://script.google.com/macros/s/AKfycbzzK75gxawaylaUZpoC1zp_hq5ktznlN7scIl24HkdEgR2l3cVmpUSLck0potcMZZtw/exec |

⚠️ URL Web App mengandung `scIl` (huruf besar I + huruf kecil l) — mudah tertukar dengan `scll`. Copy dari file ini, jangan retype.

---

## Working Directory (WAJIB)

**Semua file proyek HANYA boleh dibaca dan disimpan di:**

```
C:\Projects\menala\rifim-os
```

- Jangan buat file di luar folder ini
- Jangan simpan script, data, atau output ke path lain (Desktop, Downloads, temp sistem, dll.)
- File temporary → gunakan folder `temp/` di dalam proyek ini
- File data/analisa → simpan di subfolder yang sesuai di dalam proyek ini

---

## Role

Kamu adalah Lead Software Engineer untuk proyek RIFIM OS.

Tugasmu bukan hanya menulis kode — tugasmu adalah menjaga arsitektur, memastikan kualitas, dan memastikan setiap implementasi selaras dengan visi jangka panjang proyek.

Berpikirlah seperti senior software architect, bukan code generator.

---

## Trigger Perintah Sesi

### BUKA SESI — "lanjut rifim os chat" (atau `/lanjut-rifim-os-chat`)

Setiap kali user mengetik perintah ini, Claude WAJIB langsung menjalankan startup sequence **tanpa menunggu konfirmasi:**

```
1. Buka folder lokal: C:\Users\ADMIN\Documents\RIFIM\rifim-os
2. Baca CLAUDE.md           ← operating manual, design system, engines
3. Baca PROJECT_RULES.md    ← business rules, chat rules, design tokens
4. Baca docs/STATUS.md      ← sprint aktual, backlog, temuan analisa
5. Laporkan: sprint aktif, task pending, PR yang menunggu
6. Siap menerima instruksi
```

### TUTUP SESI — "simpan sesi rifim os" (atau `/simpan-sesi-rifim-os`)

Setiap kali user mengetik perintah ini, Claude WAJIB langsung menjalankan save sequence **tanpa menunggu konfirmasi:**

```
1. Cek git status             ← file apa yang berubah
2. Update docs/STATUS.md      ← tandai task selesai ✅, catat progress, update tanggal
3. Commit semua perubahan     ← pesan commit deskriptif
4. Push ke branch aktif       ← git push -u origin <branch>
5. Laporkan ringkasan sesi:
   ✅ Task selesai hari ini
   ⬜ Task pending lanjut
   ⚠️ Blocker / keputusan pending
   🔜 Task pertama sesi berikutnya
```

Jangan tanya konfirmasi — langsung eksekusi dan laporkan hasilnya.

### KOREKSI JALUR — "reset alur rifim os" (atau `/reset-alur-rifim-os`)

Gunakan **di tengah sesi** ketika Claude mulai menyimpang dari arsitektur atau melanggar rules.

```
1. STOP — hentikan semua coding yang sedang berjalan
2. Re-baca CLAUDE.md + PROJECT_RULES.md
3. Evaluasi pekerjaan terakhir:
   - Apakah ada hardcode warna / nilai?
   - Apakah ada duplikasi fungsi yang sudah ada?
   - Apakah Business Rules BR-01–BR-10 diterapkan?
   - Apakah RCP 4-level, cabang, queue format sudah benar?
4. Laporkan: apa yang menyimpang + kenapa + rencana koreksi
5. TUNGGU konfirmasi user sebelum lanjut coding
```

**Tanda-tanda wajib reset:**
- Hardcode hex color (harusnya CSS variable)
- Queue format `A001` (harusnya `A-023`)
- Koordinator bisa lihat semua cabang (langgar BR-01)
- Saldo bisa negatif (langgar BR-06)
- Auth hanya return role, bukan RCP 4-level
- Write GAS tanpa `_gasWithLock()` (langgar Rule 41)
- Commit langsung ke `main`

---

## Before Writing Any Code

Jalankan langkah ini secara berurutan setiap sesi baru:

1. Baca `CLAUDE.md` (file ini)
2. Baca `PROJECT_RULES.md`
3. Baca `docs/STATUS.md`
4. Pahami task yang sedang dikerjakan
5. Analisis modul yang sudah ada
6. Reuse komponen yang sudah ada sebisa mungkin

Baru setelah itu boleh mulai implementasi.

---

## Core Principles

**Engine First** — bangun engine sebelum fitur.

```
BENAR:
  Document Engine → GenerateLetter(), GenerateInvoice(), GeneratePKWT()

SALAH:
  GenerateLetter()   ← berdiri sendiri
  GenerateInvoice()  ← berdiri sendiri
  GeneratePKWT()     ← berdiri sendiri
```

**Never Duplicate** — jika sudah ada, reuse.

**Never Hardcode** — semua config di file konfigurasi.

**Never Break Existing** — backward compatibility wajib.

---

## Thinking Process

Sebelum coding, tanyakan:

- Apakah ini sudah ada?
- Apakah ini bisa di-reuse?
- Apakah ini bisa menjadi Engine?
- Apakah ini masih berjalan jika perusahaan tumbuh 10x?
- Apakah modul lain bisa menggunakan ini?
- Apakah ini bisa disederhanakan?

Jika ada jawaban "Ya" → redesign sebelum coding.

---

## Design System (WAJIB — Jangan Hardcode)

Semua warna, font, dan ukuran HARUS menggunakan CSS variable dari design system.
Jangan pernah hardcode hex color langsung di HTML/CSS.

### Global Color Tokens

| Token | Hex | Penggunaan |
|-------|-----|-----------|
| `--primary` | `#1E88E5` | Tombol utama, link, header modul |
| `--secondary` | `#FFC107` | Aksen, badge, highlight |
| `--success` | `#43A047` | Status sukses, saldo positif |
| `--warning` | `#FB8C00` | Peringatan, threshold |
| `--error` | `#E53935` | Error, saldo negatif, delete |
| `--info` | `#00ACC1` | Informasi, tips |
| `--dark-900` | `#111827` | Background gelap |
| `--dark-700` | `#374151` | Card dark |
| `--dark-500` | `#6B7280` | Teks sekunder |
| `--light-200` | `#D1D5DB` | Border, divider |
| `--light-100` | `#F3F4F6` | Background card light |

### RIFIM Chat Dark Theme (BERBEDA dari modul lain)

| Token | Hex | Penggunaan |
|-------|-----|-----------|
| `--chat-bg` | `#111111` atau `#121212` | Background chat |
| `--chat-accent` | `#FFC700` | Kuning Maxim, tab aktif, admin bubble |
| `--chat-bubble-user` | `#2B2B2B` | Bubble pesan user |
| `--chat-online` | `#00C853` | Indikator online |
| `--chat-danger` | `#FF5252` | Delete, kick, warning |
| `--chat-surface` | `#1E1E1E` | Room chat background |

Font seluruh aplikasi: **Poppins** (fallback: Inter)
- H1: 32px Bold · H2: 24px Bold · H3: 20px SemiBold
- Body: 14px Regular · Caption: 11px Medium

### Queue Number Format

**Format wajib:** `A-023` (huruf prefix + tanda hubung + 3 digit zero-padded)
- Bukan `A001` (lama) — harus diupdate di RAOS UI
- Reset per hari, per cabang
- Prefix bisa `A`, `B`, dst sesuai gate/counter

---

## Cabang (7 Definitif)

| Kode | Nama | Bandara |
|------|------|---------|
| `BTH` | Batam | Hang Nadim |
| `JBI` | Jambi | Sultan Thaha |
| `PKU` | Pekanbaru | Sultan Syarif Kasim II |
| `BPN` | Balikpapan | Sultan Aji Muhammad Sulaiman |
| `MDC` | Manado | Sam Ratulangi |
| `MKS` | Makassar | Sultan Hasanuddin |
| `CGK` | Jakarta | Soekarno-Hatta |

Semua kode cabang UPPERCASE 3 huruf. Jangan hardcode nama panjang, gunakan kode.

---

## Auth — RCP 4-Level Model

Setiap session login HARUS mengembalikan 4 level akses (bukan hanya role):

```
Role → Cabang → Permission[] → DataScope
```

| Level | Contoh | Keterangan |
|-------|--------|-----------|
| Role | `KOORDINATOR` | 8 roles: DIREKTUR, ADMIN_PUSAT, KOORDINATOR, STAFF, FINANCE, DRIVER, IT_SUPPORT, AUDITOR |
| Cabang | `BTH` | 7 kode cabang + `ALL` untuk Direktur/Admin Pusat |
| Permission[] | `["read_finance","approve_invoice"]` | Array hak akses spesifik |
| DataScope | `{cabang:"BTH"}` | Filter data yang boleh dilihat |

**Aturan:** Koordinator HANYA boleh lihat data cabangnya sendiri (BR-01).
Auth Engine WAJIB upgrade ke RCP 4-level sebelum Chat module dibangun.

---

## Mode Kerja (Work Mode)

Setiap driver dan staff memiliki status kerja aktif. Enum wajib uppercase:

```
BERTUGAS | ISTIRAHAT | SIAP_ORDER | OFF_DUTY | CUTI | SAKIT
```

Status ini mempengaruhi: Smart Queue · HRIS · Dashboard · AI Insight · Notifikasi

Field `work_status` wajib ada di tabel Supabase `drivers` dan `employees`.
Driver dengan status `OFF_DUTY`, `CUTI`, atau `SAKIT` tidak boleh masuk antrian.

---

## Engines (Build These First)

| Engine | Purpose | Status |
|--------|---------|--------|
| Document Engine | Generate semua jenis dokumen | ✅ Phase 1 Done — HTML→PDF pipeline tersedia (htmlTemplateEngine.js) |
| Placeholder Engine | Replace placeholder di template | ✅ Phase 1 Done |
| Numbering Engine | Auto-generate nomor dokumen | ✅ Phase 1 Done |
| PDF Engine | Convert ke PDF | ✅ Phase 1 Done + ✅ HTML→PDF via Drive.Files.insert |
| Drive Manager | Kelola Google Drive | ✅ Phase 1 Done |
| Database Layer | Abstraksi akses database | ✅ Phase 1 Done |
| Notification Engine | Email & WhatsApp | ✅ Phase 3 Done (WA terintegrasi semua modul) |
| WA Engine | Fonnte API, templates per modul | ✅ Phase 3 Done |
| QR Engine | Generate QR code | ✅ Phase 2 Done |
| Auth Engine | Authentication & role | ✅ Phase 2 Done — upgrade ke RCP 4-level (Sprint 3B) |
| Branding Engine | Logo perusahaan ke Sheet (PDF-ready) | ✅ Sprint 2 Done — MIG logo ID difix 2026-07-19 |
| Driver Layer | CRUD driver RAOS + sync Supabase→Sheet | ✅ Sprint 2 Done |
| Staff Sync Layer | CRUD staff HRIS + sync Supabase→Sheet | ✅ Sprint 2 Done |
| Chat Engine | Supabase Realtime, 10 rooms, event bus | ⬜ Sprint 3B |
| Workflow Engine | Draft→Review→Approval→Signed lifecycle | ⬜ Backlog (lihat docs/DOCUMENT_ENGINE.md) |
| Revision Engine | Versioning dokumen + change log | ⬜ Backlog |
| Audit Engine (immutable) | Seluruh aktivitas dokumen tercatat permanen | ⬜ Backlog |
| Mode Kerja Engine | Work status management, impact routing | ⬜ Sprint 3B |

---

## Module Architecture

Setiap modul harus:
- Berdiri sendiri (independent)
- Tidak tahu detail implementasi modul lain
- Berkomunikasi hanya melalui defined interface
- Menggunakan shared engines, bukan implementasi sendiri

---

## Database Rules

- Phase 1: Google Sheets
- Phase 2: Supabase PostgreSQL
- Desain schema agar bisa migrasi tanpa ubah arsitektur
- Jangan hardcode Spreadsheet ID
- Jangan duplikasi schema

### Arsitektur Sinkronisasi Data (SSoT)

```
Supabase (SSoT)        Google Sheets (cache operasional)
────────────────        ──────────────────────────────────
employees          →    sheet "Database Staff"
drivers (airport)  →    sheet "Database Driver Airport"
drivers (external) →    sheet "Database Driver External"
```

- Input baru: melalui sheet `Input Staff` / `Input Driver Airport` / `Input Driver External`
- Proses input: fungsi `prosesInputStaff()` / `prosesInputDriver()` → Supabase → auto-sync ke sheet
- Auto-sync: trigger setiap 6 jam via `setupStaffSyncTrigger()` / `setupDriverSyncTrigger()`
- Jangan edit `Database Staff` / `Database Driver` secara manual — data akan ditimpa saat sync

---

## Google Apps Script — Project Registry

Daftar GAS project yang terhubung ke RIFIM OS. Gunakan Script ID ini saat `clasp push` ke project tertentu.

| Nama Project | Script ID | Lokasi Lokal | File Utama | Spreadsheet Bound |
|---|---|---|---|---|
| RIFIM OS (Main) | `1IK8-2anrxahce1X1MG7Bi3aGe6e-_4e3obanTRprT6brYSdla9rEYOxp` | `automation/apps-script/` | `raosMonitoringEngine.js`, `saldoEngine.js`, `staffAppApi.js` dll | `1jHeA-w1bM32S3-AU-ENN2UjiaCb4iLzRhaf4G7y4ozM` |
| Pengisian Saldo | `1_V2BOS56ac1v0mzte2rfl3at4wmc31foeKoLddZ6SeYRhSc_B2icbcUz` | `C:\Projects\menala\rifim-isi-saldo\New folder\` (clasp-linked) | `MonitoringSaldo.gs`, `Main.gs`, `Matching.gs` dll | `1T7gvlIPt2Un2mca43803oGpdMakaFuEUiSF7Z_KeXqU` |

### Status Migrasi PWA Monitor Saldo & Koordinator (per 20 Jul 2026)

Sebelumnya kedua PWA (`rifim-monitor-saldo.vercel.app` & `rifim-monitor-koordinator.vercel.app`) point ke RIFIM OS `AKfycbzzK75…ZZtw`, tapi endpoint hanya balikin default `{"success":true,"app":"RIFIM OS…","status":"running"}` — bukan data monitoring. Karena RIFIM OS masih dalam pengembangan dan data saldo aktual ada di spreadsheet Pengisian Saldo, kedua PWA dimigrasikan ke endpoint Pengisian Saldo `AKfycbzq…omm` @52 (backend `doGetJSONSaldo` + `doGetJSONKoordinator` di `Main.gs`). Verified: data cabang muncul.

Konsekuensi untuk RIFIM OS:

- **3 trigger saldo/potongan dinonaktifkan** (`cekSLASaldo`, `cekSLASaldoPWA`, `cekSLAPotongan`) supaya tidak kirim WA duplikat ke grup cabang yang sama (`_MON_WA_SALDO_GRUP` = mirror `SAL_WA_GROUP_PER_CABANG` Pengisian Saldo). Setup ulang (`setupPotonganTriggers` dll) HANYA setelah RIFIM OS live dengan token & grup Fonnte terpisah.
- Fungsi backend saldo/potongan (`refreshMonitoringSaldo`, `cekSLASaldo`, `saldoEngine.js`, dll) TETAP ADA di kode — tinggal pasang trigger ulang saat siap live.
- Sheet `Form Input Saldo PWA` & `Form Input Saldo AIST` di spreadsheet RIFIM OS akan tetap kosong sampai PWA staff RIFIM OS (via `staffSaldoSubmit`) di-release. Selama itu, PWA staff isi saldo tetap di `isisaldo.vercel.app` (project Pengisian Saldo → `Jawaban Formulir 1`).

### Vercel PWA — Endpoint Map (per 20 Jul 2026)

| PWA | Vercel URL | GAS Endpoint (deployment) | Project GAS |
|---|---|---|---|
| Isi Saldo Staff | `isisaldo.vercel.app/?cabang=…&staff=…` | `AKfycbzq…omm` @52 | **Pengisian Saldo** |
| Admin Isi Saldo | `isisaldo.vercel.app/admin` | `AKfycbzq…omm` @52 (sama) | **Pengisian Saldo** |
| Monitor Saldo | `rifim-monitor-saldo.vercel.app` | `AKfycbzzK75…ZZtw` @52 "V55" | **RIFIM OS (Main)** |
| Monitor Koordinator | `rifim-monitor-koordinator.vercel.app` | `AKfycbzzK75…ZZtw` @52 "V55" (sama) | **RIFIM OS (Main)** |

**Konsekuensi penting:**
- Perubahan pada `Pengisian Saldo` (Matching.gs, MonitoringSaldo.gs, dll) **TIDAK berlaku** untuk Monitor Saldo/Koordinator. Sebaliknya juga.
- 2 project GAS punya fungsi dengan **nama sama tapi logika berbeda** (`refreshMonitoringSaldo`, `cekSLASaldo`). Selalu pastikan folder/scriptId yang benar sebelum edit.
- Sheet sumber data saldo juga berbeda:
  - Pengisian Saldo → `Jawaban Formulir 1` (PWA staff submit)
  - RIFIM OS → `Form Input Saldo PWA` (PWA staff submit via `staffSaldoSubmit`) + `Form Input Saldo AIST` (admin paste dari Maxim)
- Konfigurasi WA group per cabang **di-duplicate manual** — `SAL_WA_GROUP_PER_CABANG` (Pengisian Saldo/MonitoringSaldo.gs) ↔ `_MON_WA_SALDO_GRUP` (RIFIM OS/raosMonitoringEngine.js). Kalau salah satu diedit, yang lain harus di-sync manual.

### Cara Push ke GAS Project Tertentu

```bash
# Push RIFIM OS Main
cd automation/apps-script && clasp push

# Push Pengisian Saldo (pull dulu ke temp folder, edit, push)
mkdir -p /tmp/pengisian-saldo
cd /tmp/pengisian-saldo
echo '{"scriptId":"1_V2BOS56ac1v0mzte2rfl3at4wmc31foeKoLddZ6SeYRhSc_B2icbcUz","rootDir":"."}' > .clasp.json
clasp pull
# ... edit ...
clasp push
```

> `.clasprc.json` (OAuth token) harus ada di `~/.clasprc.json` sebelum bisa push.
> Token didapat dari `clasp login` di komputer lokal, lalu paste isinya ke remote session.

---

## Google Apps Script Rules

Pisahkan menjadi:
- `business-logic/` — logika bisnis
- `services/` — integrasi eksternal
- `utils/` — fungsi utilitas
- `config/` — konfigurasi
- `engines/` — reusable engines

Jangan taruh semua di `Code.gs`.

---

## Coding Style

- Fungsi dengan nama deskriptif
- Hindari nested logic
- Pecah fungsi besar
- Prioritaskan readability
- Komentar hanya jika benar-benar perlu

---

## Security

Jangan pernah expose:
- API Keys
- Secrets / Tokens
- Passwords
- Spreadsheet IDs (hardcoded)

Gunakan config file atau environment variables.

---

## Git Rules

- Satu fitur = satu commit
- Commit message bermakna
- Jangan commit file temporary
- Jangan commit secrets
- Format: `type(scope): description`

Contoh:
```
feat(smart-office): add document numbering engine
fix(raos): correct pickup point calculation
docs(hris): update employee schema documentation
```

---

## Protokol Analisa Batch (WAJIB — JANGAN DILANGGAR)

Sebelum menulis SATU BARIS kode pun untuk modul RAOS / Finance / HRIS:

1. **Baca semua script** batch yang dikirim user — lokal + link GAS
2. **Analisa mendalam**: fungsi, data flow, integrasi antar modul
3. **Update STATUS.md** — tabel batch, mapping ke modul
4. **Push ke GitHub** setiap selesai analisa satu batch
5. **Berikan mapping** ke: Smart Office → HRIS → RAOS → Finance → CRM → Dashboard Direktur
6. **Tunggu "done"** dari user sebelum lanjut ke batch berikutnya
7. **JANGAN mulai coding** sampai semua batch selesai dianalisa

Pelanggaran protokol ini berarti kode yang ditulis tidak sesuai kebutuhan operasional nyata.

---

## When Unsure

Jika arsitektur tidak jelas:

1. STOP.
2. Jelaskan masalahnya.
3. Berikan beberapa opsi implementasi.
4. Rekomendasikan opsi terbaik.
5. Tunggu konfirmasi.

Jangan tebak-tebak.

---

## Definition of Done

Sebuah task dinyatakan selesai hanya jika:

- [ ] Arsitektur sesuai blueprint
- [ ] Dokumentasi diperbarui
- [ ] Kode selesai dan bersih
- [ ] Testing dilakukan
- [ ] Tidak ada duplikasi
- [ ] Reusable
- [ ] Scalable
- [ ] Production ready

---

## Final Mission

Misi ini bukan membangun aplikasi.

Misi ini adalah membangun Enterprise Operating System yang bisa mendukung PT. RIFIM Internasional Gemilang selama bertahun-tahun ke depan.

Setiap keputusan harus mendukung misi ini.

---

## Sesi 2026-08-04 sore — Finance KPI Targets V2 + HRIS Payroll Bonus + AIST Bookmarklet v2

Cross-repo delivery: backend (Supabase + PWA admin) di repo RAOS,
frontend UI di repo ini. Alur end-to-end:
**Room Chat Pengisian Saldo (PWA RAOS) → Riwayat → Finance tab
Target/DB Driver → KPI Payroll → HRIS Payroll (auto-fill Bonus)**.

### Endpoint baru di `crmApi.js` (10 total)

Semua admin-gated via `_finRoleGate_(params)` (admin/mgmt/direksi/direktur).

**KPI Targets V2 (Fase 2)**:
- `finance_kpi_target_branch_list?month=YYYY-MM` — list target per cabang +
  join branches (auto-flag `is_excluded_saldo` untuk Soeta/Makassar)
- `finance_kpi_target_branch_upsert&branch_id=&month=&target_cabang=&target_staff_default=&mode=`
- `finance_kpi_target_staff_list?month=&branch_id=` — join staff +
  target override + realisasi view + payroll
- `finance_kpi_target_staff_upsert&staff_id=&month=&target_saldo=&member_parkir_amount=`
- `finance_payroll_compute&month=` — trigger RPC `raos_compute_payroll_month`
- `finance_payroll_list?month=&branch_id=` — hasil compute untuk display

**DB Driver + Assignment (Fase 5)**:
- `finance_drivers_list?branch_id=` — join assignment + staff nama
- `finance_driver_assignment_list?branch_id=` — grouped per staff
- `finance_driver_assign_random&branch_id=&force=true|false` — trigger RPC
  `raos_random_assign_drivers`. **Management/direksi only** (hard-check di
  endpoint sebelum call RPC)

**HRIS bridge**:
- `hris_payroll_bonus_list?month=` — return map by staff_code untuk consumed
  UI HRIS Payroll (bonus_saldo + bonus_kpi + member_parkir + total_bonus)

### UI Finance — 3 tab baru di `modules/finance/index.html`

Tab bar sekarang: Dashboard · Per Cabang · Tagihan · Rekap · Isi Saldo (RAOS)
· **🎯 Target Cabang** · **👤 Target Staff** · **🚗 DB Driver** · Input Baru
· System Log.

- **Target Cabang** — tabel per cabang bulan berjalan, edit inline via
  modal (target_cabang, target_staff_default, mode saldo/order). Tombol
  "⚙️ Recompute Payroll Bulan Ini" panggil RPC + refresh.
- **Target Staff** — 14 kolom (Staff/Cabang/Gapok/Target/Realisasi/%/Bonus/
  BPJS/Paket/Parkir/BonusKPI/THP/Status/Aksi). Filter month + cabang.
  Edit modal untuk override target + member parkir manual.
- **DB Driver** — filter cabang + search. Tombol "🎲 Random Assign"
  (incremental) + "♻️ Rebalance Force" (reset semua lalu redistribute).
  Endpoint pisah check role management/direksi sebelum call RPC.

### Konvensi baru: `openEditModal({...})` helper reusable

Reusable modal generator dinamis untuk semua CRUD Finance/HRIS berikutnya.
Ganti pattern `prompt()`/`confirm()` yang jelek UX.

```js
openEditModal({
  title: '✏️ Edit ...',
  subtitle: 'Deskripsi opsional',
  fields: [
    { name: 'target_cabang', label: '...', type: 'number', value: 0, required: true, hint: '...' },
    { name: 'mode', label: 'Mode', type: 'select', value: 'saldo',
      options: [{ value: 'saldo', label: '...' }, { value: 'order', label: '...' }] },
  ],
  onSave: async (payload) => { /* panggil endpoint, throw kalau gagal */ },
  onDelete: async () => { /* opsional — tombol Hapus muncul kalau ada */ },
});
```

Field type: `text` (default) · `number` · `select` (dengan options array). Support
`required` + `hint` + `placeholder` + `nullable` (untuk number kosongan → null).

Lokasi definisi: `modules/finance/index.html` — dipakai `editTargetCabang()`
+ `editTargetStaff()`. Untuk fitur CRUD berikutnya, panggil helper ini
alih-alih bikin modal manual.

### UI HRIS — 2 kolom baru di `modules/hris/index.html`

Tabel Payroll extend jadi 12 kolom (dari 10):
- **Bonus Saldo RAOS** (auto-fetch dari `hris_payroll_bonus_list`)
- **Bonus KPI RAOS** (idem)

Data indexed by `employee_id` (uppercased) → cross-check ke
`user_profiles.staff_id` di RAOS. Kalau tidak match, kolom tampil 0.

Modal Buat Payroll: tombol "🔄 Auto-fill dari Bonus RAOS" di sebelah
label Tunjangan — populate field allowances dengan
(bonus_saldo + bonus_kpi + member_parkir) bulan sesuai filter.

### Bookmarklet AIST v2 — folder baru `automation/aist-bookmarklet/`

- `aist-fill-v2.source.js` — full commented source (300+ lines)
- `install.html` — drag-to-bookmarks page, auto-minify di client via fetch
  + regex strip comments/whitespace → `javascript:encodeURIComponent(min)`

**Beda dari bookmarklet lama** (yang baca sheet Pengisian Saldo):
- Source: `raos_saldo_requests` via `finance_saldo_raos_list` endpoint yang
  sudah ada (bukan sheet Google)
- Mark: PATCH `is_processed=true` via `finance_saldo_raos_mark_paid`
  endpoint yang sudah ada (bukan centang checkbox kolom G sheet)
- Auto-refresh 30 detik (pengajuan baru dari PWA RAOS langsung masuk)
- Filter status `approved` default (koord/admin sudah setujui, tinggal
  admin isi di AIST)
- Selector heuristic: `findInputByLabel(['Amount','Jumlah','Nominal'])` +
  `['Driver login','Login ID','Driver ID','Login']`. Kalau AIST DOM ganti
  label, edit array di source.

### Backend RAOS (repo terpisah `C:\Projects\menala\RAOS`)

- Migration `raos_070a/b/c/d` applied ke Supabase — 4 tabel + 2 view + 2 RPC.
  Detail schema di CLAUDE.md RAOS section "Sesi 2026-08-04 sore".
- Tombol random-assign di PWA RAOS `/admin` (PR #48 merged, commit `bbc25b1`).

### Debt sesi ini

- **UI Payroll HRIS finalize belum sync ke Bonus RAOS** — tombol Auto-fill
  hanya isi field Tunjangan sebelum save. Kalau bonus RAOS updated setelah
  payroll finalized, tidak auto-refresh. Solusi: manual re-buat payroll
  atau extend `hris_payroll` endpoint dengan update-mode
- **Selector AIST bookmarklet belum ter-test empiris** — heuristic label
  Amount/Login mungkin tidak match DOM AIST asli. User perlu test + adjust
  array keywords kalau tidak jalan
- **Modal `openEditModal` scope terbatas ke Finance** — kalau CRM/HRIS
  butuh, pattern ini bisa di-extract ke shared util JS (belum dilakukan
  supaya minimize risk sesi ini)

### GAS deploy (post-clasp-push)

Setiap edit `crmApi.js` (10 endpoint baru sesi ini) butuh:
1. `cd C:/Projects/menala/rifim-os/automation/apps-script && clasp push --force`
2. Manual redeploy: [GAS editor](https://script.google.com/home/projects/1IK8-2anrxahce1X1MG7Bi3aGe6e-_4e3obanTRprT6brYSdla9rEYOxp/edit)
   → Terapkan → Kelola deployment → ✏️ Edit deployment aktif → Versi baru
   → Terapkan. **URL `/exec` tetap** (sudah confirm user 2026-08-04 sore).

### File touched sesi ini

- `automation/apps-script/crmApi.js` — +10 endpoint + register dispatcher
- `modules/finance/index.html` — +3 tab + modal helper (+1279 line total)
- `modules/hris/index.html` — 2 kolom + autofill button
- `automation/aist-bookmarklet/aist-fill-v2.source.js` — new file
- `automation/aist-bookmarklet/install.html` — new file

Semua landed di commit main `7d77252` (auto-deploy Vercel confirmed live).
