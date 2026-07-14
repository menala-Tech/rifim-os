# /simpan-sesi-rifim-os

> Trigger akhir sesi RIFIM OS. Jalankan save sequence ini sebelum menutup Claude Code.

## Save Sequence (WAJIB, BERURUTAN)

1. **Cek git status** — lihat file yang berubah/belum di-commit
2. **Update docs/STATUS.md:**
   - Tandai task yang selesai di sprint checklist (⬜ → ✅)
   - Tambahkan catatan progress/temuan penting di sesi ini
   - Update baris `Last updated:` ke tanggal hari ini
3. **Commit semua perubahan** dengan pesan deskriptif (format: `type(scope): deskripsi`)
4. **Push ke branch aktif** (`git push -u origin <branch>`)
5. **Laporkan ringkasan sesi ke user:**
   - ✅ Task yang selesai hari ini
   - ⬜ Task yang belum selesai / pending lanjut
   - ⚠️ Masalah / blocker yang ditemukan
   - 🔜 Saran task pertama untuk sesi berikutnya

## Aturan Save

- Jangan push ke `main` langsung — selalu ke branch aktif
- Jangan commit file secret / `.env` / token
- Jangan commit file temporary di folder `temp/`
- Jika ada PR yang sudah merged → buat branch baru dari `main` untuk lanjutan
- STATUS.md HARUS di-commit terakhir (setelah semua kode selesai)

## Format Ringkasan Sesi (output ke user)

```
📋 RINGKASAN SESI — [tanggal]

✅ Selesai:
- [task 1]
- [task 2]

⬜ Lanjut sesi berikutnya:
- [task pending 1]
- [task pending 2]

⚠️ Catatan penting:
- [blocker / keputusan yang perlu konfirmasi user]

🔜 Mulai dari sini di sesi berikutnya:
- [satu kalimat task pertama yang jelas]
```
