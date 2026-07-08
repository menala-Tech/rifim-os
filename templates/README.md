# templates/

> Template resmi seluruh dokumen perusahaan PT. RIFIM Internasional Gemilang.

---

## Rules

- Semua template menggunakan Placeholder Standard `{{PLACEHOLDER}}`
- Jangan hardcode nama perusahaan, tanggal, atau data dinamis apapun
- Template hanya berisi struktur — data diisi oleh Placeholder Engine
- Format template: Google Docs (untuk Smart Office)

---

## Standard Placeholders

| Placeholder | Description |
|------------|-------------|
| `{{DOCUMENT_NUMBER}}` | Nomor dokumen otomatis |
| `{{DOCUMENT_DATE}}` | Tanggal dokumen |
| `{{DOCUMENT_TYPE}}` | Jenis dokumen |
| `{{COMPANY_NAME}}` | Nama perusahaan |
| `{{COMPANY_ADDRESS}}` | Alamat perusahaan |
| `{{RECIPIENT_NAME}}` | Nama penerima |
| `{{RECIPIENT_COMPANY}}` | Perusahaan penerima |
| `{{BODY}}` | Isi dokumen |
| `{{SIGNATURE}}` | Tanda tangan |
| `{{QR_CODE}}` | QR code verifikasi |
| `{{FOOTER}}` | Footer dokumen |

---

## Document Types (smart-office/)

| Folder | Jenis Dokumen |
|--------|--------------|
| `surat/` | Surat resmi perusahaan |
| `invoice/` | Invoice tagihan |
| `kwitansi/` | Kwitansi pembayaran |
| `proposal/` | Proposal kerjasama |
| `mou/` | Memorandum of Understanding |
| `pkwt/` | Perjanjian Kerja Waktu Tertentu |
| `sp/` | Surat Peringatan |
| `berita-acara/` | Berita Acara |
| `surat-tugas/` | Surat Tugas |
| `company-profile/` | Company Profile |
| `pakta-integritas/` | Pakta Integritas |
