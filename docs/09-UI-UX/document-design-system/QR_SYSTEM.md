# QR_SYSTEM.md — RIFIM Group DDS v2.0

## 1. Tujuan
QR code memberi akses cepat ke sumber dokumen digital (Google Doc/PDF)
langsung dari lembar fisik/cetak — siapa pun yang menerima dokumen bisa
scan untuk membuka versi digitalnya, sekaligus sinyal bahwa dokumen ini
diterbitkan resmi lewat RIFIM OS.

## 2. Implementasi Saat Ini (dikonfirmasi dari data live sistem)
Berdasarkan data di sheet `documents`, QR yang sudah pernah diterbitkan
memakai layanan generator eksternal:
```
https://api.qrserver.com/v1/create-qr-code/?size=120x120&margin=4&data={url_encoded_target}
```
- `{url_encoded_target}` = URL Google Doc dokumen tersebut (kolom
  `gdoc_url`), di-encode sebagai parameter `data`.
- Ukuran: 120x120px, margin 4.
- Ini BUKAN halaman verifikasi khusus (`/verify/...`) — QR mengarah
  LANGSUNG ke dokumen Google Docs aslinya.

## 3. Catatan Gap yang Ditemukan
Untuk dokumen dengan `pipeline_type = html` (dibuat lewat html-engine,
tanpa Google Doc), kolom `qr_url` di database HANYA berisi teks placeholder
seperti `qr:011/RIFIM/SURAT/VII/2026` — bukan URL QR image sungguhan. Ini
berarti pipeline html-engine BELUM men-generate QR code fungsional,
berbeda dari pipeline gdocs yang sudah benar. **Ini perlu diperbaiki** —
lihat rekomendasi di §5.

## 4. Penempatan
- Posisi: pojok kanan bawah, di baris kecil tepat di atas footer banner
  (lihat [FOOTER_SYSTEM.md](./FOOTER_SYSTEM.md) §4), sejajar dengan nomor halaman.
- Ukuran render di dokumen: 1.5cm x 1.5cm (skala turun dari 120x120px
  sumber, tetap proporsional).
- Hanya muncul di halaman TERAKHIR dokumen (bukan setiap halaman) —
  kecuali dokumen 1 halaman, otomatis muncul di situ.

## 5. Rekomendasi Perbaikan untuk html-engine
Supaya konsisten dengan pipeline gdocs yang sudah benar, html-engine
harus:
1. Setelah PDF/dokumen final tersimpan ke Drive, ambil URL akses dokumen
   (PDF Drive link atau Google Doc link, sesuai yang tersedia).
2. Panggil layanan QR generator yang sama (`api.qrserver.com`, atau
   alternatif self-hosted jika ingin lepas dari dependensi pihak ketiga)
   dengan URL tersebut sebagai data.
3. Simpan hasilnya sebagai `qr_url` sungguhan di sheet `documents`,
   bukan placeholder teks.

## 6. Kapan QR Ditampilkan
- WAJIB untuk semua dokumen berstatus "Final" ke atas (Final, Terkirim,
  Diarsip).
- TIDAK ditampilkan untuk dokumen berstatus "Draft" (isi masih bisa
  berubah, QR ke versi belum final berisiko menyesatkan).

## 7. Fallback
Jika generate QR gagal (layanan eksternal down, dsb), dokumen tetap harus
bisa di-generate TANPA QR — jangan sampai kegagalan QR memblokir seluruh
proses generate dokumen. Log error terpisah untuk kasus ini (lihat juga
[AUTOMATION_RULES.md](./AUTOMATION_RULES.md) §4.2 — QR bukan bagian dari consistency checklist
wajib, karena sifatnya non-blocking).
