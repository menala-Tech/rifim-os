# BUSINESS RULE BOOK
## Aturan Bisnis & Kebijakan Operasional RIFIM OS
*Dokumen ini berisi aturan bisnis yang mengatur seluruh proses, akses, data, dan operasional di dalam ekosistem RIFIM OS.*

---

## 1. TUJUAN
Menetapkan aturan bisnis yang menjadi standar baku dalam penggunaan sistem RIFIM OS untuk memastikan:
*   Konsistensi Proses
*   Keamanan Data
*   Kepatuhan Kebijakan
*   Kualitas Layanan
*   Akuntabilitas & Transparansi

---

## 2. PRINSIP ATURAN BISNIS
*   **Single Source of Truth:** Setiap data hanya memiliki satu sumber kebenaran.
*   **Role Based Access Control (RCP):** Setiap akses mengikuti Role, Cabang, Permission, dan Data Scope.
*   **Need to Know:** Pengguna hanya dapat melihat data yang benar-benar diperlukan.
*   **Audit Trail:** Setiap aktivitas penting harus tercatat untuk keperluan audit.
*   **Compliance First:** Semua aturan mengikuti kebijakan perusahaan & hukum yang berlaku.

---

## 3. KLASIFIKASI ATURAN
*   **Aturan Akses:** Mengatur siapa yang dapat mengakses fitur dan data.
*   **Aturan Proses:** Mengatur alur kerja dan kondisi proses operasional.
*   **Aturan Data:** Mengatur validasi, integritas, dan pengelolaan data.
*   **Aturan Notifikasi:** Mengatur pengiriman notifikasi dan eskalasi.
*   **Aturan Keamanan:** Mengatur keamanan akun, perangkat, dan sistem.

---

## 4. CONTOH ATURAN BISNIS

| No | Kategori | Aturan Bisnis | Kondisi / Trigger | Aksi / Hasil | Modul Terkait |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | Akses | Koordinator hanya dapat melihat data di cabangnya | User login sebagai Koordinator | Data di luar cabang disembunyikan | HRIS, RAOS, Finance |
| **2** | Akses | Staff tidak dapat menghapus data Absensi | User login sebagai Staff mencoba hapus data | Sistem menolak & tampil pesan | HRIS |
| **3** | Proses | Driver keluar dari geofence bandara | Lokasi driver di luar radius geofence | Otomatis keluar dari antrian | RAOS |
| **4** | Proses | Isi Saldo melebihi batas harian | Nominal > batas harian yang ditentukan | Sistem menolak & notifikasi ke Koordinator | Finance |
| **5** | Data | Nomor HP wajib unik | Input nomor HP yang sudah terdaftar | Sistem menolak & tampil pesan | Semua Modul |
| **6** | Data | Saldo tidak boleh negatif | Saldo setelah transaksi menjadi < 0 | Transaksi ditolak | Finance |
| **7** | Notifikasi | Order selesai > 15 menit tanpa update | Tidak ada update status > 15 menit | Notifikasi ke Driver & Koordinator | RAOS |
| **8** | Keamanan | Login gagal > 5 kali | Password salah 5 kali berturut | Akun dikunci 15 menit & notifikasi ke Admin | Semua Modul |
| **9** | Keamanan | Akses dari perangkat baru | Login dari device yang belum dikenal | Verifikasi OTP / email | Semua Modul |
| **10** | Proses | Approval Invoice wajib berjenjang | Invoice dibuat | Urutan: Staff &rarr; Koordinator &rarr; Finance | Finance |

---

## 5. ATURAN BERDASARKAN ROLE

| Role | Deskripsi | Cakupan Cabang | Akses Data | Aksi yang Diizinkan | Pembatasan |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Direktur** | Pimpinan tertinggi | Semua Cabang | Semua Data | Semua Aksi | Tidak ada |
| **Admin Pusat** | Kelola sistem & master data | Semua Cabang | Semua Data | Kelola User, Setting, Master Data | Tidak dapat approve keuangan |
| **Koordinator** | Pimpinan cabang | Cabang Sendiri | Data Cabang Sendiri | Kelola Staff, Driver, Operasional Cabang | Tidak dapat akses data cabang lain |
| **Staff** | Operasional harian | Cabang Sendiri | Data Terkait Pekerjaan | Input, Update, View | Tidak dapat delete data penting |
| **Driver** | Mitra driver | Cabang Sendiri | Data Pribadi | Lihat Order, Saldo, Riwayat | Tidak dapat akses data orang lain |
| **Finance** | Keuangan perusahaan | Semua Cabang | Data Keuangan | Kelola Keuangan, Approval | Tidak dapat ubah data operasional |
| **IT Support** | Dukungan teknis | Semua Cabang | Log & Sistem | Monitoring, Support | Tidak dapat akses data bisnis |

---

## 6. ATURAN DATA (VALIDASI & INTEGRITAS)

| Aturan Data | Penjelasan |
| :--- | :--- |
| **Data Wajib** | Field bertanda (*) wajib diisi. |
| **Format Data** | Mengikuti format yang ditentukan sistem (contoh: tanggal, email, nomor HP). |
| **Data Unik** | Tidak boleh ada data ganda pada field tertentu. |
| **Relasi Data** | Data tidak boleh dihapus jika masih digunakan di modul lain. |
| **Data Historis** | Perubahan data penting harus memiliki riwayat (log perubahan). |
| **Retensi Data** | Data disimpan sesuai kebijakan retensi yang ditetapkan perusahaan. |

---

## 7. ATURAN PROSES (ALUR KERJA)
**Alur Dasar:** Mulai &rarr; Input / Buat &rarr; Verifikasi &rarr; Approval &rarr; Selesai
*   Setiap proses memiliki alur yang sudah ditentukan.
*   Tidak boleh ada loncatan tahapan.
*   Jika ditolak, proses kembali ke tahap sebelumnya.
*   Semua approval harus sesuai hierarki role.

---

## 8. ATURAN NOTIFIKASI & ESKALASI

| Kondisi | Notifikasi ke | Waktu | Eskalasi |
| :--- | :--- | :--- | :--- |
| **Order tidak diambil** | Driver, Koordinator | Real-time | Setelah 5 menit ke Admin |
| **Absensi belum isi** | Staff, Koordinator | Setiap 1 jam | Setelah 3 jam ke Admin |
| **Saldo hampir habis** | Driver | Real-time | Tidak ada |
| **Invoice menunggu approval** | Approver berikutnya | Setiap 2 jam | Setelah 24 jam ke Finance |

---

## 9. ATURAN KEAMANAN
*   Password minimal 8 karakter, kombinasi huruf, angka, simbol.
*   Jangan pernah bagikan akun kepada orang lain.
*   Logout otomatis setelah 30 menit tidak aktif.
*   Akses melalui perangkat tidak dikenal perlu verifikasi OTP.
*   Aktivitas mencurigakan akan dicatat dan dianalisis.

---

## 10. PERUBAHAN ATURAN
*   Perubahan aturan hanya dapat dilakukan oleh Direktur / Admin Pusat.
*   Setiap perubahan harus didokumentasikan di CHANGELOG.
*   Perubahan aturan harus dikomunikasikan ke seluruh pihak terkait.
*   Aturan berlaku efektif setelah tanggal yang ditentukan.

---

## 11. DAFTAR REFERENSI
*   SOP Operasional
*   Kebijakan Perusahaan
*   Peraturan Perundangan
*   Kontrak & Perjanjian
*   Standar Keamanan
*   Best Practice Industri

---

## 12. CATATAN PENTING
> Semua pihak wajib memahami, mematuhi, dan menjalankan aturan bisnis ini untuk menjaga integritas sistem, data, dan operasional RIFIM OS.
