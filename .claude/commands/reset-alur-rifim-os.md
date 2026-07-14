# /reset-alur-rifim-os

> Trigger koreksi jalur di tengah sesi. Gunakan ketika Claude mulai menyimpang dari arsitektur, coding tanpa baca docs, atau melanggar rules.

## Reset Sequence (WAJIB, BERURUTAN)

1. **STOP** — hentikan semua coding yang sedang berjalan
2. **Re-baca CLAUDE.md** — khususnya section: Core Principles, Design System, RCP Model, Mode Kerja
3. **Re-baca PROJECT_RULES.md** — khususnya Business Rules BR-01–BR-10, Chat Rules, Integration Rules
4. **Evaluasi pekerjaan terakhir:**
   - Apakah melanggar "Never Duplicate"?
   - Apakah melanggar "Never Hardcode"?
   - Apakah menggunakan design token yang benar?
   - Apakah RCP / cabang / Business Rules sudah diterapkan?
   - Apakah ada kode yang dibuat sebelum analisa selesai?
5. **Laporkan temuan ke user:**
   - Apa yang menyimpang
   - Kenapa menyimpang
   - Apa yang perlu diperbaiki
   - Rencana koreksi
6. **Tunggu konfirmasi user** sebelum lanjut coding

## Penyimpangan yang Wajib Direset

| Kondisi | Tanda Penyimpangan |
|---------|-------------------|
| Hardcode warna hex langsung | Seharusnya pakai `--primary`, `--chat-accent`, dll |
| Membuat fungsi baru yang sudah ada | Cek dulu: apakah engine ini sudah ada? |
| Koordinator lihat data semua cabang | Langgar BR-01 — filter wajib per cabang |
| Saldo bisa negatif | Langgar BR-06 — tolak transaksi |
| Commit ke `main` langsung | Harus ke branch aktif |
| Coding sebelum analisa selesai | Langgar Protokol Analisa Batch |
| Auth hanya return role saja | Harus RCP 4-level: role+cabang+permission[]+scope |
| Queue format `A001` | Harus `A-023` |
| Cabang selain 7 kode resmi | BTH/JBI/PKU/BPN/MDC/MKS/CGK saja |
| Timestamp bukan ISO UTC | Harus `YYYY-MM-DDTHH:mm:ss.sssZ` via `_gasNow()` |
| Write tanpa ScriptLock | Langgar Rule 41 — wajib `_gasWithLock(fn)` |

## Output ke User

```
🔄 RESET ALUR — [timestamp]

⚠️ Penyimpangan yang ditemukan:
- [deskripsi konkret apa yang menyimpang]

📋 Root cause:
- [kenapa bisa menyimpang]

🛠️ Rencana koreksi:
- [langkah konkret untuk kembali ke jalur benar]

❓ Konfirmasi:
Apakah saya lanjut dengan rencana koreksi di atas?
```
