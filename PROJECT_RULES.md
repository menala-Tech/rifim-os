# PROJECT RULES

> Aturan ini wajib diikuti oleh seluruh developer dan AI yang berkontribusi pada RIFIM OS.

Version: 1.0
Status: Active

---

## Architecture Rules

| # | Rule |
|---|------|
| 01 | Semua modul harus reusable |
| 02 | Tidak boleh ada duplicate code |
| 03 | Semua dokumen menggunakan Document Engine |
| 04 | Semua nomor dokumen menggunakan Numbering Engine |
| 05 | Semua template menggunakan Placeholder Engine |
| 06 | Semua file harus terdokumentasi |
| 07 | Tidak boleh hardcode nilai apapun |
| 08 | Semua perubahan harus update CHANGELOG.md |
| 09 | Semua AI wajib membaca docs sebelum coding |
| 10 | Semua keputusan arsitektur harus mengikuti Blueprint |

---

## Folder Rules

| # | Rule |
|---|------|
| 11 | Ikuti struktur folder di `FOLDER_STRUCTURE.md` |
| 12 | Folder baru hanya boleh dibuat dengan alasan jelas |
| 13 | Folder baru wajib diupdate di `FOLDER_STRUCTURE.md` |
| 14 | Gunakan `lowercase-kebab-case` untuk nama folder |
| 15 | Jangan simpan source code di folder `docs/` |

---

## Naming Convention

| Type | Convention | Example |
|------|-----------|---------|
| Folder | lowercase-kebab-case | `smart-office` |
| File JS | camelCase | `documentEngine.js` |
| File Markdown | PascalCase | `README.md` |
| Function | camelCase | `generateDocument()` |
| Variable | camelCase | `documentNumber` |
| Constant | UPPER_SNAKE | `MAX_RETRY_COUNT` |
| Placeholder | UPPER_SNAKE `{{}}` | `{{DOCUMENT_NUMBER}}` |

---

## Commit Convention

Format: `type(scope): description`

| Type | Usage |
|------|-------|
| `feat` | Fitur baru |
| `fix` | Bug fix |
| `docs` | Dokumentasi |
| `refactor` | Refactor tanpa perubahan fungsional |
| `test` | Testing |
| `chore` | Setup, config, maintenance |

---

## Database Rules

| # | Rule |
|---|------|
| 16 | Phase 1 menggunakan Google Sheets |
| 17 | Phase 2 menggunakan Supabase |
| 18 | Desain schema harus siap migrasi ke Supabase |
| 19 | Jangan hardcode Spreadsheet ID |
| 20 | Jangan duplikasi schema |

---

## Security Rules

| # | Rule |
|---|------|
| 21 | Jangan commit API Keys / Secrets |
| 22 | Gunakan config file untuk credentials |
| 23 | Jangan expose data internal ke public endpoint |

---

*Pelanggaran terhadap aturan ini harus didiskusikan sebelum implementasi.*
