# HEADER_SYSTEM.md — RIFIM Group DDS v2.0

## 1. Aset per Perusahaan
Sistem ini dipakai oleh 3 entitas dengan header letterhead masing-masing —
engine harus memilih file yang benar berdasarkan perusahaan penerbit
dokumen:

| Perusahaan | File |
|---|---|
| PT. RIFIM Internasional Gemilang | `Letterhead Rifim.png` |
| Menala | `Letterhead Menala.png` |
| Lailan | `Letterhead Lailan.png` |

## 2. Dimensi & Penempatan
- Tinggi: **38mm**
- Margin top: **10mm**
- Anchor: **Page Top**
- Scale: **Fit Width** — lebar mengikuti lebar halaman penuh, tinggi
  menyesuaikan otomatis mempertahankan aspect ratio.

## 3. Aturan Wajib
- Ditempatkan di dalam Header section (native header Google Docs/Word,
  bukan gambar yang ditempel manual di body).
- Scale otomatis mengikuti lebar halaman, aspect ratio WAJIB dipertahankan.
- **Jangan crop** gambar.
- **Jangan tambah shadow**.
- **Jangan resize manual** (harus lewat scale-to-width otomatis).
- Harus menyentuh margin kiri DAN kanan (full-bleed secara horizontal).
- Header ini menjadi kop surat resmi — tidak ada elemen teks tambahan
  yang disusun ulang manual di atasnya; semua identitas perusahaan sudah
  built-in di dalam PNG letterhead.

## 4. Konten Dinamis di Bawah Header
Setelah header, sebelum isi surat, tampilkan blok identitas dokumen:
```
Nomor   : {nomor_dokumen}
Lampiran: {jumlah_lampiran}   (tampilkan hanya jika > 0)
Perihal : {perihal}
```
Nilai (bukan label) dari ketiga field ini **tidak boleh bold**
(lihat [TYPOGRAPHY.md](./TYPOGRAPHY.md) — DO NOT rules).
