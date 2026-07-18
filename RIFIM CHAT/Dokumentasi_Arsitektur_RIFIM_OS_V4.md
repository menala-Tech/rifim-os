# Dokumentasi Arsitektur RIFIM OS
## ENTERPRISE OPERATING SYSTEM
**Satu Platform • Semua Operasional • Real-time • Terintegrasi**

---

## KEUNTUNGAN MODEL RCP (ROLE + CABANG + PERMISSION)
*   Akses sesuai peran, cabang, dan kebutuhan
*   Data lebih aman dan terkontrol
*   Mudah menambah cabang / role baru
*   Menu dan data tampil otomatis sesuai hak akses
*   Siap scale untuk puluhan bandara

---

## 1. LOGIN
Proses autentikasi awal untuk masuk ke sistem.
*   **Metode:** Email/Phone, Password, Face ID/PIN
*   **Alur Sistem Login:** Verifikasi Akun &rarr; Ambil Role &rarr; Ambil Cabang &rarr; Ambil Permission &rarr; Bangun Menu &rarr; Dashboard

---

## 2. AKSES MODEL - RCP (ROLE + CABANG + PERMISSION + DATA SCOPE)
Model hierarki kontrol akses yang berpusat pada penentuan hak guna secara berjenjang hingga menghasilkan `HAK AKSES AKTIF` (Menu, Data dan Fitur tampil sesuai hak akses pengguna secara otomatis).

### LEVEL 1: ROLE (Siapa pengguna?)
*   Direktur
*   Admin Pusat
*   Koordinator
*   Staff
*   Finance / Accounting
*   Driver
*   IT Support
*   Auditor / Viewer

### LEVEL 2: CABANG (Di mana dia bekerja?)
*   Head Office (Pusat)
*   Batam (Hang Nadim)
*   Jambi (Sultan Thaha)
*   Pekanbaru (Sultan Syarif)
*   Balikpapan (SAMS Sepinggan)
*   Manado (Sam Ratulangi)
*   Makassar (Sultan Hasanuddin)
*   Soekarno-Hatta (CGK)
*   Luar Bandara / Lainnya

### LEVEL 3: PERMISSION (Fitur apa yang boleh?)
*   Chat, Smart Office, HRIS, RAOS, Finance, AI
*   Dashboard, Settings, Laporan & Export, Approval, Monitoring

### LEVEL 4: DATA SCOPE (Data apa yang boleh dilihat?)
*   Semua Data Perusahaan
*   Data Per Cabang
*   Data Per Divisi / Departemen
*   Data Tim / Unit
*   Data Pribadi (Sendiri)
*   Data Terbatas (Read Only)

---

## 3. CONTOH ROLE & AKSES

| ROLE | CABANG | AKSES UTAMA |
| :--- | :--- | :--- |
| **Direktur** | Semua Cabang | • Semua Modul<br>• Semua Data<br>• Approval Akhir |
| **Admin Pusat** | Semua Cabang | • Master Data<br>• User & Role<br>• Konfigurasi Sistem<br>• Monitoring |
| **Koordinator** | Sesuai Cabang (Sendiri) | • Chat Cabang<br>• HRIS Cabang<br>• RAOS Cabang<br>• Finance Cabang<br>• Approval Operasional |
| **Staff** | Sesuai Cabang (Sendiri) | • Chat Cabang<br>• Absensi & Shift<br>• RAOS Operasional<br>• Laporan Harian |
| **Driver** | Sesuai Cabang (Sendiri) | • Chat & Pengumuman<br>• Check-in Bandara<br>• Antrian (Smart Queue)<br>• Riwayat Order<br>• Profil |
| **Finance / Accounting** | Semua / Terbatas | • Pemasukan & Pengeluaran<br>• Invoice & Payroll<br>• Laporan Keuangan |
| **IT Support** | Semua Cabang | • Monitoring Sistem<br>• Server & Database<br>• Backup & Log |
| **Auditor / Viewer** | Sesuai Hak Audit | • Laporan (Read Only)<br>• Export Laporan<br>• Audit Trail |

---

## 4. MODUL UTAMA RIFIM OS (MENU & FITUR)

| Modul & Warna | Daftar Fitur | Preview / Data Mockup |
| :--- | :--- | :--- |
| **CHAT** (Biru) | Chat Pribadi, Grup Chat, Broadcast, Pengumuman, Share Foto/File/Lokasi, AI Assistant Chat, Pencarian Chat | **Grup Batam:** Koordinator Batam (Driver Andi sudah check-in di antrian A001) |
| **SMART OFFICE** (Hijau) | Surat Masuk, Surat Keluar, Memo & Pengumuman, SOP & Peraturan, Arsip Dokumen, Persetujuan Dokumen, Template Dokumen, E-Signature | **Contoh Dokumen:** Surat Tugas Driver 10 Mei 2024 (PDF) |
| **HRIS** (Ungu) | Data Karyawan, Absensi, Shift & Jadwal, Cuti & Izin, KPI & Penilaian, Payroll, Slip Gaji, SP & Mutasi | **Absensi Hari Ini:** Hadir (142), Terlambat (8), Tidak Hadir (3) |
| **RAOS** (Oranye) | Driver Management, Smart Queue (Antrian), Driver Datang (Check-in), Panggil Driver, Monitoring Driver (GPS), Order / Penumpang, Riwayat Order, Laporan Operasional | **Antrian Batam:** A001 Andi (Menunggu 3 mnt), A002 Budi (Menunggu 7 mnt), A003 Joko (Menunggu 10 mnt) |
| **FINANCE** (Kuning) | Pemasukan, Pengeluaran, Isi Saldo Driver, Invoice, Payroll, Laporan Keuangan, Rekap Harian / Bulanan, Export Laporan | **Ringkasan Hari Ini:** Pemasukan Rp 312.000.000, Pengeluaran Rp 125.500.000, Saldo Rp 186.500.000 |
| **AI** (Biru Gelap)| AI Chat Assistant, Analisis Data, Rekomendasi Operasional, Prediksi Antrian, KPI & Performance, Insight Harian, Laporan Otomatis | **AI Assistant:** Dialog menanyakan omzet Batam hari ini (Rp 100.000.000, Naik 12.5% dari kemarin). |

---

## 5. OUTPUT & DASHBOARD
*   Dashboard Direktur
*   Dashboard Koordinator
*   Dashboard Staff
*   Dashboard Driver
*   Laporan Otomatis (PDF / Excel)
*   Rekap Harian / Bulanan
*   Export Data
*   Notifikasi Real-time

---

## 6. PLATFORM SERVICES (LAYANAN PENDUKUNG SISTEM)

*   **SECURITY CENTER:** Role & Permission, Audit Log, Login History, 2FA & Security, Session Management
*   **NOTIFICATION CENTER:** Push Notification, In-App Notification, Email Notification, WhatsApp Notification
*   **TASK & APPROVAL:** Approval Cuti, Approval Invoice, Approval Pengeluaran, Approval Surat
*   **KNOWLEDGE CENTER:** SOP & Peraturan, Panduan & Tutorial, FAQ, Video Training
*   **SETTINGS:** Cabang & Bandara, Shift & Jam Operasional, Template & Dokumen, Pengguna & Hak Akses
*   **ANALYTICS:** Trend Order & Omzet, Peak Hour, Performa Cabang, Performa Driver & Staff, Insight & Prediksi
*   **MONITORING:** Server Status, Database, Storage & Backup, Sync & Integrasi, Error Log & Alert

---

## 7. INFRASTRUKTUR & INTEGRASI

*   **DATABASE:** Supabase (PostgreSQL) - Data terintegrasi real-time.
*   **STORAGE:** Supabase Storage - File, Foto, Dokumen, Video, Arsip.
*   **INTEGRASI:**
    *   Maps & Geolocation (OpenStreetMap)
    *   AI Service (OpenAI API)
    *   Email Service (SMTP)
    *   Push Service (FCM)
    *   WhatsApp Business API
    *   Payment Gateway (Midtrans / Xendit / Dll)
*   **BACKUP & SECURITY:** Supabase Backup, Enkripsi Data, Disaster Recovery.

---

### KETERANGAN STATUS AKSES
*   **Full Access:** Kelola Penuh
*   **Read Only:** Lihat Saja
*   **No Access:** Tidak Ada Akses
