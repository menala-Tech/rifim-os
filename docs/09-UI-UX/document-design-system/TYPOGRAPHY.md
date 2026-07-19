# TYPOGRAPHY.md — RIFIM Group DDS v2.0

## 1. Font Body
- Utama: **Aptos**
- Fallback: **Calibri**
- **Jangan pernah pakai Times New Roman.**

## 2. Skala & Style per Elemen
| Elemen | Ukuran | Weight | Warna | Alignment | Catatan |
|---|---|---|---|---|---|
| Judul dokumen (Title) | 14pt | Bold | `#000000` | Center, **UPPERCASE** | Spacing after 18pt |
| Section heading | 12pt | Bold | `#000000` | Kiri | Spacing before 18pt, after 8pt |
| Body text | 12pt | Regular | `#000000` | **Justify** | No bold kecuali perlu |
| Header tabel | 12pt (mengikuti body) | Bold | Putih di atas background dark gray | Tengah/kiri sesuai kolom | — |
| Isi tabel | 12pt (mengikuti body) | Regular | `#000000` | Sesuai jenis data | — |

## 3. Line Height & Spacing
- Line height body: **1.6**
- Paragraph spacing after: **12pt**
- First-line indent: **tidak ada** — pemisah antar paragraf pakai spacing,
  bukan indentasi maupun baris kosong tambahan (**no empty blank lines**).

## 4. List Style
- Bullet: bulat (round), indent **0.75 cm**
- Numbered list: angka Arab (1, 2, 3, ...)
- Spacing antar item: 6pt

## 5. DO NOT (aturan larangan mutlak)
- Jangan pernah menempatkan tanggal di sisi kanan.
- Jangan bold nama penerima surat.
- Jangan bold nilai (value) field Perihal.
- Jangan pakai double spacing.
- Jangan pakai Times New Roman.
- Jangan center-kan paragraf body (body selalu justify).
- Jangan pakai warna pada body text (selalu hitam `#000000`).
- Jangan tambah border dekoratif.
- Jangan tambah background halaman.
- Jangan pakai ikon acak/dekoratif.

## 6. Migrasi dari Template Lama (Global Fixes)
Jika mengaudit/memperbaiki dokumen lama yang belum sesuai spec ini:
- 11pt → 12pt
- Line-height 1.2 → 1.6
- Paragraph margin-bottom → 12pt
- Padding tabel dinormalisasi → 3px (kecuali padding sel tabel spesifik,
  lihat [TABLE_SYSTEM.md](./TABLE_SYSTEM.md) → 6px)
- Lebar kolom label → 140px (maksimum 180px)
- Hapus bold yang tidak perlu
- Hapus background merah/warna berlebihan yang tidak sesuai spec ini
