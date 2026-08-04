# CLAUDE.md

> RIFIM OS — Claude Code Operating Manual

Version: 1.5
Status: Active
Last updated: 2026-08-04 (Portal + CRM + Sistem Admin Console + Finance modules wired live; PIN bridge via RAOS `raos_credentials`; RAOS Web API integration for cross-project admin actions)

## What This Repo Is (Read First)

RIFIM OS is a **multi-module enterprise system** for PT. RIFIM Internasional Gemilang.
The repository is a **static-hosted PWA** (deployed to Vercel) whose modules are
individual HTML files under `modules/`, plus a **single Google Apps Script (GAS)
backend** in `automation/apps-script/` that serves all modules over one Web App URL.

- **Frontend:** vanilla HTML/CSS/JS modules under `modules/<name>/index.html`
  routed by `vercel.json` rewrites (`/portal`, `/smart-office`, `/hris`, `/crm`,
  `/finance`, `/sistem`). `/raos` redirects to the separate `raos-menala` repo.
- **Backend:** GAS entry point `automation/apps-script/webApp.js` (`doGet` + `doPost`)
  routes every action from every module. CRM/Finance actions are dispatched to
  `crmApi.js` before the main handler (`crmHandleGet(e)` returns early if the
  action belongs to CRM).
- **Database:** Google Spreadsheet `1jHeA-w1bM32S3-AU-ENN2UjiaCb4iLzRhaf4G7y4ozM`
  is the primary store; Supabase (shared with RAOS at `vlievtojpmrbsmzlqswl`) is
  read/written via service-role from GAS for user/PIN bridging.
- **Deploy:** GitHub Actions push commits on `main` — `deploy-gas.yml` runs
  `clasp push --force` on any change under `automation/apps-script/**`;
  `deploy-pwa.yml` deploys the 3 Monitor PWAs to Vercel when their folders change.
  **Web App itself must be redeployed manually** in the GAS Editor (Deploy →
  Manage → New version) — `clasp push` only updates source, not the `/exec` URL.
- **Session branches:** all development is on `claude/*` branches, never commit
  directly to `main`; PR-based flow.

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

## Vercel Routes & Modules (per `vercel.json`)

Semua route di-serve dari repo statis; setiap route mengarah ke satu file
`modules/<name>/index.html`. Setiap modul adalah SPA satu file (HTML + inline
CSS/JS) — mereka call `GAS_WEB_APP_URL` untuk data.

| Route | Modul | File | Fungsi utama | Status |
|---|---|---|---|---|
| `/` | Landing | `index.html` | Card grid semua modul | ✅ live |
| `/portal` | Portal login | `modules/portal/index.html` | Login RAOS PIN via RPC `raos_verify_and_bridge` → gateway ke modul lain | ✅ live |
| `/smart-office` | Smart Office | `modules/smart-office/index.html` | Document Studio (20 tipe × 3 perusahaan), Arsip, preview + generate | ✅ live |
| `/hris` | HRIS | `modules/hris/index.html` | Employee CRUD, contracts, attendance, leave, payroll | ✅ live |
| `/crm` | CRM | `modules/crm/index.html` | Company Config, Whitelist Portal, System Config, User Supabase RAOS, Kontak Eksternal, PIN management, Audit Log | ✅ live (2026-08-02) |
| `/finance` | Finance | `modules/finance/index.html` | 6 tab live: Ledger, Cabang, Tagihan, Rekap harian/bulanan, Log, Saldo RAOS | ✅ live (2026-08-02) |
| `/sistem` | Sistem — Admin Console | `modules/sistem/index.html` | Trigger semua action RAOS (sync SSOT staff/driver, KPI, backup, force refresh auth) dari Portal | ✅ live (2026-08-03) |
| `/raos` | RAOS PWA | (redirect ke `raos-menala.vercel.app`) | Airport ops PWA — repo terpisah `menala-tech/raos-menala` | ✅ live |

**Landing (`index.html`) sudah tidak lagi hanya statis** — sekarang render card
grid untuk semua route di atas, ambil user role dari Portal session (localStorage).

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
| CRM API Layer | KV config, whitelist, contacts, Supabase RAOS user proxy, PIN reset | ✅ Sesi 2026-08-02 (`crmApi.js`) |
| Finance API Layer | 6 endpoint LIA + Tagihan + Rekap + Saldo RAOS | ✅ Sesi 2026-08-02 (`crmApi.js` `_fin*_`) |
| Portal PIN Bridge | Login satu-satu email/RAOS_ID + PIN via Supabase RPC | ✅ Sesi 2026-08-03 |
| Admin Console | 9 tombol trigger action RAOS dari Portal | ✅ Sesi 2026-08-03 (`modules/sistem`) |

---

## CRM API — Endpoint Registry (`automation/apps-script/crmApi.js`)

CRM API di-dispatch dari `webApp.js doGet(e)` via `crmHandleGet(e)` yang return
early. Auth: query param `?user=<email>` di-cocokkan ke `company_config.allowed_emails`
+ role check via `configLoader`; write actions gate ke `CRM_WRITE_ROLES` =
`['admin','management','direksi','direktur']`.

| Action | Fungsi | Guard | Payload |
|---|---|---|---|
| `company_config_list` / `_set` | `_crmReadKV_` / `_crmSetKV_` | read: any authed; write: admin | KV pair sheet `company_config` |
| `whitelist_list` / `_add` / `_remove` / `_update` | `_crmWhitelistList_` / `_Mutate_` / `_Update_` | admin | email + role, sheet `whitelist_portal` |
| `crm_audit_tail` | `_crmAuditTail_` (cache 60s) | any authed | Ambil dari SYSTEM_LOG sheet |
| `sistem_config_set` | `_crmSistemConfigSetSheet_` | admin | Sync sheet SISTEM CONFIG (mirror Supabase via frontend RPC) |
| `raos_users_list` / `_update` / `_reset_pin` | `_crmRaosUsers*_` | admin | Proxy ke Supabase `user_profiles` via service_role — bypass RLS |
| `raos_credentials_list` / `_reset_pin` | `_crmRaosCredentials*_` | admin | RAOS Portal PIN table (`raos_credentials`) |
| `raos_ssot_pin_update` | `_crmRaosSsotPinUpdate_` | admin | Edit kolom H sheet SSOT MASTER DATA STAFF (SSOT PIN) tanpa buka Spreadsheet |
| `contacts_list` / `_upsert` / `_delete` | `_crmContacts*_` | admin | Tabel Supabase `crm_contacts` via service_role |
| `finance_list` / `_cabang_list` / `_tagihan_list` / `_tagihan_add` / `_tagihan_mark_paid` / `_rekap_harian` / `_rekap_bulanan` / `_log_list` / `_saldo_raos_list` / `_saldo_raos_mark_paid` | `_fin*_` | `_finRoleGate_` (admin/mgmt/direksi) | Spreadsheet `1AgpEqhpDU4B…` = LIA master + Tagihan + per-cabang |

**Sparse-body upsert:** `contacts_upsert` (dan tabel Supabase apapun yang di-write
via CRM API) **HARUS pakai body sparse** — jangan kirim field NULL untuk kolom yang
tidak berubah (nullify tak sengaja). Lihat commit `3565b35` untuk contoh.

**Return convention:** semua CRM endpoint return `{success:bool, ...payload/message}`.

---

## Portal — PIN Login Bridge (Sesi 2026-08-03)

Portal (`modules/portal/index.html`) login pakai **RAOS_PIN** (kolom I sheet SSOT),
BUKAN PIN kolom H yang dipakai PWA lain (isi-saldo, radms-driver). Isolasi ini
mencegah rotasi PIN Portal mengganggu PWA lain.

**Flow:**
1. User input `email` atau `raos_staff_code` + `raos_pin`
2. Frontend call Supabase RPC `raos_verify_and_bridge(p_login_id, p_raos_pin)` →
   return `{email, ssot_pin}` kalau match, else `{error}`
3. Frontend call `supabase.auth.signInWithPassword({email, password: ssot_pin})`
   secara transparent — session Supabase terbentuk seperti biasa
4. Redirect ke `/` (landing) dengan role dari `user_profiles.role`

**Tabel & migration:** `raos_credentials` di Supabase RAOS (`raos_068`).
Kolom `ssot_pin` (kolom H, mirror) + `raos_pin` (kolom I, primary login).
Sync GAS RAOS `gas/19_raos_credentials_sync.gs` refresh dari sheet SSOT tiap 1 jam.

**Admin reset:**
- **Reset RAOS_PIN** (kolom I): CRM API `raos_credentials_reset_pin` → update `raos_credentials.raos_pin` langsung. Tidak sentuh sheet SSOT.
- **Reset SSOT PIN** (kolom H — dipakai auth Supabase langsung): CRM API `raos_ssot_pin_update` → tulis ke sheet SSOT kolom H, sync jam berikutnya propagate ke Supabase Auth password.

---

## Sistem — Admin Console (Sesi 2026-08-03)

`modules/sistem/index.html` = tombol trigger untuk 9 action RAOS + panel Log
Sistem realtime. Pattern: klik card → POST ke **RAOS Web App URL** (bukan RIFIM OS
Web App), pass `{action, token}` di body. Token = Supabase Auth JWT dari session
Portal user.

**9 Action Tersedia** (definisi di `raos-menala/gas/21_web_api.gs`
`_WEB_API_ALLOWED_ACTIONS`):

| Action | Fungsi RAOS | ETA | Kategori |
|---|---|---|---|
| `sync_staff` | `syncStaffFromSSOT` | ~10 detik | Sync SSOT |
| `sync_driver_airport` | `syncDriverAirportFromSSOT` | ~30-40 detik | Sync SSOT |
| `sync_driver_external` | `syncDriverExternalFromSSOT` | ~10-15 detik | Sync SSOT |
| `sync_raos_credentials` | `syncRaosCredentials` | ~5 detik | Sync SSOT |
| `run_backup` | `backupHarian` | ~30 detik | Maintenance |
| `sync_selfie_drive` | `syncSelfiePhotosToGDrive` | ~1-2 menit | Maintenance |
| `run_kpi` | `updateAllKpiRAOS` | ~1 menit | KPI |
| `force_refresh_staff_auth` | `forceRefreshStaffAuth` | on-demand | Auth |
| `force_refresh_driver_auth` | `forceRefreshDriverAirportAuth` | on-demand | Auth |

**Auth check** (`_webVerifyCaller_` di RAOS GAS): verify JWT via
`/auth/v1/user` + role check di `user_profiles`. Hanya admin/direksi/management.
CORS: request body pakai `Content-Type: text/plain` untuk hindari OPTIONS preflight.

**Log panel** (`system_log_recent` action): read tab `LOG SISTEM` sheet RAOS,
filter by level (INFO/WARN/ERROR) + search, auto-refresh 30 detik.

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

## CI/CD — GitHub Actions (`.github/workflows/`)

Ada 2 workflow otomatis di repo ini:

| Workflow | Trigger | Kerja |
|---|---|---|
| `deploy-gas.yml` | push `main` yang menyentuh `automation/apps-script/**` | `clasp push --force` ke RIFIM OS Main script (`1IK8-2a…`). Butuh secret `CLASPRC_JSON`. **TIDAK auto-redeploy Web App** — harus manual di GAS Editor. |
| `deploy-pwa.yml` | push `main` yang menyentuh `apps/pwa/monitor-{saldo,order,koordinator}/**` | `vercel deploy --prod` ke 3 project Vercel terpisah. Butuh secret `VERCEL_TOKEN`. |

**Modules under `modules/*` deploy otomatis** via Vercel git integration di
project `rifim-os` (production). Push ke `main` → Vercel build → live di
`rifim-os.vercel.app` dalam 1-2 menit.

---

## GAS Web App — Route Surface (`webApp.js`)

`doGet(e)` dan `doPost(e)` adalah entry point tunggal untuk seluruh module.
Dispatch order:

**`doGet(e)`** — Query param `?action=<name>`:
1. `crmHandleGet(e)` — return early kalau action CRM/Finance (lihat tabel di atas)
2. `staff_list`, `companies`, `peek`, `auth`
3. HRIS: `hris_employees`, `hris_employee`, `hris_contracts`, `hris_attendance`, `hris_leave_requests`, `hris_leave_balance`, `hris_payroll`
4. Smart Office: `arsip`, `get_document`
5. Default: health check `{success:true, app:'RIFIM OS Smart Office', version:'1.0.0'}`

**`doPost(e)`** — JSON body dengan `input.hrisAction` atau `input.action`:
1. `hrisAction: '*'` → `_handleHrisPost(input)` (HRIS write endpoints)
2. `action: 'previewDocument'` — Smart Office HTML preview
3. `action: 'generateDocumentHtml'` — HTML → PDF pipeline
4. `action: 'update_status'` — dokumen DRAFT → FINAL → SENT → ARCHIVED
5. `action: 'log_activity'` — write ke sheet SYSTEM_LOG

**Content-Type:** frontend HARUS pakai `text/plain` untuk skip CORS preflight
(GAS Web App tidak set CORS header untuk OPTIONS).

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
