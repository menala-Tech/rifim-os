# testing/

> Test suite RIFIM OS. Semua fitur wajib memiliki test sebelum dinyatakan done.

---

## Rules

- Setiap engine wajib memiliki unit test
- Setiap workflow wajib memiliki integration test
- UAT dilakukan bersama pengguna akhir sebelum release

---

## Structure

| Folder | Type | Scope |
|--------|------|-------|
| `unit/` | Unit Test | Fungsi & engine secara isolated |
| `integration/` | Integration Test | Alur antar modul |
| `uat/` | User Acceptance Test | Checklist & hasil test pengguna |
