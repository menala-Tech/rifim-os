# CLAUDE.md

> RIFIM OS — Claude Code Operating Manual

Version: 1.2
Status: Active
Last updated: 2026-07-14 (Design System, 7 Cabang, RCP 4-level, Mode Kerja, Chat Engine)

---

## Integration Rules — SSoT Data Contract (MUTLAK, BACA PERTAMA)

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

## Working Directory (WAJIB)

**Semua file proyek HANYA boleh dibaca dan disimpan di:**

```
C:\Users\ADMIN\Documents\RIFIM\rifim-os
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
| Document Engine | Generate semua jenis dokumen | ✅ Phase 1 Done |
| Placeholder Engine | Replace placeholder di template | ✅ Phase 1 Done |
| Numbering Engine | Auto-generate nomor dokumen | ✅ Phase 1 Done |
| PDF Engine | Convert ke PDF | ✅ Phase 1 Done |
| Drive Manager | Kelola Google Drive | ✅ Phase 1 Done |
| Database Layer | Abstraksi akses database | ✅ Phase 1 Done |
| Notification Engine | Email & WhatsApp | ✅ Phase 3 Done (WA terintegrasi semua modul) |
| WA Engine | Fonnte API, templates per modul | ✅ Phase 3 Done |
| QR Engine | Generate QR code | ✅ Phase 2 Done |
| Auth Engine | Authentication & role | ✅ Phase 2 Done — upgrade ke RCP 4-level (Sprint 3B) |
| Branding Engine | Logo perusahaan ke Sheet (PDF-ready) | ✅ Sprint 2 Done |
| Driver Layer | CRUD driver RAOS + sync Supabase→Sheet | ✅ Sprint 2 Done |
| Staff Sync Layer | CRUD staff HRIS + sync Supabase→Sheet | ✅ Sprint 2 Done |
| Chat Engine | Supabase Realtime, 10 rooms, event bus | ⬜ Sprint 3B |
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

| Nama Project | Script ID | Lokasi Lokal | File Utama |
|---|---|---|---|
| RIFIM OS (Main) | `1IK8-2anrxahce1X1MG7Bi3aGe6e-_4e3obanTRprT6brYSdla9rEYOxp` | `automation/apps-script/` | `raosMonitoringEngine.js` dll |
| Pengisian Saldo | `1_V2BOS56ac1v0mzte2rfl3at4wmc31foeKoLddZ6SeYRhSc_B2icbcUz` | `C:\Users\ADMIN\Documents\RIFIM\RIFIM\ADM Surat\isi saldo` | `MonitoringSaldo.js` |

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
