Update modul HRIS Absensi :

1. Halaman Absensi 
- PWA RAOS jadi ssot absensi karyawan lalu otomatis datanya masuk ke HRIS Absensi secara realtime
- Depertemen di halaman absensi ganti jadi Cabang
- Tambah fungsi 'save pdf'
- tambah fungsi Link Foto absensi dari PWA RAOS
- foto Absensi dari PWA RAOS disimpan ke Folder https://drive.google.com/drive/folders/1Aq-tMtVm89krrt1WNSpEy9k_cxAlsTfh > dan buat sublfolder Bulan > subfolder Cabang > subfolder Nama staff
- tambahkan Kolom Terlambat > potongan Terlambat 10000/30 menit
- buatkan di Halaman absensi tombol fungsi edit : potongan absensi dan jam masuk dan jam pulang staff yg ter wire ke Semua Modul dan PWA RAOS (otomatis update di table supabase dan sheet bila ada)
- tambahkan Kolom Lokasi absensi
- Perhitungan Libur dalam 1 bulan 4hr > klo  1 bulan 30 hari aja perhitungan gapok 30 hari - 4 hari libur =26 hari kerja begitu juga kalo 31 hari maka perhitungan Gapok 31hari-4 hari libur = 27 hari kerja : Gapok (buat otomatis dan sumber data Nama,id staff,dll dari Halaman Karyawan di HRIS)
- sinkronkan dengan Halaman PAyrol di HRIS dan modul Finance
- perhitungan ulang setiap tanggal 1
- simpan data setiap tanggal 01 otomatis ke folder https://drive.google.com/drive/folders/1Aq-tMtVm89krrt1WNSpEy9k_cxAlsTfh buat subfolder 'Absensi" > subfolder 'Bulan'> spreadsheet Absensi (Bulan)   