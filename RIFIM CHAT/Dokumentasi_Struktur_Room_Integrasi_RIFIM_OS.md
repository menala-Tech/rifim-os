# RIFIM CHAT – STRUKTUR ROOM & INTEGRASI NOTIFIKASI
## Semua Komunikasi, Semua Operasional, Satu Platform.
**SINGLE APP • SINGLE DATA • SINGLE COMMAND**

---

## 1. TAMPILAN DASHBOARD (UI MOBILE)
Antarmuka menu utama yang menunjukkan indikator notifikasi (badge) pada masing-masing modul:
*   **Profil Pengguna:** Fajar Ramadhan (Koordinator - Batam) | Online
*   **Menu & Badge:**
    *   Home (Beranda & Ringkasan Aktivitas) - `12`
    *   Operasional (Info & koordinasi operasional harian) - `24`
    *   Driver (Komunikasi & informasi untuk driver) - `18`
    *   Absensi (Absensi, shift, kehadiran & reminder) - `8`
    *   Finance (Transaksi, saldo, invoice & laporan) - `15`
    *   Smart Office (Surat, memo, dokumen perusahaan) - `10`
    *   Approval (Persetujuan dokumen & transaksi) - `6`
    *   Smart Queue (Antrian driver bandara) - `14`
    *   Pengumuman (Pengumuman dari kantor pusat) - `7`
    *   AI Insight (Insight, analitik & rekomendasi AI) - `9`
    *   System (Notifikasi sistem & maintenance) - `3`
*   **Bottom Navigation:** Chats (`99+`), Kontak, AI Assistant, Notifikasi, Profil.

---

## 2. STRUKTUR ROOM CHAT RIFIM
Sistem membagi ruang komunikasi menjadi 6 tingkat ruang (*room*) yang terstruktur:

### 1. Room Seluruh Staff Semua Cabang (SCOPE TERBESAR)
*Komunikasi global untuk semua staff dari semua cabang bandara.*
*   Pengumuman penting
*   Briefing harian pusat
*   Informasi operasional global
*   Update sistem & kebijakan
*   KPI & Target Perusahaan
*   Apresiasi & Reward
*   **Target:** Semua Staff (7 Cabang)

### 2. Room Khusus Koordinator
*Komunikasi & koordinasi khusus untuk semua koordinator cabang.*
*   Koordinasi operasional
*   Share strategi & solusi
*   Evaluasi & laporan cabang
*   Masalah & eskalasi
*   Update target koordinator
*   **Target:** Semua Koordinator (7 Cabang)

### 3. Room Khusus Admin Pusat
*Komunikasi khusus untuk admin kantor pusat.*
*   Update sistem
*   Laporan & rekap pusat
*   Data management
*   User & akses control
*   Maintenance & support
*   **Target:** Admin Pusat (Head Office)

### 4. Room Khusus Manajemen Pusat
*Informasi & laporan khusus untuk manajemen pusat.*
*   Dashboard ringkasan
*   Laporan performa cabang
*   Pengambilan keputusan
*   Kebijakan & strategi
*   Approval strategis
*   **Target:** Manajemen Pusat (Top Management)

### 5. Room Khusus Staff per Cabang
*Komunikasi khusus untuk staff dalam satu cabang.*
*   Info operasional cabang
*   Koordinasi harian
*   Masalah lapangan
*   Pengumuman cabang
*   Evaluasi & kinerja
*   **Target:** Staff di Cabang (Per Cabang)

### 6. Room Khusus Driver per Cabang
*Komunikasi khusus untuk driver dalam satu cabang.*
*   Info antrean & order
*   Pengumuman driver
*   Peraturan & SOP
*   Peringatan & edukasi
*   Reward driver
*   **Target:** Driver di Cabang (Per Cabang)

---

## 3. JENIS NOTIFIKASI & SMART CARD DI SETIAP ROOM

**Keterangan:** ✅ Selalu Ada | 🟡 Sebagian (Sesuai Peran) | ❌ Tidak Ada

| JENIS NOTIFIKASI | Semua Staff (Semua Cabang) | Koordinator | Admin Pusat | Manajemen Pusat | Staff per Cabang | Driver per Cabang |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Pengumuman** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Briefing Harian** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Informasi Operasional** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Warning / Alert** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Smart Card** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Approval** | 🟡 | ✅ | ✅ | ✅ | ✅ | ❌ |
| **KPI & Target** | ✅ | ✅ | ✅ | ✅ | 🟡 | ❌ |
| **AI Insight** | ✅ | ✅ | ✅ | ✅ | 🟡 | ❌ |
| **System Info** | ✅ | ✅ | ✅ | 🟡 | ✅ | ❌ |
| **Reward & Apresiasi** | ✅ | 🟡 | 🟡 | 🟡 | ✅ | ❌ |

---

## 4. CONTOH SMART CARD DI ROOM

*   **PENGUMUMAN PENTING (Semua Staff - 08:30):** Mulai 1 Agustus 2026 SOP baru telah berlaku untuk semua cabang bandara. *(Tombol: Lihat Detail)*
*   **WARNING OPERASIONAL (Staff & Koordinator Batam - 09:15):** Batam: Belum ada driver jalan membawa orderan selama 1 jam terakhir. *(Tombol: Lihat Dashboard)*
*   **SMART QUEUE (Staff & Driver Batam - 09:20):** Antrian membludak! Gate 1: 45 driver, Gate 2: 32 driver. *(Tombol: Lihat Antrian)*
*   **ABSENSI HARIAN (Staff Batam - 07:58):** Fajar R. - Batam Shift Pagi, 07:58 - Valid. *(Tombol: Detail Absensi)*
*   **ISI SALDO (Driver Batam - 08:05):** Driver: Andi, Nominal: Rp150.000, Status: Berhasil. *(Tombol: Lihat Transaksi)*
*   **APPROVAL (Admin & Manajemen - 09:00):** Invoice INV/2026/0714 Rp 3.500.000 Menunggu persetujuan. *(Tombol: Review)*

---

## 5. CABANG YANG TERINTEGRASI
Total terdapat 7 Cabang Bandara yang terintegrasi di dalam RIFIM OS:
1.  **BTH** - Batam (Hang Nadim)
2.  **JBI** - Jambi (Sultan Thaha)
3.  **PKU** - Pekanbaru (Sultan Syarif Kasim II)
4.  **BPN** - Balikpapan (Sultan Aji Muhammad S.)
5.  **MDC** - Manado (Sam Ratulangi)
6.  **MKS** - Makassar (Sultan Hasanuddin)
7.  **CGK** - Soekarno-Hatta (Jakarta)

---

## 6. ALUR NOTIFIKASI (CONTOH)
1.  **Event / Trigger** (Absensi, Order, Warning, Approval, Dll) &rarr;
2.  **Notification Engine** (Otomatis) &rarr;
3.  **Routing by Room** (Sesuai Scope & Role) &rarr;
4.  **Smart Card di Room** (Sesuai Prioritas) &rarr;
5.  **User Menerima & Bertindak**

---

## 7. KEUNTUNGAN STRUKTUR ROOM INI
*   ✅ Komunikasi lebih terarah & tidak bercampur.
*   ✅ Informasi tepat sasaran sesuai peran & cabang.
*   ✅ Notifikasi relevan, tidak mengganggu.
*   ✅ Operasional lebih cepat & efisien.
*   ✅ Kontrol & keamanan lebih terjaga.
*   ✅ Data & laporan lebih akurat.

---

### FITUR PENDUKUNG DASAR
*   **REAL-TIME:** Notifikasi Instant
*   **SMART CARD:** Informasi Ringkas & Actionable
*   **ROLE BASED:** Akses Terkontrol
*   **MULTI CABANG:** Terintegrasi 7 Bandara
*   **AI POWERED:** Insight & Rekomendasi
*   **AMAN & TERKONTROL:** Data & Komunikasi Aman
