# PDF_EXPORT.md — RIFIM Group DDS v2.0

## 1. Kualitas Output
- **High Quality PDF**
- **300 DPI**
- **Fonts embedded** (Aptos, fallback Calibri, harus di-embed penuh)
- **Preserve PNG transparency** — letterhead, footer, signature, stamp
  semua PNG alpha, transparansi tidak boleh hilang saat konversi ke PDF.
- **No compression** — jangan kompres gambar/PDF sama sekali, prioritas
  kualitas cetak di atas ukuran file.

## 2. Setting Halaman
```css
@page {
  size: A4;
  margin: 1cm 2.5cm 1.5cm 2.5cm; /* atas kanan bawah kiri */
}
```
Header/footer memakai margin terpisah 1cm dari tepi (lihat [PAGE_LAYOUT.md](./PAGE_LAYOUT.md)
§3), bukan bagian dari margin body di atas.

## 3. Penamaan File
```
{KODE_JENIS}-{nomor_urut}-{tahun}.pdf
```

## 4. Checklist Sebelum Dianggap Selesai
Sebelum dokumen final di-generate, verifikasi:
- ✓ Header muncul benar (38mm, fit width, tidak crop)
- ✓ Footer muncul benar (32mm, fit width, transparan)
- ✓ Margin header = 1cm, margin footer = 1cm
- ✓ Font body = Aptos 12pt
- ✓ Line height = 1.6
- ✓ Paragraph spacing = 12pt
- ✓ Alignment body = justify
- ✓ Tidak ada bold berlebihan
- ✓ Tidak ada gambar yang overlap
- ✓ Siap cetak (print-ready)

## 5. Standar Visual Akhir
Setiap dokumen yang dihasilkan harus terlihat setara surat resmi
perusahaan kelas Fortune 500: minimalis, bersih, profesional, konsisten,
modern, mudah dibaca, enterprise-grade — bukan terlihat seperti template
buatan sendiri.
