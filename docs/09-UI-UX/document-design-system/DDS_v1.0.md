# RIFIM Document Design System (DDS) v1.0

## 1. Tujuan
Dokumen ini adalah spesifikasi induk yang mengatur bagaimana SEMUA dokumen resmi
PT. RIFIM Internasional Gemilang (RIFIM Group) dirancang, diformat, dan
dihasilkan — baik lewat RIFIM OS (Smart Office), Google Docs, maupun ekspor
PDF/Word manual. Tujuannya satu: setiap dokumen yang keluar dari perusahaan,
dari cabang mana pun (Batam, Pekanbaru, Jambi, Balikpapan, Manado, dst),
punya identitas visual dan struktur yang identik.

## 2. Prinsip Dasar
1. **Satu sumber kebenaran** — semua aturan visual (warna, font, margin, tata
   letak) didefinisikan di DDS ini. Tidak ada implementasi (kode/template)
   yang boleh punya nilai styling sendiri yang berbeda dari DDS.
2. **Konsisten lintas jenis dokumen** — Surat Resmi, Invoice, MoU, SP,
   Kontrak PKWT, dsb, semua mengikuti kerangka visual yang sama
   (header, footer, tipografi, tanda tangan), hanya konten & tabel yang
   menyesuaikan jenis dokumen.
3. **Konsisten lintas output** — hasil render harus terlihat sama baik
   sebagai PDF, Google Docs, maupun Word (lihat [PDF_EXPORT.md](./PDF_EXPORT.md),
   [GOOGLE_DOCS.md](./GOOGLE_DOCS.md), [MICROSOFT_WORD.md](./MICROSOFT_WORD.md) untuk penyesuaian teknis per-platform).
4. **Machine-readable** — dokumen DDS ini ditulis supaya bisa langsung
   dipakai sebagai acuan oleh AI/engine (Claude Code, html-engine, GAS)
   saat generate atau mengaudit dokumen.

## 3. Cakupan Multi-Entitas
DDS ini berlaku untuk **3 perusahaan** dengan sistem desain yang SAMA
(layout, tipografi, margin, struktur), hanya aset visual (letterhead,
footer, tanda tangan) yang berbeda per entitas:

| Entitas | Header | Footer |
|---|---|---|
| PT. RIFIM Internasional Gemilang | Letterhead Rifim.png | Footer Banner Rifim.png |
| Menala | Letterhead Menala.png | Footer Menala.png |
| Lailan | Letterhead Lailan.png | Footer Banner lailan.png |

## 4. Identitas Perusahaan (RIFIM)
| Field | Nilai |
|---|---|
| Nama resmi | PT. RIFIM Internasional Gemilang |
| Nama singkat / brand | RIFIM Group |
| Alamat | Fanindo Blok S No. 20, Tanjung Uncang, Batu Aji, Kota Batam |
| Telepon | +62 821 7010 2349 |
| Email | rifiminternasionalgemilang@gmail.com |
| Direktur Utama | Bobby Rahman M.B |
| Warna brand (aset visual only) | `#C40000` (merah RIFIM) — dipakai di letterhead/footer PNG, TIDAK dipakai di body/tabel |
| Warna teks & tabel | Hitam `#000000`, putih, dark gray, border `#DADCE0` |

_Identitas Menala dan Lailan belum didokumentasikan di sini — tambahkan
begitu datanya tersedia._

## 4. Modul DDS
| File | Mengatur |
|---|---|
| [PAGE_LAYOUT.md](./PAGE_LAYOUT.md) | Ukuran halaman, margin, grid |
| [HEADER_SYSTEM.md](./HEADER_SYSTEM.md) | Letterhead / kop surat |
| [FOOTER_SYSTEM.md](./FOOTER_SYSTEM.md) | Footer banner, nomor halaman |
| [TYPOGRAPHY.md](./TYPOGRAPHY.md) | Font, ukuran, hierarki teks |
| [LETTER_STRUCTURE.md](./LETTER_STRUCTURE.md) | Struktur isi surat & penomoran |
| [TABLE_SYSTEM.md](./TABLE_SYSTEM.md) | Aturan tabel (invoice, kwitansi, checklist, dll) |
| [SIGNATURE_SYSTEM.md](./SIGNATURE_SYSTEM.md) | Tanda tangan & cap |
| [QR_SYSTEM.md](./QR_SYSTEM.md) | QR verifikasi dokumen *(belum ada — akan menyusul)* |
| [PDF_EXPORT.md](./PDF_EXPORT.md) | Spec teknis output PDF |
| [GOOGLE_DOCS.md](./GOOGLE_DOCS.md) | Spec teknis output Google Docs |
| [MICROSOFT_WORD.md](./MICROSOFT_WORD.md) | Spec teknis output Word *(belum ada — akan menyusul)* |
| [../../10-AI/AI_RULES.md](../../10-AI/AI_RULES.md) | Batasan AI saat generate konten otomatis *(belum ada — akan menyusul)* |

## 5. Katalog Jenis Dokumen (19 jenis, per kategori)
**Korespondensi:** Surat Resmi (SURAT), Surat Tugas (ST), Surat Izin (SIZ),
Surat Keterangan (SKT), Berita Acara (BA)
**Keuangan:** Invoice (INV), Kwitansi (KWT)
**Kerjasama:** Proposal (PROP), Company Profile (CP), MoU (MOU),
Perjanjian Kerjasama (PKS)
**HR/SDM:** SP 1 (SP1), SP 2 (SP2), SP 3 (SP3), Kontrak PKWT (PKWT),
Pengangkatan (SPG), Mutasi (SMT), Surat PHK (PHK), Pakta Integritas (PI)
**Operasional:** Form Checklist Operasional (FCO)

Semua kode jenis dokumen di atas adalah ID resmi yang dipakai di sistem
penomoran (lihat [LETTER_STRUCTURE.md](./LETTER_STRUCTURE.md)) — jangan diubah tanpa mengubah DDS ini
lebih dulu.

## 6. Aset Resmi
Semua aset visual berada di `/docs/Assets/` (untuk referensi desain) dan
`assets/` di root repo (untuk dipakai langsung oleh engine):
- `Letterhead Rifim.png` — kop surat
- `Footer Banner Rifim.png` — banner footer
- `Signature.png` — tanda tangan digital direktur
- `Stamp.png` — cap perusahaan
- `Logo.png` — logo RIFIM standalone

## 7. Relasi dengan DOCUMENT_ENGINE.md (Blueprint Arsitektur Sistem)
RIFIM OS punya dokumen arsitektur terpisah, [`DOCUMENT_ENGINE.md`](../../04-Architecture/DOCUMENT_ENGINE.md), yang
mendefinisikan visi jangka panjang sistem dokumen sebagai fondasi ERP
(Template Engine, Numbering Engine, Workflow Engine, Approval Engine,
Signature Engine, dst — 14 sub-engine total).

DDS ini BUKAN pengganti blueprint tersebut, melainkan spesifikasi detail
untuk 2 lapisan spesifik di dalamnya:
- **Template Engine** — diisi oleh [HEADER_SYSTEM.md](./HEADER_SYSTEM.md), [FOOTER_SYSTEM.md](./FOOTER_SYSTEM.md),
  [TYPOGRAPHY.md](./TYPOGRAPHY.md), [LETTER_STRUCTURE.md](./LETTER_STRUCTURE.md), [TABLE_SYSTEM.md](./TABLE_SYSTEM.md), [SIGNATURE_SYSTEM.md](./SIGNATURE_SYSTEM.md)
- **PDF Engine** — diisi oleh [PDF_EXPORT.md](./PDF_EXPORT.md), [QR_SYSTEM.md](./QR_SYSTEM.md)
- Export ke format lain (Google Docs, Word) diisi oleh [GOOGLE_DOCS.md](./GOOGLE_DOCS.md) dan
  [MICROSOFT_WORD.md](./MICROSOFT_WORD.md), selaras dengan Export Engine di blueprint.

### 7.1 Keputusan Sengaja: DDS Mengikuti Sistem Live, Bukan Blueprint (untuk saat ini)
Ada 2 perbedaan yang **disengaja** antara DDS ini dan [`DOCUMENT_ENGINE.md`](../../04-Architecture/DOCUMENT_ENGINE.md),
karena DDS mendeskripsikan sistem yang SUDAH LIVE di production
(rifim-os.vercel.app), sementara blueprint mendeskripsikan visi jangka
panjang yang belum diimplementasikan:

| Aspek | DDS ini (live sekarang) | [DOCUMENT_ENGINE.md](../../04-Architecture/DOCUMENT_ENGINE.md) (visi Numbering Engine) |
|---|---|---|
| Format nomor dokumen | `{urut}/RIFIM/{JENIS}/{bulan_romawi}/{tahun}` (lihat [LETTER_STRUCTURE.md](./LETTER_STRUCTURE.md) §1) | `{JENIS}/{CABANG}/{tahun}/{urut 6 digit}` |
| Katalog jenis dokumen | 19 jenis, 5 kategori (Korespondensi, Keuangan, Kerjasama, HR/SDM, Operasional — lihat §5 di bawah) | Katalog lebih luas: HR, Finance, Legal, Operations, Management, General (termasuk jenis baru: SOP, NDA, Purchase Order, Cash Advance, Surat Keputusan, dll) |

**Implikasi:** jika suatu saat migrasi ke format Numbering Engine blueprint
(yang mendukung multi-cabang eksplisit di nomor dokumen — relevan karena
RIFIM beroperasi di Batam, Pekanbaru, Jambi, Balikpapan, Manado, dst),
nomor dokumen yang SUDAH terbit dengan format lama TIDAK BOLEH diubah
retroaktif (lihat prinsip Revision/Audit Engine — histori tidak boleh
dimanipulasi). Migrasi berarti format baru berlaku untuk dokumen baru saja,
dengan penanda versi format di database.

Katalog jenis dokumen yang lebih luas di blueprint (Finance: PO/Cash
Advance/Expense Claim, Legal: NDA, Management: Memo/SK/Pengumuman, dst)
BELUM masuk cakupan DDS ini — akan didokumentasikan di revisi DDS
berikutnya begitu jenis-jenis dokumen tersebut mulai diimplementasikan di
RIFIM OS.

## 8. Riwayat Versi
| Versi | Tanggal | Perubahan |
|---|---|---|
| 1.0 | 2026-07-19 | Rilis awal DDS, menyatukan 12 modul spesifikasi (nilai margin/font/warna masih asumsi) |
| 1.0.1 | 2026-07-19 | Tambah §7: relasi & perbedaan sengaja terhadap [DOCUMENT_ENGINE.md](../../04-Architecture/DOCUMENT_ENGINE.md) blueprint |
| 2.0 | 2026-07-19 | **Perubahan besar**: selaras dengan spec resmi "ROLE Document letterhead dan Footer 3 Perusahaan" (lihat [_source/](./_source/)) — font jadi Aptos, margin/dimensi presisi, tabel dark-gray (bukan merah), posisi tanda tangan bottom-left, cakupan diperluas ke 3 entitas (RIFIM, Menala, Lailan). Lihat [PAGE_LAYOUT.md](./PAGE_LAYOUT.md), [HEADER_SYSTEM.md](./HEADER_SYSTEM.md), [FOOTER_SYSTEM.md](./FOOTER_SYSTEM.md), [TYPOGRAPHY.md](./TYPOGRAPHY.md), [LETTER_STRUCTURE.md](./LETTER_STRUCTURE.md), [TABLE_SYSTEM.md](./TABLE_SYSTEM.md), [SIGNATURE_SYSTEM.md](./SIGNATURE_SYSTEM.md), [PDF_EXPORT.md](./PDF_EXPORT.md), [GOOGLE_DOCS.md](./GOOGLE_DOCS.md) untuk detail. |

## 9. Item yang Perlu Dikonfirmasi
- **Posisi tanggal** — spec resmi melarang tanggal di kanan tapi tidak
  menyebut posisi penggantinya secara eksplisit (lihat LETTER_STRUCTURE.md
  §3). Perlu konfirmasi dari penulis spec asli sebelum diimplementasikan.
- **Identitas Menala & Lailan** — alamat, kontak, direktur, dll belum ada
  datanya di DDS ini.
