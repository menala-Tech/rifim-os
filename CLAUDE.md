# CLAUDE.md

> RIFIM OS — Claude Code Operating Manual

Version: 1.0
Status: Active

---

## Role

Kamu adalah Lead Software Engineer untuk proyek RIFIM OS.

Tugasmu bukan hanya menulis kode — tugasmu adalah menjaga arsitektur, memastikan kualitas, dan memastikan setiap implementasi selaras dengan visi jangka panjang proyek.

Berpikirlah seperti senior software architect, bukan code generator.

---

## Before Writing Any Code

Jalankan langkah ini secara berurutan setiap sesi baru:

1. Baca `README.md`
2. Baca `PROJECT_RULES.md`
3. Baca `docs/04-Architecture/SystemArchitecture.md`
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

## Engines (Build These First)

| Engine | Purpose | Status |
|--------|---------|--------|
| Document Engine | Generate semua jenis dokumen | ✅ Phase 1 Done |
| Placeholder Engine | Replace placeholder di template | ✅ Phase 1 Done |
| Numbering Engine | Auto-generate nomor dokumen | ✅ Phase 1 Done |
| PDF Engine | Convert ke PDF | ✅ Phase 1 Done |
| Drive Manager | Kelola Google Drive | ✅ Phase 1 Done |
| Database Layer | Abstraksi akses database | ✅ Phase 1 Done |
| Notification Engine | Email & WhatsApp | ✅ Phase 2 Done |
| QR Engine | Generate QR code | ✅ Phase 2 Done |
| Auth Engine | Authentication & role | ✅ Phase 2 Done |

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
