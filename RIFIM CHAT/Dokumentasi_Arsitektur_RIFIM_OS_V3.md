# RIFIM OS
## ENTERPRISE OPERATING SYSTEM

---

## 1. PENGGUNA & ALUR LOGIN

### PENGGUNA
*   **Direktur**
*   **Koordinator**
*   **Staff**
*   **Driver**

### LOGIN
*   **Metode Autentikasi:** Email / Phone, Password / PIN, Face ID
*   **Alur:** Input Kredensial &rarr; Klik `LOGIN` &rarr; Masuk ke Sistem Terintegrasi

---

## 2. RIFIM CHAT (PUSAT AKTIVITAS)
Tampilan antarmuka komunikasi internal utama di mana pengguna dapat mengelola percakapan dan mengambil tindakan cepat.

*   **Daftar Kontak & Grup (Kiri):**
    *   Direktur (Online)
    *   Koordinator Batam (Sedang mengetik...)
    *   Grup Batam (Bobby: Driver sudah datang)
    *   Grup Pekanbaru (Dina: Siap)
    *   AI Assistant (Online)
*   **Jendela Percakapan (Tengah):**
    *   *Koordinator Batam (`09:15`):* "Driver sudah datang di bandara"
    *   *Balasan (`09:16`):* "Baik, terima kasih informasinya"
    *   Terdapat kolom "Ketik pesan..." dengan fitur lampiran.
*   **Quick Action (Kanan - di dalam Chat):**
    *   Absensi, Isi Saldo, Driver Datang, Buat Laporan, Pengumuman.

---

## 3. NOTIFIKASI & DASHBOARD UTAMA (Panel Kanan Atas)

### NOTIFIKASI
Daftar aktivitas terbaru di sistem:
*   `09:15` - Driver Batam datang
*   `09:10` - Isi saldo berhasil
*   `09:05` - Pengumuman baru
*   `09:00` - Laporan perlu review
*   *Tautan: Lihat semua notifikasi &rarr;*

### DASHBOARD UTAMA (Ringkasan real-time)
*   **7** Cabang
*   **152** Staff
*   **320** Driver Online
*   **48** Antrian
*   *Tautan: Lihat Dashboard &rarr;*

---

## 4. MODUL UTAMA SISTEM & MENU PENDUKUNG

Seluruh modul saling terhubung melalui garis koordinasi dua arah yang berpusat pada infrastruktur data di bawahnya.

### MENU SAMPING (Sidebar Kiri & Kanan)
*   **QUICK ACTION (Kiri):** Pintasan cepat untuk Absensi, Isi Saldo, Driver Datang, Buat Laporan, Pengumuman, dan Lainnya.
*   **OUTPUT & MONITORING (Kanan):** Dashboard Direktur, Dashboard Koordinator, Laporan Otomatis, Notifikasi Real-time, AI Insight.

### MODUL TERINTEGRASI (Tengah)

| Modul & Warna | Menu Fungsional | Ringkasan Data (Mockup) |
| :--- | :--- | :--- |
| **CHAT** (Biru) | 1. Chat Pribadi<br>2. Grup Chat<br>3. Broadcast / Pengumuman<br>4. Share Foto, Dokumen, Lokasi<br>5. Notifikasi Real-time | **Grup Batam:** Pratinjau percakapan dengan fitur lampiran dan share lokasi (Maps). |
| **SMART OFFICE** (Hijau) | 1. Surat Masuk<br>2. Surat Keluar<br>3. Memo<br>4. SOP<br>5. Arsip Dokumen<br>6. Persetujuan Dokumen | **Surat Masuk:** Daftar dokumen seperti Surat Permintaan Driver, Surat Pengantar, Memo Operasional, dan SOP Penjemputan. |
| **HRIS** (Ungu) | 1. Data Karyawan<br>2. Absensi<br>3. Shift<br>4. Cuti & Izin<br>5. KPI<br>6. Payroll | **Absensi Hari Ini:** Bobby (08:15 Masuk), Dina (08:10 Masuk), Andi (Belum Masuk), Rina (Belum Masuk). |
| **RAOS** (Oranye) | 1. Driver Management<br>2. Smart Queue (Antrian)<br>3. Driver Datang<br>4. Panggil Driver<br>5. Order / Penumpang<br>6. Riwayat Order | **Antrian Batam:** A001 Andi (Menunggu 3 mnt), A002 Budi (Menunggu 7 mnt), A003 Joko (Menunggu 10 mnt). Total Menunggu: 24 Driver. |
| **FINANCE** (Kuning) | 1. Pemasukan<br>2. Pengeluaran<br>3. Isi Saldo<br>4. Invoice<br>5. Laporan Keuangan<br>6. Rekap Harian / Bulanan | **Ringkasan Hari Ini:** Pemasukan Rp25.000.000, Pengeluaran Rp12.500.000, Saldo Rp12.500.000. |
| **AI** (Biru Gelap)| 1. AI Chat Assistant<br>2. Analisis Data<br>3. Rekomendasi Operasional<br>4. Prediksi Antrian<br>5. Insight Harian | **AI Chat:** Pertanyaan "Berapa omzet Batam hari ini?" dijawab dengan "Omzet Batam hari ini Rp 25.000.000. Naik 12% dari kemarin." |

---

## 5. INFRASTRUKTUR & DATABASE
Lapisan inti yang menopang seluruh modul, memastikan data sinkron secara real-time:
*   **AUTENTIKASI & OTORISASI:** Supabase Auth (Role Based Access Control)
*   **DATABASE:** Supabase PostgreSQL (Semua data terintegrasi secara real-time)
*   **STORAGE:** Supabase Storage (Foto, Dokumen, File)

---

## 6. INTEGRASI LAYANAN
Layanan eksternal terbawah yang melengkapi fungsi-fungsi spesifik aplikasi:
*   **Push Notification:** Firebase Cloud Messaging
*   **Maps & Geolocation:** OpenStreetMap
*   **AI Service:** OpenAI API
*   **Email Service:** SMTP
*   **Backup & Security:** Supabase
