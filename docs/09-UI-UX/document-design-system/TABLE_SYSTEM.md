# TABLE_SYSTEM.md — RIFIM Group DDS v2.0

## 1. Style Umum (Clean Enterprise Table)
- Header: **bold, teks putih, background dark gray** (BUKAN warna brand
  merah — tabel harus netral/enterprise, warna brand hanya untuk
  letterhead/footer bawaan).
- Border: **1px solid `#DADCE0`**
- Padding sel: **6px**
- Vertical align: **middle**
- **Tidak boleh pakai warna berlebihan** — hindari zebra-striping warna
  mencolok, cukup border tipis abu-abu untuk memisahkan baris.

## 2. Lebar Kolom
- Lebar kolom label: **140px**, maksimum **180px**.
- Kolom lain menyesuaikan sisa ruang secara proporsional.

## 3. Tabel Invoice (INV)
| No | Deskripsi | Qty | Satuan | Harga Satuan | Subtotal |
|---|---|---|---|---|---|
- No, Qty: rata tengah. Deskripsi, Satuan: rata kiri.
- Harga Satuan, Subtotal: rata kanan, format Rupiah (`Rp 1.000.000`).
- Baris Total: bold.

## 4. Tabel Kwitansi (KWT)
Blok ringkas (bukan tabel multi-baris):
```
Sudah terima dari : {nama_pembayar}
Uang sejumlah     : {terbilang}
Untuk pembayaran  : {keterangan}
                                          Rp {nominal}
```

## 5. Tabel Checklist Operasional (FCO)
| No | Item Pemeriksaan | Status (✓/✗) | Catatan |
|---|---|---|---|

## 6. Aturan Page Break
Header tabel wajib berulang di halaman baru jika tabel terpotong; satu
baris tidak boleh terpotong di tengah.
