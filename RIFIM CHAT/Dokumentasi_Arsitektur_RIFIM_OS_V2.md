# Dokumentasi Arsitektur Sistem RIFIM OS
## ENTERPRISE OPERATING SYSTEM

---

## 1. PENGGUNA & ROLE
Sistem mendukung berbagai tingkatan pengguna dengan hak akses spesifik:
*   **Direktur:** Akses Semua Cabang, Semua Modul
*   **Admin Pusat:** Kelola Sistem, User, Master Data
*   **Koordinator:** Akses Cabang Sendiri, Kelola Operasional Cabang
*   **Staff:** Akses Fitur Operasional Cabang Sendiri
*   **Driver:** Akses Terbatas (Driver & Antrian)
*   **Finance / Accounting:** Akses Modul Keuangan
*   **IT Support:** Monitoring & Pemeliharaan Sistem
*   **Auditor:** Akses Read Only (Laporan & Audit)

### MODEL AKSES RCP (Role + Cabang + Permission + Data Scope)
*   **ROLE:** Menentukan jabatan / fungsi pengguna
*   **CABANG:** Menentukan cabang yang dapat diakses
*   **PERMISSION:** Menentukan fitur & aksi yang boleh dilakukan
*   **DATA SCOPE:** Menentukan data apa yang boleh dilihat / dikelola
> *Akses menu & data otomatis sesuai hak akses pengguna*

---

## 2. RIFIM CHAT (PUSAT AKTIVITAS)
Berada di lapisan teratas antarmuka pengguna, berfungsi sebagai pusat komunikasi dan interaksi cepat:
*   Chat Pribadi
*   Grup & Channel
*   Pengumuman
*   Notifikasi
*   AI Assistant
*   Quick Action

---

## 3. MODUL UTAMA SISTEM
Terdiri dari 5 modul operasional inti yang terhubung secara dua arah (Sinkronisasi Real-time) dengan RIFIM Chat dan RIFIM Core Platform:

| SMART OFFICE (Hijau) | HRIS (Ungu) | RAOS (Oranye) | FINANCE (Kuning) | AI (Biru) |
| :--- | :--- | :--- | :--- | :--- |
| • Surat & Dokumen<br>• SOP & Peraturan<br>• Memo & Pengumuman<br>• Arsip & Filing<br>• Template Dokumen<br>• Tanda Tangan Digital | • Data Karyawan<br>• Absensi & Shift<br>• Cuti & Izin<br>• KPI & Penilaian<br>• Payroll & Slip Gaji<br>• Mutasi & Resign | • Driver Management<br>• Check-in Bandara<br>• Smart Queue (Antrian)<br>• Panggil Driver<br>• Monitoring Driver (GPS)<br>• Laporan Operasional | • Pemasukan<br>• Pengeluaran<br>• Isi Saldo Driver<br>• Invoice<br>• Payroll<br>• Laporan Keuangan | • AI Chat Assistant<br>• Analisis Data<br>• Rekomendasi<br>• Prediksi Antrian<br>• Insight & Laporan<br>• Natural Language |

---

## 4. RIFIM CORE PLATFORM (INTEGRATION LAYER)
**Otak Sistem - Menghubungkan Semua Modul & Layanan**
Berisi sekumpulan *services* inti yang menjalankan *logic* aplikasi:
*   **Authentication & Authorization** (RCP Model)
*   **User & Role Management**
*   **Permission Management**
*   **Branch Management**
*   **Notification Service** (Real-time & Push)
*   **Workflow Engine** (Approval & Proses)
*   **Document Engine** (Create, Convert, Sign, Storage)
*   **AI Gateway** (AI Service Management)
*   **API Gateway** (REST API)
*   **Audit Log** (Activity & Change Tracking)
*   **Analytics Engine** (Reporting & BI)
*   **Cache & Queue** (Optimasi Performa)

---

## 5. SECURITY LAYER (RCP)
Lapisan keamanan untuk mengontrol lalu lintas data ke sistem utama:
*   **Role Based Access Control:** Kontrol berbasis peran.
*   **Branch Based Access Control:** Kontrol berbasis wilayah/cabang.
*   **Permission Based Access Control:** Kontrol level izin fitur.
*   **Data Scope Control:** Filtering Data spesifik.

---

## 6. DATA & INFRASTRUCTURE LAYER
Infrastruktur backend dan penyimpanan sistem:
*   **SUPABASE (Backend as a Service):**
    *   PostgreSQL (Database)
    *   Realtime (WebSocket)
    *   Storage (File, Foto, Dokumen)
    *   Edge Functions (Serverless)
*   **INTEGRATION SERVICES (Layanan Pihak Ketiga Internal):**
    *   Maps & Geolocation (OpenStreetMap)
    *   Email Service (SMTP)
    *   Push Notification (FCM)

---

## 7. INTEGRASI EKSTERNAL
Konektivitas dengan aplikasi/layanan dari luar:
*   **Google Workspace:** (Gmail, Calendar, Drive)
*   **WhatsApp Business API:** (Notifikasi ke Driver)
*   **OpenStreetMap:** (GPS & Geofence)
*   **Firebase Cloud Messaging:** (Push Notification)
*   **OpenAI API:** (AI Assistant)
*   **Payment Gateway:** (Midtrans / Xendit)
*   **Sistem Maxim:** (Integrasi jika tersedia)

---

## 8. CONTOH ALUR INTEGRASI (WORKFLOW)
Diagram menampilkan 4 *use case* utama yang lintas modul:
1.  **Driver Check-in:** `Driver` &rarr; `RAOS` &rarr; `Chat (Notifikasi)` &rarr; `Dashboard Update`
2.  **Isi Saldo Driver:** `Staff` &rarr; `RAOS` &rarr; `Finance` &rarr; `Chat (Notifikasi)` &rarr; `Koordinator`
3.  **Surat Tugas:** `Smart Office` &rarr; `Approval (Workflow)` &rarr; `TTE Digital Sign` &rarr; `PDF & Arsip (Database)`
4.  **Absensi Staff:** `HRIS (Absensi)` &rarr; `Payroll` &rarr; `Finance` &rarr; `Dashboard` &rarr; `AI KPI`

---

## 9. MONITORING & RELIABILITY
Pusat pemantauan kesehatan sistem:
*   Server Monitoring
*   Database Monitor
*   Error Log & Alert
*   Backup & Recovery
*   Uptime Monitoring
*   Performance Monitor

---

## 10. PRINSIP INTEGRASI RIFIM OS
Fondasi operasional *software*:
*   **Satu Data:** Input Sekali, Pakai Bersama
*   **Real-time:** Data Update Secara Real-time
*   **Terintegrasi:** Semua Modul Saling Terhubung
*   **Aman:** Akses Sesuai Hak (RCP Model)
*   **Skalabel:** Siap untuk Puluhan Bandara & Ribuan User
*   **Reliabel:** Backup, Monitoring & High Availability

---

## 11. KETERANGAN (LEGEND DIAGRAM)
*   **Panah Garis Penuh:** Alur Data / Proses
*   **Panah Putus-putus:** Integrasi Eksternal
*   **Garis Hijau:** Keamanan & Akses
*   **Panah Bolak-balik (Biru):** Sinkronisasi Real-time
