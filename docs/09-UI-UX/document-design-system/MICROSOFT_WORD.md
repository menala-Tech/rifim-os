# MICROSOFT_WORD.md — RIFIM Group DDS v2.0

## 1. Status
Ekspor ke format Word (.docx) BELUM menjadi fitur aktif di RIFIM OS
(sistem live saat ini hanya punya 2 pipeline: `html` → PDF langsung, dan
`gdocs` → Google Docs + PDF). Modul ini disiapkan sebagai spesifikasi
untuk fitur mendatang, supaya saat diimplementasikan tetap konsisten
dengan DDS, bukan ditambal terpisah.

## 2. Metode Pembuatan (rencana)
- Gunakan library pembuat .docx terprogram (mis. `docx` npm package)
  yang membaca struktur data dokumen YANG SAMA dengan yang dipakai
  html-engine untuk PDF — satu sumber data, output berbeda, supaya tidak
  ada duplikasi logika penyusunan konten.
- Sama seperti pipeline lain, Word yang dihasilkan harus tahu entitas
  penerbit (RIFIM/MIG/LAILAN) untuk memilih letterhead, footer, dan data
  identitas perusahaan yang benar dari sheet `companies`.

## 3. Penyesuaian Satuan
- Margin, ukuran font, dan layout dikonversi ke satuan Word (twips: 1mm ≈
  56.7 twips) mengikuti nilai yang sama persis dengan [PAGE_LAYOUT.md](./PAGE_LAYOUT.md) dan
  [TYPOGRAPHY.md](./TYPOGRAPHY.md) — TIDAK ada nilai baru yang dikarang khusus untuk Word.
- Letterhead & footer banner disisipkan sebagai gambar di header/footer
  section Word native (bukan di body), supaya otomatis berulang di
  setiap halaman.

## 4. Font
- Font default dokumen harus **Aptos**, fallback **Calibri** (sesuai
  [TYPOGRAPHY.md](./TYPOGRAPHY.md) §1) — set eksplisit di style `Normal` dokumen, jangan
  mengandalkan default Word yang bisa berbeda per instalasi/regional
  setting pengguna.

## 5. Kapan Word Dibutuhkan
- Kasus pemakaian utama: dokumen yang butuh negosiasi/redline sebelum
  final (MoU, PKS, Kontrak PKWT) — pihak mitra sering minta versi Word
  yang bisa di-track-changes, PDF tidak cukup untuk kasus ini.
- Dokumen sekali-jadi (Kwitansi, Invoice, SP) tidak prioritas untuk
  output Word.

## 6. Penamaan File
Sama seperti [PDF_EXPORT.md](./PDF_EXPORT.md) §3, ganti ekstensi:
```
{PREFIX_ENTITAS}-{KODE_JENIS}-{nomor_urut}-{tahun}.docx
```

## 7. Konsistensi dengan Pipeline Lain
Kalau fitur ini dibangun, ikuti prinsip yang sama dengan [AUTOMATION_RULES.md](./AUTOMATION_RULES.md)
§4.1 (Single Source of Truth untuk Render) — jumlah "halaman" Word
(sejauh konsepnya relevan di Word) harus konsisten dengan hasil PDF untuk
dokumen yang sama, dihitung dari pre-pass measurement yang sama
([AUTOMATION_RULES.md](./AUTOMATION_RULES.md) §1.2), bukan dihitung ulang secara terpisah dengan
logika Word-specific yang berbeda.
