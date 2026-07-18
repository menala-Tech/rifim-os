# PROMPT AI – RIFIM CHAT MANAGEMENT
**Buat tampilan modul Chat Management aplikasi RIFIM Chat untuk aplikasi komunikasi operasional Maxim Airport dengan identitas RIFIM.**

---

## 1. TAMPILAN UTAMA (UI MOBILE)
Layar tengah menampilkan menu "Chat Management" untuk mengelola chat, media, arsip & pengaturan room.

*   **Identitas Room:** RIFIM Operasional Batam (128 Peserta • Aktif)
*   **Ringkasan Room (Update 08:30):**
    *   **Chat:** 12.540 (Total Pesan)
    *   **Media:** 3.245 (Total File)
    *   **Dokumen:** 563 (Total File)
    *   **Peserta:** 128 (Total Anggota)
*   **Aksi Cepat (Grid Menu):** Hapus Chat, Media Manager, Clean Room, Archive Room, Auto Delete, Lock Room, Hapus Peserta, Export Data.
*   **Penyimpanan Room (42%):** 21.45 GB / 50 GB digunakan.
    *   Foto: 6.12 GB | Video: 9.35 GB | Dokumen: 2.41 GB | Lainnya: 2.45 GB
*   **Bottom Navigation:** Beranda, Chat, AI Insight, Notifikasi (badge 8), Akun.

---

## 2. MODUL PENGELOLAAN (KIRI & ATAS)

### 1. HAPUS CHAT
*   **User:** Hapus chat sendiri, Hapus untuk saya, Tarik pesan (unsend) (5 menit).
*   **Admin Room:** Hapus chat peserta, Hapus beberapa chat, Hapus seluruh chat dari peserta.
*   **Super Admin:** Hapus seluruh histori room, Restore chat jika diperlukan.

### 2. MEDIA MANAGER
Kelola semua media dalam room (Foto, Video, Dokumen, Voice, Lokasi, Link, QR, PDF, Lainnya).
*   **Admin dapat:** Cari media, Hapus media tertentu, Hapus semua media dari peserta, Hapus media berdasarkan tanggal.

### 3. CLEAN ROOM
Hapus chat berdasarkan rentang waktu:
*   Pilihan: 7 Hari, 30 Hari, 90 Hari, 1 Tahun.
*   *Toggle:* Hapus otomatis setiap 30 hari.

### 4. ARCHIVE ROOM
Arsip room lama menjadi **READ ONLY**.
*   Room dipindahkan ke Arsip.
*   Tidak dapat mengirim pesan.
*   Hanya dapat melihat histori.
*   Tetap dapat mencari & export.

### 5. AUTO DELETE
Hapus otomatis media sesuai aturan:
*   **Foto:** 30 Hari
*   **Voice Note:** 7 Hari
*   **Dokumen:** 1 Tahun
*   **Video:** 90 Hari
*   **File Lainnya:** 180 Hari
*(Atur aturan auto delete per room)*

### 6. HAPUS PESERTA
Admin dapat mengeluarkan peserta:
*   Peserta dikeluarkan dari room.
*   Semua chat tetap ada.
*   Peserta tidak dapat masuk lagi.
*   *(Tombol: Keluarkan Peserta)*

### 7. LOCK ROOM
Ubah room menjadi mode **READ ONLY**.
*   Hanya admin yang bisa mengirim.
*   Peserta hanya bisa membaca.
*   Cocok untuk pengumuman, briefing, informasi resmi.
*   *(Toggle: Aktifkan Lock Room)*

### 8. CLEAR ANNOUNCEMENT
Hapus seluruh pengumuman lama.
*   Membersihkan chat pengumuman.
*   Data tetap disimpan di arsip.
*   *(Tombol: Hapus Pengumuman)*

### 9. SMART SEARCH
Cari cepat sesuai kebutuhan menggunakan *chips/tags*:
`Foto`, `PDF`, `Driver`, `Isi Saldo`, `Approval`, `SP1`, `Invoice`, `DLL`.
*   Semua hasil langsung muncul dari chat, media & dokumen.

---

## 3. KEAMANAN & MONITORING (KANAN)

### 10. AI MEDIA DETECTION
AI mendeteksi konten berisiko secara otomatis:
*   Foto tidak pantas
*   Link phishing
*   Virus / Malware
*   File mencurigakan
*   Spam
*(Peringatan dikirim ke admin)*

### 11. AUDIT LOG
Semua aktivitas admin tercatat. *(Log tidak dapat dihapus)*.
*   `08:20` | Admin Batam &rarr; Menghapus 12 chat
*   `08:25` | Koordinator Jambi &rarr; Menghapus Driver A
*   `08:30` | Admin Pekanbaru &rarr; Hapus 5 media
*   `08:35` | Super Admin &rarr; Archive Room PKU

---

## 4. BACKUP & EXPORT

### 12. BACKUP CHAT
Backup & export chat room. Format: `Export PDF`, `Export Excel`, `Export ZIP`, `Export Markdown`.

### 13. EXPORT MEDIA
Export media berdasarkan filter (Contoh: `Foto` &rarr; `Januari 2024` &rarr; `Export ZIP`).

---

## 5. PENYIMPANAN & KEBIJAKAN (BAWAH)

### 14. STORAGE MANAGER
Kelola penggunaan penyimpanan (Total 21.45 GB / 50 GB):
*   **Foto:** 6.12 GB (28%)
*   **Video:** 9.35 GB (43%)
*   **Dokumen:** 2.41 GB (11%)
*   **Voice:** 1.12 GB (5%)
*   **Lainnya:** 2.45 GB (13%)
*(Tombol: Detail Penggunaan)*

### 15. GOOGLE DRIVE SYNC
Integrasi media dengan Google Drive.
*   Hapus media dari Drive
*   Restore media
*   Arsip media
*   Pindah folder otomatis

### 16. RETENTION POLICY
Kebijakan penyimpanan data yang dapat disesuaikan per room:

| Jenis Data | Masa Simpan |
| :--- | :--- |
| Chat Operasional | 1 Tahun |
| Pengumuman | Permanen |
| Dokumen | Permanen |
| Foto Absensi | 2 Tahun |
| Voice Note | 90 Hari |
| Foto Chat | 180 Hari |
| Video | 90 Hari |
| AI Log | Permanen |
| Audit Log | Permanen |

---

## 6. AKSES & CATATAN

### 17. HAK AKSES ADMIN
Role & izin dalam Chat Management:
*   **Super Admin:** Akses Semua Fitur
*   **Admin Airport:** Kelola room & peserta
*   **Koordinator:** Kelola peserta & media
*   **Staff:** Akses terbatas
*   **Driver:** Hanya membaca & kirim
*(Semua aksi tercatat di Audit Log)*

### 18. CATATAN & REMINDER
*   Pastikan kebijakan retensi sesuai aturan perusahaan.
*   Backup rutin otomatis.
*   Gunakan penyimpanan Drive sebagai storage utama.
*   Audit log wajib diperiksa secara berkala.
*(Keamanan data adalah Menggerakkan RIFIM)*

---

## 7. SPESIFIKASI & DESAIN

*   **SPESIFIKASI TEKNIS UI:**
    *   Resolusi: 1170 x 2532 px (iPhone 12/13/14)
    *   Mode Warna: Dark Mode
    *   Warna Utama: Kuning (`#FFC700`)
    *   Warna Netral: Abu gelap & Hitam
    *   Font Family: Poppins / Inter
    *   Ikon: Line / Filled (2px)
*   **PRINSIP DESAIN:** Mudah digunakan, Informasi jelas, Aksi cepat, Keamanan tinggi, Konsisten & profesional.
*   **IDENTITAS VISUAL:** Logo RIFIM maxim (Kuning `#FFC700`, Hitam `#111111`, `#1E1E1E`, Putih `#FFFFFF`, Abu `#F5F5F5`, Merah `#E53935`).
