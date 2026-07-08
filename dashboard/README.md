# dashboard/

> Dashboard RIFIM OS berdasarkan role pengguna.

---

## Rules

- Setiap role memiliki dashboard yang berbeda sesuai hak akses
- Role tidak boleh saling bercampur dalam satu file
- Data dashboard diambil dari module layer, bukan langsung dari database

---

## Roles

| Folder | Role | Access Level |
|--------|------|-------------|
| `director/` | Direktur | Full access — semua KPI, laporan, executive summary |
| `admin/` | Admin | Smart Office, HRIS input, Finance input |
| `koordinator/` | Koordinator | RAOS, driver management, operasional |
| `staff/` | Staff | Task assigned, dokumen, absensi |
| `driver/` | Driver | Jadwal, pickup point, saldo |
