# Dokumentasi RIFIM OS
## Enterprise Operating System
**Satu Aplikasi • Semua Operasional • Semua Terintegrasi**

---

## 1. Akses Pengguna & Alur Login

### Akses Pengguna
Sistem memiliki kontrol akses berbasis peran (Role-Based Access Control) yang terbagi menjadi 4 tingkat pengguna:
*   **Direktur:** Akses Semua Data
*   **Koordinator:** Akses Cabang
*   **Staff:** Akses Operasional
*   **Driver:** Akses Driver

### Alur Login
*   **Metode Autentikasi:** Email / Phone, Password / PIN, Face ID / Fingerprint
*   **Flow:** Input Kredensial &rarr; Klik `LOGIN` &rarr; Verifikasi Berhasil &rarr; Masuk ke `HOME / DASHBOARD UTAMA`.

---

## 2. Home / Dashboard Utama

Dashboard utama menampilkan ringkasan data operasional secara *real-time*. Di bagian kiri terdapat **Navigasi Sidebar** yang berisi: Beranda, Chat, Dashboard, Notifikasi, Quick Action, Kalender, Dokumen Saya, dan Pengaturan.

### Ringkasan Statistik (Hari Ini)
| Metrik | Nilai | Keterangan |
| :--- | :--- | :--- |
| **Omzet Hari ini** | Rp 312.000.000 | Naik 12.5% dari kemarin |
| **Driver Online** | 186 | dari 320 driver |
| **Staff Hadir** | 142 | dari 176 staff |
| **Order Hari ini** | 1.248 | Naik 8.7% dari kemarin |

### Visualisasi Data (Grafik & Chart)
*   **Omzet 7 Hari Terakhir:** Grafik Garis (*Line Chart*) yang menunjukkan tren naik-turun dalam seminggu.
*   **Komposisi Omzet per Cabang:** Grafik Donat (*Donut Chart*) dengan persentase: Batam (32%), Pekanbaru (24%), Balikpapan (19%), Manado (13%), dan Jambi (11%).
*   **Antrian Driver (Semua Cabang):** Daftar status antrian meliputi: Menunggu (68), Dipanggil (12), Sedang Order (74), Selesai Hari Ini (132).

---

## 3. Pusat Pemberitahuan & Aksi Cepat (Panel Kanan)

### Notification Center
Daftar aktivitas sistem terbaru beserta waktunya:
*   `08:15` - Driver Andi sudah check-in
*   `08:10` - Isi saldo Rp500.000 berhasil
*   `07:45` - Pengumuman baru
*   `07:30` - Staff Rina belum absen
*   `07:15` - Invoice INV-2024-001 perlu approval

### Quick Action (Aksi Cepat)
Menu pintasan berbentuk *icon* untuk mengeksekusi tugas langsung: Absensi, Isi Saldo, Driver Datang, Buat Laporan, Pengumuman, Ajukan Cuti, Buat Surat, dan opsi Lainnya.

---

## 4. Modul Utama Sistem

RIFIM OS terdiri dari 6 modul utama dengan warna yang berbeda sebagai penanda fungsionalitasnya:

### A. CHAT (Warna Biru)
Fitur komunikasi internal organisasi.
*   **Fitur:** 1. Chat Pribadi, 2. Grup Cabang, 3. Grup Divisi, 4. Broadcast / Pengumuman, 5. Share Foto, Dokumen, Lokasi, 6. AI Assistant Chat.
*   *Tampilan Mockup:* Percakapan "Grup Batam" terkait konfirmasi kedatangan driver.

### B. SMART OFFICE (Warna Hijau)
Fitur manajemen administrasi dan persuratan.
*   **Fitur:** 1. Surat Masuk, 2. Surat Keluar, 3. Memo, 4. SOP & Peraturan, 5. Arsip Dokumen, 6. Persetujuan Dokumen.
*   *Tampilan Mockup:* "Dokumen Terbaru" berupa Surat Tugas, Memo Internal, dan SOP Pickup Point.

### C. HRIS (Warna Ungu)
Fitur pengelolaan sumber daya manusia (SDM).
*   **Fitur:** 1. Data Karyawan, 2. Absensi, 3. Shift & Jadwal, 4. Cuti & Izin, 5. KPI & Penilaian, 6. Payroll.
*   *Tampilan Mockup:* Statistik "Absensi Hari Ini" (Hadir: 142, Terlambat: 8, Izin: 5, Tidak Hadir: 21).

### D. RAOS (Warna Oranye)
Sistem operasional dan manajemen driver.
*   **Fitur:** 1. Driver Management, 2. Smart Queue (Antrian), 3. Driver Datang, 4. Panggil Driver, 5. Order / Penumpang, 6. Riwayat Order.
*   *Tampilan Mockup:* "Antrian Batam" yang berisi daftar tunggu driver (Andi, Budi, Joko) secara *real-time*.

### E. FINANCE (Warna Kuning/Emas)
Fitur pengelolaan lalu lintas keuangan.
*   **Fitur:** 1. Pemasukan, 2. Pengeluaran, 3. Isi Saldo, 4. Invoice, 5. Laporan Keuangan, 6. Rekap Harian / Bulanan.
*   *Tampilan Mockup:* "Ringkasan Hari Ini" (Pemasukan: Rp312 Juta, Pengeluaran: Rp125.5 Juta, Saldo: Rp186.5 Juta).

### F. AI (Warna Biru Gelap)
Fitur asisten kecerdasan buatan terintegrasi.
*   **Fitur:** 1. AI Chat Assistant, 2. Analisis Data, 3. Rekomendasi Operasional, 4. Prediksi Antrian, 5. Insight Harian.
*   *Tampilan Mockup:* Dialog pengguna dengan AI yang menanyakan "Berapa omzet Batam hari ini?" lalu dijawab secara instan berdasarkan data sistem.

---

## 5. Dashboard Eksekutif & Analitik

Panel di sebelah kanan modul utama yang ditujukan untuk *High-Level Overview*:

*   **EXECUTIVE DASHBOARD:** Monitoring Semua Cabang, KPI & Performance, Pendapatan & Biaya, Performa Driver & Staff, Grafik & Laporan Real-time.
*   **ANALYTICS & INSIGHT:** Trend Order & Omzet, Peak Hour, Performa Cabang, Performa Driver, Performa Staff.

---

## 6. Platform Services (Layanan Pendukung)

Terletak di bagian bawah modul utama, merupakan kerangka sistem yang mendukung seluruh aplikasi:

| Modul Pendukung | Detail Layanan |
| :--- | :--- |
| **Security Center** | Role & Permission, Audit Log, Login History, 2FA & Security |
| **Notification Center** | Push Notification, In-App Notification, Email Notification, WhatsApp (Opsional) |
| **Task & Approval** | Approval Cuti, Approval Invoice, Approval Pengeluaran, Approval Surat |
| **Knowledge Center**| SOP & Peraturan, Panduan & Tutorial, FAQ, Video Training |
| **Settings** | Cabang & Bandara, Shift & Jam Operasional, Template Dokumen, Pengguna & Hak Akses |
| **Monitoring** | Server Status, Database, Storage & Backup, Error Log & Alert |

---

## 7. Infrastruktur & Integrasi

Sistem RIFIM OS disokong oleh ekosistem database dan integrasi pihak ketiga:

*   **Database & Backend:** Supabase (PostgreSQL) - Menjamin data terintegrasi secara *real-time*.
*   **Storage:** Supabase Storage (Tempat penyimpanan File, Foto, Dokumen, Arsip).
*   **Integrasi Service:**
    *   **Maps & Geolocation:** OpenStreetMap
    *   **AI Service:** OpenAI API
    *   **Email Service:** SMTP
    *   **Backup & Security:** Di-handle melalui Supabase.

---

## 8. Output & Reporting

Modul paling ujung kanan bawah, berfungsi sebagai *deliverables* atau keluaran dari seluruh data RIFIM OS:
*   Dashboard Direktur
*   Laporan Otomatis (PDF/Excel)
*   Rekap Harian / Bulanan
*   Export Data
*   Notifikasi Real-time
