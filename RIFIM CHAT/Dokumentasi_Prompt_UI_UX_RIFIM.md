# DOKUMENTASI PROMPT AI – RIFIM OS

Dokumen ini merangkum panduan desain dan spesifikasi prompt AI untuk pembuatan aset UI/UX dan Logo RIFIM OS (Integrasi Maxim Airport).

---

## BAGIAN 1: PROMPT AI – TAMPILAN DASHBOARD RIFIM CHAT
**Buat UI/UX dashboard mobile aplikasi komunikasi operasional Maxim Airport dengan identitas RIFIM.**

### 1. STRUKTUR LAYOUT
1.  Header (Profil, pencarian, chat, notifikasi)
2.  Banner (Logo RIFIM + latar airport)
3.  Card Briefing Hari Ini
4.  Ringkasan Hari Ini (Statistik)
5.  Menu Cepat (2 Baris)
6.  Pengumuman Terbaru
7.  Bottom Navigation Bar

### 2. HEADER
*   **Profil:** Fajar Ramadhan | Koordinator - Batam | Online
*   **Background:** transparan (mengikuti banner)
*   **Teks nama:** putih, tebal
*   **Status online:** hijau
*   **Ikon:** putih minimalis (Search, Chat, Notifikasi dengan badge merah '12')

### 3. BANNER
*   **Latar belakang:** foto/ilustrasi bandara (sunset)
*   **Logo:** RIFIM + Maxim di tengah kiri
*   **Efek:** cahaya hangat dari arah belakang logo
*   **Kesan:** memberi kesan profesional & terpercaya

### 4. CARD BRIEFING
*   **Konten:** Briefing Hari Ini (07:00 - Meeting Point, Operasional Bandara Hang Nadim)
*   **Background:** krem/kuning sangat muda
*   **Icon briefing:** kuning
*   **Button:** kuning dengan teks hitam ("Lihat Detail")
*   **Sudut:** membulat, shadow halus

### 5. RINGKASAN HARI INI (STATISTIK)
| Kategori | Angka Besar | Perubahan (+/-) |
| :--- | :--- | :--- |
| **Driver Datang** | 128 | +12 |
| **Smart Queue** | 23 | -3 |
| **Isi Saldo** | 15 | +4 |
| **Approval** | 8 | +2 |

*   **Background card:** hitam gelap
*   **Angka besar:** warna sesuai kategori
*   **Angka kecil:** perubahan (+/-)
*   **Update time:** di kanan atas (Update 08:30 >)

### 6. PENGUMUMAN TERBARU
*   **Konten:** Perubahan titik jemput di area Gate 2. Untuk hari ini, lokasi pickup berpindah ke area baru.
*   **Background:** krem/kuning muda
*   **Waktu:** di kanan atas (10:15)
*   **Tombol:** call-to-action kuning ("Baca Selengkapnya")

### 7. BOTTOM NAVIGATION
*   **Menu:** Beranda, Chat, AI Insight, Notifikasi, Akun
*   **Background:** hitam
*   **Ikon aktif (Beranda):** warna kuning
*   **Ikon lain:** putih
*   **Badge:** notifikasi merah pada menu Notifikasi (12)

### 8. PALET WARNA
*   **Kuning Utama:** `#FFC700`
*   **Krem Muda:** `#FFF6E0`
*   **Hitam Background:** `#121212`
*   **Hijau Success:** `#22C55E`
*   **Oranye Warning:** `#F59E0B`
*   **Biru Info:** `#3B82F6`
*   **Ungu Akses:** `#8B5CF6`
*   **Merah Error/Badge:** `#EF4444`
*   **Abu-abu Teks/Ikon:** `#E5E7EB`

### 9. TIPOGRAFI
*   **Font Family:** Poppins
*   **Nama & Judul:** Poppins SemiBold
*   **Subjudul:** Poppins Regular
*   **Angka Statistik:** Poppins Bold
*   **Ukuran utama:** 14px - 18px
*   **Angka besar statistik:** 22px - 28px

### 10. ICON STYLE
*   Gaya line/filled kombinasi
*   Sudut membulat, modern
*   Konsisten & mudah dikenali

### 11. KESAN VISUAL & TUJUAN
*   **PROFESIONAL:** Tampilan modern dan terstruktur
*   **CEPAT & MUDAH:** Informasi penting mudah diakses
*   **INFORMATIF:** Ringkasan data real-time dalam satu layar
*   **TERINTEGRASI:** Semua fitur operasional dalam satu aplikasi
*   **TERPERCAYA:** Warna kuning & hitam memberi kesan aman & kuat

### 12. PROMPT AI (COPY & PASTE)
> Buat tampilan UI/UX dashboard aplikasi mobile RIFIM CHAT untuk operasional Maxim Airport. Tema warna utama kuning, hitam, dan krem. Header transparan dengan avatar kiri, ikon search, chat, dan bell dengan badge merah. Banner latar bandara saat sunset dengan logo RIFIM dan Maxim di tengah. Card briefing hari ini berwarna krem dengan tombol kuning "Lihat Detail".
> 
> Di bawahnya ringkasan statistik dalam 4 card (Driver Datang, Smart Queue, Isi Saldo, Approval) dengan angka besar dan perubahan kecil. Menu Cepat dalam 2 baris icon berwarna di card gelap. Pengumuman terbaru di card krem dengan tombol kuning. 
> 
> Bottom navigation 5 menu: Beranda aktif kuning, Chat, AI Insight, Notifikasi (badge merah), Akun.
> Tampilan modern, rounded, shadow halus, tipografi Poppins, profesional dan mudah dibaca.

### SPESIFIKASI TEKNIS
*   **Resolusi:** 1170 x 2078 px (mobile portrait)
*   **Style:** Modern, Clean, Corporate
*   **Format:** PNG / Figma / Illustrator
*   **Mode:** Light on Dark
*   **Corner Radius:** 16px - 24px
*   **Shadow:** Soft

---
---

## BAGIAN 2: PROMPT AI – LOGO RIFIM DI DASHBOARD
**Buat logo "RIFIM" seperti pada gambar dashboard, bergaya 3D modern, profesional, dan premium dengan latar belakang airport sunset, untuk aplikasi sistem operasional Maxim Airport.**

### DETAIL ELEMEN LOGO
1.  **FRAME KOTAK "Ri":** Bentuk kotak berwarna merah metalik dengan efek 3D tebal, bevel tajam, memiliki kedalaman dan highlight glossy. Melambangkan fondasi, kekuatan, dan identitas utama.
2.  **HURUF "FIM":** Huruf kapital tebal, 3D solid, warna merah metallic dengan gradasi gelap-terang, efek bevel, shadow, dan pantulan cahaya. Menunjukkan keberanian, energi, dan profesionalisme.
3.  **PANAH DINAMIS:** Panah melengkung dari kiri ke kanan atas, berwarna merah metalik, 3D glossy. Melambangkan pertumbuhan, kemajuan, dan arah masa depan.
4.  **CITY SKYLINE:** Deretan gedung-gedung modern berwarna silver/abu metalik di belakang logo, memberi kesan kemajuan, teknologi, dan skala enterprise.
5.  **TEKS "maxim":** Huruf kecil rounded, 3D glossy. Warna: m = kuning, a = merah, xim = putih/silver. Menggambarkan kolaborasi dan identitas Maxim yang terintegrasi.

### TAMPAK & SUDUT PANDANG
*   Tampak Depan
*   Tampak Samping Kanan
*   Tampak Atas (Orthogonal)
*   Tampak 3/4 (Isometric)

### TIPOGRAFI
*   **HURUF "RIFIM":** Font Custom (Bold Sans Serif). Kapital, geometris, tebal, modern. 3D Extrude, bevel, glossy.
*   **TEKS "MAXIM":** Font Rounded Sans (Custom/Modified). Lowercase, friendly, modern, 3D glossy.

### PALET WARNA & EFEK
*   **Warna Utama:** `#D71920` (Merah), `#A01016` (Merah Gelap), `#F2F2F2` (Putih), `#8F8F8F` (Abu-abu), `#FFC700` (Kuning).
*   **Material & Efek:** 3D Extrude Depth, Bevel Sharp, Glossy Reflection, Soft Shadow, Ambient Occlusion, Global Illumination.

### DESKRIPSI PROMPT AI (COPY & PASTE)
> Buat logo 3D modern premium bertuliskan "RIFIM" dengan desain seperti berikut:
> - Huruf "Ri" berada di dalam kotak bingkai merah 3D tebal dengan bevel tajam.
> - Huruf "FIM" berwarna merah metalik 3D di sebelah kanan "Ri".
> - Ada panah melengkung merah dari kiri ke kanan atas melewati logo.
> - Di belakang logo terdapat city skyline gedung-gedung modern berwarna silver/abu metalik.
> - Di bawahnya ada tulisan "maxim" huruf kecil rounded, warna: m kuning, a merah, xim putih/silver.
> - Latar belakang airport saat sunset dengan control tower, pesawat, terminal, dan cahaya matahari dari belakang logo (sun burst), suasana profesional dan cinematic.
> - Hasilkan logo tanpa teks lain, kualitas ultra detail, 3D rendering, photorealistic style.

### SPESIFIKASI TEKNIS
*   **Format:** PNG (Transparan) & JPG
*   **Resolusi:** 2048x2048 px (Minimal)
*   **Style:** 3D Modern, Premium, Cinematic
*   **Warna:** Merah, Kuning, Putih/Silver, Abu Metalik
*   **Komposisi:** Seimbang, Proporsional
*   **Kesan:** Kuat, Dinamis, Profesional, Terpercaya
*   **Penggunaan:** Dashboard, Aplikasi, Banner, Icon

### NILAI BRAND YANG DIREPRESENTASIKAN
*   **Integritas:** Kepercayaan & Kejujuran (Ikon perisai/ceklis)
*   **Inovasi:** Teknologi & Cinematic (Ikon lampu)
*   **Kualitas:** Standar Tinggi (Ikon medali/gear)
*   **Kualitas / Pertumbuhan:** Pertumbuhan & Masa Depan (Ikon grafik naik) *(Catatan: Di gambar teks terakhir terpotong/buram, diasumsikan sebagai Pertumbuhan)*
