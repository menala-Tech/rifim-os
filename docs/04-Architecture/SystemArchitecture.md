# System Architecture — RIFIM OS

Version: 1.0
Phase: Sprint 1 — Smart Office

---

## Overview

RIFIM OS menggunakan arsitektur berlapis (layered architecture) yang memisahkan concern antara UI, business logic, engine, dan data.

```
┌─────────────────────────────────────────────┐
│              PRESENTATION LAYER              │
│         HTML / CSS / JavaScript (PWA)        │
└──────────────────────┬──────────────────────┘
                       │
┌──────────────────────▼──────────────────────┐
│               MODULE LAYER                   │
│  Smart Office │ RAOS │ HRIS │ Finance │ CRM  │
└──────────────────────┬──────────────────────┘
                       │
┌──────────────────────▼──────────────────────┐
│               ENGINE LAYER                   │
│  Document │ Numbering │ PDF │ QR │ Notif     │
└──────────────────────┬──────────────────────┘
                       │
┌──────────────────────▼──────────────────────┐
│              SERVICE LAYER                   │
│   Google Apps Script │ Drive │ Sheets │ Docs │
└──────────────────────┬──────────────────────┘
                       │
┌──────────────────────▼──────────────────────┐
│               DATA LAYER                     │
│   Phase 1: Google Sheets                     │
│   Phase 2: Supabase PostgreSQL               │
└─────────────────────────────────────────────┘
```

---

## Phase 1 — Smart Office Flow

```
User (Browser/PWA)
        │
        ▼
  Dashboard Form
  [Pilih Jenis Dokumen]
  [Input Data]
        │
        ▼
  Google Apps Script
  ┌─────────────────────────┐
  │  1. Validate Input       │
  │  2. Numbering Engine     │ → Generate nomor unik
  │  3. Placeholder Engine   │ → Replace {{placeholder}}
  │  4. Document Engine      │ → Copy template → Isi data
  │  5. PDF Engine           │ → Export ke PDF
  │  6. Drive Manager        │ → Simpan ke folder yang tepat
  │  7. Database Layer       │ → Catat ke Google Sheets
  │  8. QR Engine            │ → Generate QR verifikasi
  │  9. Notification Engine  │ → Kirim email/WhatsApp (opsional)
  └─────────────────────────┘
        │
        ▼
  Output:
  - Google Doc (editable)
  - PDF (final)
  - QR Code (verifikasi)
  - Record di Database
```

---

## Engine Responsibilities

| Engine | Input | Output | Location |
|--------|-------|--------|----------|
| Numbering Engine | docType, month, year | `001/RIFIM/SP/VII/2026` | `automation/numbering/` |
| Placeholder Engine | templateId, data object | Google Doc dengan data terisi | `automation/apps-script/` |
| Document Engine | docType, data | Google Doc final | `automation/apps-script/` |
| PDF Engine | Google Doc ID | PDF file di Drive | `automation/pdf/` |
| Drive Manager | fileId, docType | Organized file di Drive | `automation/apps-script/` |
| Database Layer | record object | Row di Google Sheets | `automation/apps-script/` |
| QR Engine | documentNumber, docUrl | QR code image | `automation/qr/` |

---

## Folder di Google Drive (Production)

```
RIFIM OS/
├── Smart Office/
│   ├── Surat/
│   ├── Invoice/
│   ├── Kwitansi/
│   ├── Proposal/
│   ├── MOU/
│   ├── PKWT/
│   ├── Surat Peringatan/
│   ├── Berita Acara/
│   ├── Surat Tugas/
│   └── Company Profile/
├── Templates/              ← Template master (jangan diedit langsung)
└── Archive/
```

---

## Document Numbering Format

```
[SEQ]/[COMPANY]-[TYPE]/[MONTH-ROMAN]/[YEAR]

Contoh:
001/RIFIM/SURAT/VII/2026
045/RIG-ADV/VI/2026
001/RIFIM/INV/VII/2026
001/RIFIM/PKWT/VII/2026
001/RIFIM/SP/VII/2026
```

| Field | Format | Keterangan |
|-------|--------|------------|
| SEQ | 3 digit | Reset per bulan |
| COMPANY | String | RIFIM / RIG-ADV |
| TYPE | String | SURAT / INV / PKWT / SP / MOU |
| MONTH | Roman numeral | I–XII |
| YEAR | 4 digit | 2026 |

---

## Tech Stack Phase 1

| Layer | Technology | Reason |
|-------|-----------|--------|
| Frontend | HTML + CSS + Vanilla JS | Simple, no build step |
| Backend | Google Apps Script | Free, integrated dengan Google Workspace |
| Database | Google Sheets | Zero cost, familiar untuk admin |
| Storage | Google Drive | Terintegrasi dengan GAS |
| Hosting | Google Apps Script Web App | Deploy langsung dari GAS |
| PDF | GAS built-in DriveApp | No external dependency |
| QR | QR Server API | Free tier cukup |

---

## Migration Path ke Phase 2

Schema Google Sheets dirancang mengikuti struktur relasional agar bisa migrasi ke Supabase tanpa perubahan arsitektur.

Setiap sheet = satu tabel.
Setiap kolom menggunakan nama yang sama dengan field di Supabase schema.
