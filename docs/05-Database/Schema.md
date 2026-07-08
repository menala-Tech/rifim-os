# Database Schema — Smart Office

Version: 1.0
Phase: Phase 1 — Google Sheets

---

## Sheet: documents

Menyimpan semua dokumen yang telah dibuat.

| Column | Type | Example | Notes |
|--------|------|---------|-------|
| id | String | `DOC-20260709-001` | Auto-generated |
| document_number | String | `001/RIFIM/SURAT/VII/2026` | From Numbering Engine |
| document_type | String | `SURAT` | Enum: SURAT, INVOICE, KWITANSI, PROPOSAL, MOU, PKWT, SP, BERITA_ACARA, SURAT_TUGAS |
| document_date | Date | `2026-07-09` | ISO format |
| recipient_name | String | `PT. Teknologi Perdana Indonesia` | |
| recipient_address | String | `Jakarta` | |
| subject | String | `Penawaran Kerjasama` | Perihal |
| body | Text | `...` | Isi dokumen |
| attachment | String | `1 (Satu) Berkas` | Lampiran |
| status | String | `DRAFT` | DRAFT / FINAL / ARCHIVED |
| gdoc_url | String | `https://docs.google.com/...` | Link Google Doc |
| pdf_url | String | `https://drive.google.com/...` | Link PDF |
| qr_url | String | `https://...` | Link QR code |
| created_by | String | `admin@rifim.com` | |
| created_at | DateTime | `2026-07-09T10:00:00` | |
| updated_at | DateTime | `2026-07-09T10:00:00` | |

---

## Sheet: numbering_sequences

Menyimpan counter nomor per jenis dokumen per bulan.

| Column | Type | Example | Notes |
|--------|------|---------|-------|
| doc_type | String | `SURAT` | |
| month | Integer | `7` | 1–12 |
| year | Integer | `2026` | |
| last_sequence | Integer | `45` | Auto-increment |
| last_updated | DateTime | `2026-07-09T10:00:00` | |

---

## Sheet: company_config

Konfigurasi data perusahaan. Digunakan oleh Placeholder Engine.

| Key | Value |
|-----|-------|
| COMPANY_NAME | PT. RIFIM Internasional Gemilang |
| COMPANY_SHORT | RIFIM |
| COMPANY_CODE | RIG |
| COMPANY_ADDRESS | Fanindo Blok S No. 20, Tanjung Uncang, Batu Aji, Kota Batam |
| COMPANY_PHONE | +62 821 7010 2349 |
| COMPANY_EMAIL | rifiminternasionalgemilang@gmail.com |
| COMPANY_WEBSITE | www.rifimgroup.com |
| DIRECTOR_NAME | BOBBY RAHMAN M.B |
| DIRECTOR_TITLE | Direktur Utama |
| CITY | Batam |
| TAGLINE | Membangun Hari Ini, Menginspirasi Masa Depan |
| TEMPLATE_FOLDER_ID | (Google Drive folder ID — set saat deployment) |
| OUTPUT_FOLDER_ID | (Google Drive folder ID — set saat deployment) |

---

## Notes

- Semua ID dan URL Google Drive disimpan di `company_config`, bukan hardcoded
- Schema ini dirancang untuk dapat dimigrasi ke Supabase PostgreSQL tanpa perubahan logika bisnis
- Tambah kolom baru harus dicatat di dokumen ini sebelum implementasi
