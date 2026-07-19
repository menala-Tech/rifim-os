# LETTER_STRUCTURE.md — RIFIM Group DDS v2.0

## 1. Format Penomoran Dokumen
Tidak berubah dari sebelumnya (mengikuti sistem live RIFIM OS):
```
{nomor_urut}/RIFIM/{KODE_JENIS}/{bulan_romawi}/{tahun}
```
Untuk Menala dan Lailan, ganti `RIFIM` dengan kode entitas yang
bersangkutan (mis. `MENALA`, `LAILAN`) — konvensi lain tetap sama.

## 2. Struktur Resmi Surat (URUTAN WAJIB, TIDAK BOLEH DIUBAH)
1. Header/letterhead (lihat [HEADER_SYSTEM.md](./HEADER_SYSTEM.md))
2. Nomor
3. Lampiran
4. Perihal
5. (baris kosong)
6. Kepada Yth.
7. Nama Perusahaan/Penerima
8. Alamat / Di Tempat
9. (baris kosong)
10. "Dengan hormat,"
11. Isi (body)
12. Paragraf penutup
13. "Hormat kami,"
14. Nama Perusahaan
15. Tanda tangan (lihat [SIGNATURE_SYSTEM.md](./SIGNATURE_SYSTEM.md))
16. Nama
17. Jabatan
18. Footer (lihat [FOOTER_SYSTEM.md](./FOOTER_SYSTEM.md))

## 3. Catatan Penting Soal Tanggal
Spec resmi secara eksplisit melarang tanggal ditempatkan di sisi kanan,
dan struktur baku di atas TIDAK menyertakan baris tanggal tersendiri.
**Asumsi kerja** (perlu dikonfirmasi ke pemilik spec): tanggal ditulis
rata kiri, sebagai bagian dari blok Nomor/Lampiran/Perihal (mis. baris
tambahan "Batam, 19 Juli 2026" di atas atau di bawah blok Nomor), bukan
disandingkan dengan tanda tangan seperti format surat Indonesia
konvensional. **Konfirmasi posisi tanggal yang benar ke penulis spec
sebelum diimplementasikan di engine**, supaya tidak salah tebak.

## 4. Aturan Tegas Lainnya
- Nama penerima surat (poin 7): **tidak boleh bold**.
- Nilai field Perihal (poin 4): **tidak boleh bold** (label "Perihal:"
  boleh bold, isinya tidak).
- Body surat selalu **justify**, tidak pernah center.
- Tidak ada baris kosong berlebih di antara paragraf — spacing diatur
  lewat paragraph spacing (12pt), bukan Enter kosong manual.

## 5. Bahasa
Bahasa Indonesia formal/baku untuk semua dokumen resmi, konsisten di
ketiga entitas (RIFIM, Menala, Lailan).
