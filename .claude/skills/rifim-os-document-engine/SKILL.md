---
name: rifim-os-document-engine
description: Document Engine RIFIM OS — HTML→PDF pipeline default untuk semua dokumen (SK, PKWT, Surat Tugas, Invoice, dll) via automation/apps-script/htmlTemplateEngine.js, blueprint arsitektur, Design Document System (DDS v3.0) — kop+footer banner PNG, signature composite via Slides API, spec presisi mm, TYPOGRAPHY/LETTER_STRUCTURE/TABLE_SYSTEM/PDF_EXPORT/GOOGLE_DOCS/MICROSOFT_WORD/QR_SYSTEM. Gunakan skill ini setiap kali user minta generate dokumen (SK karyawan, kontrak PKWT, surat tugas, invoice, laporan PDF), edit template dokumen, atau ubah kop/footer/signature/tabel — bahkan kalau user hanya sebut "template", "surat", "dokumen resmi", "generate PDF".
---

# Document Engine — RIFIM OS

## Blueprint Arsitektur

Baca dulu sebelum ubah engine dokumen:
- Blueprint: `docs/04-Architecture/DOCUMENT_ENGINE.md`
- Design system induk: `docs/09-UI-UX/document-design-system/DDS_v1.0.md`

## Spec Presisi Layout

- `docs/09-UI-UX/document-design-system/PAGE_LAYOUT.md`
- `HEADER_SYSTEM.md` — kop
- `FOOTER_SYSTEM.md` — footer
- `SIGNATURE_SYSTEM.md` — tanda tangan + stempel composite

## Struktur & Tipografi

- `TYPOGRAPHY.md` — font hierarchy dokumen
- `LETTER_STRUCTURE.md` — struktur surat resmi
- `TABLE_SYSTEM.md` — spec tabel di dokumen

## Export Target

- `PDF_EXPORT.md` — HTML→PDF via Drive.Files.insert
- `GOOGLE_DOCS.md` — export ke Google Docs
- `MICROSOFT_WORD.md` — export ke .docx
- `QR_SYSTEM.md` — QR code embed

## Batasan AI

`docs/10-AI/AI_RULES.md` — do/don't AI generation dokumen.

## Implementasi Engine

**File utama:** `automation/apps-script/htmlTemplateEngine.js` — HTML→PDF pipeline default untuk semua dokumen.

## GAS Advanced Services WAJIB Enabled

Di `appsscript.json`:
- Drive v2
- Slides v1

**Scope:** `/auth/documents`, `/auth/drive`, `/auth/presentations`.

## Engines Registry (Status Sprint 2026-08)

| Engine | Purpose | Status |
|---|---|---|
| Document Engine | Generate semua jenis dokumen | ✅ Phase 1 Done — HTML→PDF pipeline |
| Placeholder Engine | Replace placeholder di template | ✅ Phase 1 Done |
| Numbering Engine | Auto-generate nomor dokumen | ✅ Phase 1 Done |
| PDF Engine | Convert ke PDF | ✅ Phase 1 Done |
| Drive Manager | Kelola Google Drive | ✅ Phase 1 Done |
| Database Layer | Abstraksi akses DB | ✅ Phase 1 Done |
| Notification Engine | Email & WhatsApp | ✅ Phase 3 Done |
| WA Engine | Fonnte API + templates per modul | ✅ Phase 3 Done |
| QR Engine | Generate QR code | ✅ Phase 2 Done |
| Auth Engine | Auth & role | ✅ Phase 2 Done — RCP 4-level Sprint 3B |
| Branding Engine | Logo perusahaan ke Sheet | ✅ Sprint 2 Done |
| Driver Layer | CRUD driver RAOS + sync | ✅ Sprint 2 Done |
| Staff Sync Layer | CRUD staff HRIS + sync | ✅ Sprint 2 Done |
| Chat Engine | Supabase Realtime, event bus | ⬜ Sprint 3B |
| Workflow Engine | Draft→Review→Approval→Signed | ⬜ Backlog |
| Revision Engine | Versioning + change log | ⬜ Backlog |
| Audit Engine (immutable) | Aktivitas dokumen tercatat permanen | ⬜ Backlog |
| Mode Kerja Engine | Work status routing | ⬜ Sprint 3B |

## Missing Documentation

Belum ada tapi link sudah disiapkan: `docs/09-UI-UX/document-design-system/AUTOMATION_RULES.md`.

## Spec Sumber

Requirement asli dokumen 3 perusahaan: `docs/09-UI-UX/document-design-system/_source/ROLE_Document_letterhead_dan_Footer_3_Perusahaan.md`.

## Prinsip

**Engine First** — bangun engine sebelum fitur. Salah pattern: `GenerateLetter()`, `GenerateInvoice()`, `GeneratePKWT()` masing-masing berdiri sendiri. Benar: `Document Engine → GenerateLetter(), GenerateInvoice(), GeneratePKWT()`.
