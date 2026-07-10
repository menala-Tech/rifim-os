# Google Sheets Setup — RIFIM OS

## Langkah-Langkah Setup (Lakukan Sekali Saja)

---

### STEP 1 — Buat Google Spreadsheet Baru

1. Buka **[sheets.google.com](https://sheets.google.com)**
2. Klik **+ Blank** → spreadsheet kosong baru terbuka
3. Catat **Spreadsheet ID** dari URL:
   ```
   https://docs.google.com/spreadsheets/d/[SPREADSHEET_ID]/edit
   ```

---

### STEP 2 — Buka Apps Script

1. Di spreadsheet, klik menu **Extensions → Apps Script**
2. Tab baru terbuka (Google Apps Script editor)
3. Hapus isi file `Code.gs` yang ada

---

### STEP 3 — Paste Script Setup

1. Buka file `automation/apps-script/setupDatabase.js` dari repo
2. Copy semua isinya
3. Paste ke editor Apps Script
4. Klik **Save** (ikon disket atau Ctrl+S)

---

### STEP 4 — Jalankan Setup

1. Di dropdown fungsi (tengah atas), pilih **`setupRIFIMDatabase`**
2. Klik tombol **▶ Run**
3. Akan muncul popup izin → klik **Review permissions**
4. Pilih akun Google Anda → klik **Allow**
5. Tunggu beberapa detik → muncul dialog sukses ✅

---

### STEP 5 — Verifikasi Sheet

Spreadsheet sekarang punya **6 sheet**:

| Sheet | Isi |
|---|---|
| `documents` | Arsip semua dokumen yang dibuat |
| `numbering_sequences` | Penomoran otomatis per jenis dokumen |
| `company_config` | Konfigurasi perusahaan & Google Drive IDs |
| `doc_types` | Referensi 20 jenis dokumen |
| `employees` | Data karyawan sync dari HRIS (Supabase) |
| `activity_log` | Log semua aktivitas: LOGIN, LOGOUT, TAMBAH, EDIT, RESIGN, BUAT DOKUMEN |

---

### STEP 6 — Isi company_config

Di sheet `company_config`, isi kolom **value** untuk baris berikut:

| Key | Yang Perlu Diisi |
|---|---|
| `company_npwp` | Nomor NPWP perusahaan |
| `company_nib` | Nomor Induk Berusaha |
| `drive_root_folder_id` | ID folder utama di Google Drive (lihat di bawah) |
| `gdoc_template_surat` | ID template Google Doc Surat (setelah dibuat) |
| `gdoc_template_inv` | ID template Google Doc Invoice |
| `gdoc_template_pkwt` | ID template Google Doc PKWT |
| `gdoc_template_sp` | ID template Google Doc SP |
| `gdoc_template_mou` | ID template Google Doc MoU |

---

### STEP 7 — Buat Folder Drive

Buat struktur folder ini di **Google Drive**:

```
📁 RIFIM SMART OFFICE
  ├── 📁 Surat
  ├── 📁 Invoice
  ├── 📁 Kwitansi
  ├── 📁 Kontrak
  ├── 📁 SP
  ├── 📁 Proposal
  ├── 📁 MOU
  ├── 📁 Berita Acara
  └── 📁 _Templates
```

Cara ambil **Folder ID** dari URL:
```
https://drive.google.com/drive/folders/[FOLDER_ID]
```

Salin `FOLDER_ID` ke `company_config` → baris `drive_root_folder_id`.

---

### STEP 8 — Hubungkan ke Apps Script Engine

1. Di Apps Script editor, tambahkan file baru
2. Paste isi file-file berikut dari repo satu per satu:
   - `configLoader.js`
   - `numberingEngine.js`
   - `documentEngine.js`
   - `placeholderEngine.js`
   - `databaseLayer.js`
   - `driveManager.js`
   - `pdfEngine.js`
   - `documentTypes.js`
3. Di `configLoader.js`, pastikan `SPREADSHEET_ID` diisi dengan ID dari Step 1

---

### STEP 9 — Test Generate Pertama

1. Di Apps Script, pilih fungsi **`testGenerateDocument`**
2. Klik Run
3. Cek Google Drive → folder Surat → dokumen baru muncul ✅
4. Cek sheet `documents` → baris baru muncul ✅
5. Cek sheet `numbering_sequences` → sequence +1 ✅

---

## Struktur Sheet Detail

### `documents`
| Kolom | Type | Keterangan |
|---|---|---|
| id | String | UUID unik tiap dokumen |
| document_number | String | `001/RIFIM/SURAT/VII/2026` |
| document_type | String | Label (Surat Resmi, Invoice, ...) |
| document_code | String | Kode (SURAT, INV, PKWT, ...) |
| document_date | Date | Tanggal dokumen |
| recipient_name | String | Penerima / nama karyawan |
| recipient_address | String | Alamat penerima |
| subject | String | Perihal / judul |
| attachment | String | Lampiran |
| body_summary | String | Ringkasan isi (bukan full body) |
| status | Enum | `DRAFT` / `FINAL` / `SENT` / `ARCHIVED` |
| gdoc_url | URL | Link Google Doc |
| pdf_url | URL | Link PDF di Drive |
| qr_url | URL | Link QR Code (opsional) |
| created_by | String | Nama pembuat |
| created_at | DateTime | Waktu dibuat |
| updated_at | DateTime | Waktu terakhir diubah |

### `numbering_sequences`
| Kolom | Type | Keterangan |
|---|---|---|
| document_code | String | SURAT, INV, PKWT, ... |
| year | Number | 2026 |
| month | Number | 7 |
| month_roman | String | VII |
| last_sequence | Number | Nomor urut terakhir |

### `company_config`
Key-value store. Key = nama konfigurasi, Value = nilainya.

### `doc_types`
Referensi read-only untuk 20 jenis dokumen. Dipakai engine untuk validasi.

---

## Troubleshooting

| Masalah | Solusi |
|---|---|
| "You do not have permission" | Jalankan ulang, pilih Allow di popup izin |
| Sheet tidak terbuat | Pastikan Spreadsheet baru dan kosong |
| Nomor tidak urut | Cek sheet `numbering_sequences`, kolom `last_sequence` |
| Drive folder tidak ditemukan | Pastikan `drive_root_folder_id` diisi di `company_config` |
