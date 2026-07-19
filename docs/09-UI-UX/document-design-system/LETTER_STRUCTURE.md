# LETTER_STRUCTURE.md — RIFIM Group DDS v2.1

## 1. Format Penomoran Dokumen
```
{nomor_urut}/{PREFIX_ENTITAS}/{KODE_JENIS}/{bulan_romawi}/{tahun}
```
Contoh: `001/RIFIM/SURAT/VII/2026`

Prefix entitas (dikonfirmasi dari sheet `companies`, field `doc_prefix`):
| Entitas | Prefix |
|---|---|
| PT. RIFIM Internasional Gemilang | `RIFIM` |
| PT. Menala Internasional Gemilang | `MIG` |
| CV. Lailan Kalilan Indonesia | `LAILAN` |

- `nomor_urut` — 3 digit, reset ke 001 setiap awal tahun, per kombinasi
  entitas + jenis dokumen (dikonfirmasi dari sheet `numbering_sequences`:
  counter disimpan per `document_code` + `year` + `month`).
- `KODE_JENIS` — salah satu dari: SURAT, ST, SIZ, SKT, BA, INV, KWT, PROP,
  CP, MOU, PKS, SP1, SP2, SP3, PKWT, SPG, SMT, PHK, PI, FCO (lihat
  [DDS_v1.0.md](./DDS_v1.0.md) §5 untuk katalog lengkap).
- `bulan_romawi` — bulan pembuatan dalam angka Romawi (I–XII).
- `tahun` — tahun 4 digit.
- Nomor di-generate OTOMATIS oleh sistem saat dokumen di-generate, tidak
  boleh diinput manual oleh user (mencegah duplikasi/race condition).

## 2. Posisi Tanggal (dikonfirmasi — tidak lagi asumsi)
Tanggal ditulis **rata kiri, sejajar/menyatu dengan blok Nomor Surat**
(BUKAN rata kanan seperti surat konvensional Indonesia pada umumnya —
sengaja beda, sesuai [TYPOGRAPHY.md](./TYPOGRAPHY.md) §5 yang melarang tanggal di kanan).
Contoh penempatan:
```
Batam, 19 Juli 2026

Nomor   : 001/RIFIM/SURAT/VII/2026
Lampiran: 1 berkas
Perihal : Penawaran Kerjasama
```

## 3. Struktur Resmi Surat (URUTAN WAJIB)
1. Header/letterhead (lihat HEADER_SYSTEM.md)
2. Tanggal & kota (lihat §2 di atas)
3. Nomor
4. Lampiran
5. Perihal
6. (baris kosong)
7. Kepada Yth.
8. Nama Perusahaan/Penerima
9. Alamat / Di Tempat
10. (baris kosong)
11. "Dengan hormat,"
12. Isi (body)
13. Paragraf penutup
14. "Hormat kami,"
15. Nama Perusahaan
16. Tanda tangan (lihat SIGNATURE_SYSTEM.md)
17. Nama
18. Jabatan
19. Footer (lihat FOOTER_SYSTEM.md)

## 4. Aturan Tegas Lainnya
- Nama penerima surat (poin 8): **tidak boleh bold**.
- Nilai field Perihal (poin 5): **tidak boleh bold** (label "Perihal:"
  boleh bold, isinya tidak).
- Body surat selalu **justify**, tidak pernah center.
- Tidak ada baris kosong berlebih di antara paragraf — spacing diatur
  lewat paragraph spacing (12pt), bukan Enter kosong manual.

## 5. Bahasa
Bahasa Indonesia formal/baku untuk semua dokumen resmi, konsisten di
ketiga entitas (RIFIM, Menala/MIG, Lailan).
