# GOOGLE_DOCS.md — RIFIM DDS v1.0

## 1. Konteks
RIFIM OS menyediakan tombol "Buka Google Doc" di samping "Download PDF"
setiap dokumen selesai di-generate. Google Doc ini bukan sumber utama
layout (itu tetap html-engine, lihat [PDF_EXPORT.md](./PDF_EXPORT.md)) — Google Doc adalah
salinan yang bisa diedit manual oleh staff jika perlu revisi kecil sebelum
dikirim ulang sebagai PDF.

## 2. Metode Pembuatan
- Dibuat via Google Docs API/Apps Script `DocumentApp`, mengisi template
  Google Docs yang sudah disiapkan per kategori dokumen (atau 1 template
  universal dengan placeholder, tergantung keputusan arsitektur — lihat
  audit Fase 2).
- Letterhead dan footer banner ditempatkan di **Header/Footer section
  native Google Docs** (bukan gambar yang ditempel di body) — ini WAJIB,
  spec resmi secara eksplisit menyebut "must match Google Docs
  Header/Footer settings".
- Pengaturan native Google Docs harus diset:
  - Header margin: **1cm dari atas**
  - Footer margin: **1cm dari bawah**
  - Margin halaman: atas 1cm, bawah 1.5cm, kiri 2.5cm, kanan 2.5cm
  (lihat [PAGE_LAYOUT.md](./PAGE_LAYOUT.md) §2–3 — nilai ini final, bukan lagi asumsi.)
- Signature composite (Signature.png + Stamp.png) di-insert sebagai
  elemen gambar mengikuti offset presisi di [SIGNATURE_SYSTEM.md](./SIGNATURE_SYSTEM.md), dikonversi
  ke satuan Docs API (1mm ≈ 2.835pt).

## 3. Penyimpanan
- Setiap Google Doc yang dibuat disimpan di Google Drive folder khusus
  RIFIM OS, dengan penamaan file identik dengan konvensi [PDF_EXPORT.md](./PDF_EXPORT.md) §4.
- Link Google Doc dicatat di baris arsip dokumen terkait di database
  Google Sheets (lihat kolom Nomor/Jenis/Perihal/dst di modul Arsip
  Dokumen).

## 4. Batasan
- Google Docs TIDAK dipakai sebagai sumber render PDF (arah render selalu
  html-engine → PDF, bukan Google Doc → PDF), untuk menghindari drift
  antara 2 sumber kebenaran layout.
- Font, warna, dan struktur harus semirip mungkin dengan versi PDF, tapi
  toleransi kecil diperbolehkan (mis. shadow/anti-aliasing rendering Docs
  vs Chromium PDF), karena keduanya bergantung pada engine render berbeda.

## 5. Fitur Editing
- Staff yang membuka Google Doc boleh mengedit teks isi, TAPI TIDAK
  disarankan mengubah header/footer/signature block secara manual — jika
  ada kesalahan di situ, sebaiknya generate ulang dari RIFIM OS, bukan
  ditambal manual di Google Docs (supaya arsip tetap konsisten dengan DDS).
