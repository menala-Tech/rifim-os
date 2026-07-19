# AI_RULES.md — RIFIM Group DDS v2.0

Aturan ini berlaku untuk SEMUA konten dokumen yang dibantu/di-generate
otomatis oleh AI (Claude Code saat mengembangkan sistem, maupun fitur
AI-assist di dalam RIFIM OS sendiri), untuk ketiga entitas
(RIFIM, Menala/MIG, Lailan).

## 1. Prinsip Utama
AI TIDAK BOLEH mengarang data faktual. Semua field data (nama, nomor,
tanggal, nominal, nama karyawan, alamat, dsb) HARUS berasal dari input
form/database yang diisi user atau dari sheet `companies` /
`numbering_sequences` — AI hanya boleh membantu menyusun KALIMAT/NARASI
di sekitar data yang sudah ada, bukan menciptakan datanya.

## 2. Yang Boleh Dibantu AI
- Menyusun paragraf pembuka/penutup surat yang formal, berdasarkan
  perihal & jenis dokumen yang dipilih user.
- Merapikan tata bahasa isi surat yang diketik user (tanpa mengubah makna
  atau menambah klaim yang tidak diketik user).
- Menyarankan wording standar untuk jenis dokumen tertentu (mis. kalimat
  baku pembukaan Surat Peringatan) — tetap sebagai draft yang harus
  direview manusia sebelum di-generate final.

## 3. Yang TIDAK Boleh Dilakukan AI
- Mengisi nominal, tanggal, atau nama yang tidak diinput user.
- Mengubah nomor dokumen atau format penomoran (lihat [LETTER_STRUCTURE.md](../09-UI-UX/document-design-system/LETTER_STRUCTURE.md)
  §1 — murni logika sistem berbasis sheet `numbering_sequences`, bukan
  ranah AI).
- Mengarang/menebak identitas entitas (alamat, NIB, NPWP, dll) — semua
  itu harus ditarik dari sheet `companies`, bukan dihafal/ditebak AI.
- Menghasilkan konten untuk dokumen HR sensitif (SP1-3, PHK) tanpa
  konfirmasi eksplisit dari user bahwa isi sudah benar.
- Mengubah aturan visual di DDS (margin, warna, font, dll) atau aturan
  algoritma di [AUTOMATION_RULES.md](../09-UI-UX/document-design-system/AUTOMATION_RULES.md) secara sepihak saat membangun/mengubah
  kode — perubahan harus lewat file DDS ini dulu, baru diimplementasikan.

## 4. Nada & Bahasa
Bahasa Indonesia formal/baku, sesuai [LETTER_STRUCTURE.md](../09-UI-UX/document-design-system/LETTER_STRUCTURE.md) §5. Hindari
bahasa yang terlalu kaku-robotik atau sebaliknya terlalu santai — target:
nada surat resmi korporat Indonesia standar, konsisten di ketiga entitas.

## 5. Saat AI Mengembangkan/Mengaudit Kode Sistem Ini
- Ikuti prinsip di [DDS_v1.0.md](../09-UI-UX/document-design-system/DDS_v1.0.md) §2 (satu sumber kebenaran, konsisten
  lintas jenis dokumen, entitas, & output).
- Jangan hardcode nilai styling atau identitas entitas di luar file
  config utama / sheet `companies` — semua nilai harus bisa ditelusuri
  balik ke sumbernya.
- Ikuti algoritma di [AUTOMATION_RULES.md](../09-UI-UX/document-design-system/AUTOMATION_RULES.md) untuk kalkulasi ruang halaman,
  page-break signature, dan konsistensi PDF — jangan improvisasi logika
  sendiri di luar itu.
- Perubahan besar pada arsitektur (bukan sekadar memperbaiki bug kecil)
  WAJIB dilaporkan dan menunggu persetujuan sebelum dieksekusi.
