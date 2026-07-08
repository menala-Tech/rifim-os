# database/

> Seluruh struktur database RIFIM OS. Hanya schema dan migration — tidak ada data produksi.

---

## Rules

- Jangan simpan data produksi di repository
- Schema harus didesain agar bisa migrasi Phase 1 → Phase 2 tanpa ubah arsitektur
- Setiap perubahan schema harus ada migration file-nya

---

## Migration Path

```
Phase 1                    Phase 2
Google Sheets    →    Supabase PostgreSQL
(Prototyping)         (Production)
```

Desain schema dari awal mengikuti struktur relasional agar migrasi mulus.

---

## Structure

| Folder | Isi |
|--------|-----|
| `google-sheet/` | Struktur & konfigurasi Google Sheets (Phase 1) |
| `supabase/` | SQL schema & config Supabase (Phase 2) |
| `schema/` | Entity definitions & field definitions |
| `migration/` | Migration scripts dari Phase 1 ke Phase 2 |
| `seed/` | Data awal untuk development & testing |
