# SIGNATURE_SYSTEM.md — RIFIM Group DDS v2.0

## 1. Aset
- `Signature.png` — tanda tangan digital (PNG transparan)
- `Stamp.png` — cap perusahaan (PNG transparan)
(Aset sama untuk struktur; jika Menala/Lailan punya tanda tangan/cap
berbeda, siapkan versi masing-masing dengan nama file setara.)

## 2. Posisi Blok Tanda Tangan
- **Posisi: Bottom Left** (BUKAN rata kanan seperti draf sebelumnya)
- Lebar blok: **70mm**
- Tinggi blok: **55mm**
- Jarak dari body (paragraf penutup di atasnya): **24pt**

## 3. Elemen Tanda Tangan (Signature.png)
- Lebar: **45mm**
- Offset X: 0mm, Offset Y: 0mm (posisi default dalam blok)
- Layer: **Front** (di depan)

## 4. Elemen Cap (Stamp.png)
- Lebar: **30mm**
- Offset X: **18mm**, Offset Y: **6mm** (bergeser dari titik acuan
  signature, menciptakan efek cap menumpuk sebagian tanda tangan)
- Layer: **Behind Signature** (di belakang tanda tangan, bukan di depan)

## 5. Nama & Jabatan Penandatangan
| Elemen | Jarak | Style |
|---|---|---|
| Nama Direktur/Penandatangan | 6mm dari signature | **Bold, underline** |
| Jabatan | 2mm dari nama | Regular |

## 6. Urutan Vertikal dalam Blok (dari atas ke bawah)
1. Nama Perusahaan (bold)
2. Ruang komposit Signature.png (front) + Stamp.png (behind, offset 18mm/6mm)
3. Nama Direktur (bold, underline, jarak 6mm dari signature)
4. Jabatan (regular, jarak 2mm dari nama)

## 7. Daftar Jabatan Penandatangan yang Valid (RIFIM)
Direktur Utama, Manager Administrasi, Manager Operasional,
Manager Keuangan, Koordinator.

## 8. Dokumen Multi-Penandatangan (MoU, PKS)
Untuk dokumen 2 pihak, duplikasi blok ini menjadi 2 kolom sejajar
(kiri: RIFIM/Menala/Lailan, kanan: pihak mitra), masing-masing tetap
mengikuti dimensi 70mm x 55mm di atas.
