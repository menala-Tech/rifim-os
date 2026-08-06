# Audit E2E Pipeline Pengisian Saldo
Tanggal audit: 2026-08-06
Status: **TIDAK sinkron 100% — terdapat blocker keamanan dan integritas transaksi**
Scope repo:
- `C:\Projects\menala\RAOS`; `C:\Projects\menala\rifim-os`; Supabase project `vlievtojpmrbsmzlqswl` (introspeksi read-only 2026-08-06); Spreadsheet `RAOS — Rifim Airport Operation System`, tab `Form Isi Saldo`
Metode:
- Static trace PWA RAOS, GAS RAOS, Finance RIFIM OS, dan Bookmarklet AIST v2.; Introspeksi actual schema, constraint, index, RLS, trigger, function, dan publication.; Verifikasi header aktual tab `Form Isi Saldo` melalui Google Sheets.; Inventarisasi file test/Playwright pada kedua repo.; Tidak ada mutation DB, perubahan backend, perubahan bookmarklet, atau penambahan test.
## Ringkasan Eksekutif
Pipeline yang benar-benar aktif pada 2026-08-06 adalah:
1. Staff submit dari PWA RAOS.
2. PWA insert `raos_saldo_requests` dengan status `pending`.
3. PWA membuat bubble `chat_messages.type='saldo_request'`.
4. DB mengirim Broadcast Realtime `raos-saldo-new` untuk Finance.
5. Koordinator approve/reject langsung dari PWA RAOS.
6. Finance Dashboard atau Bookmarklet memanggil GAS proxy untuk mark paid.
7. GAS proxy memakai service-role untuk PATCH DB.
8. Trigger DB memberi push processed dan snapshot KPI ke chat pribadi.
9. Sheet `Form Isi Saldo` sekarang arsip pasif; cron sync dan onEdit write-back sudah dihapus.
Kesimpulan utama:
- 🔴 Endpoint Finance bukan autentikasi session/token; caller cukup mengirim email whitelist.; 🔴 `_finSaldoRaosMarkPaid_` menulis email ke `processed_by uuid`, sehingga request normal gagal.; 🔴 Bookmarklet mark paid sebelum operator menekan OK/berhasil di AIST.; 🔴 Tidak ada `client_id` pada actual `raos_saldo_requests`; offline replay request tidak deduplicated.; 🟡 `raos_saldo_requests` tidak masuk publication Postgres Changes.; 🟡 Trigger processed aktual tidak membuat chat “Terima kasih” di room saldo/driver.; 🟡 Sheet bukan lagi cron 5-menit dan checkbox bukan jalur operasional.; 🟡 Tidak ada Playwright test saldo di kedua repo.; 🔵 Broadcast Finance mempunyai dedup by request `id` dan fallback poll.
## Matriks Finding
| ID | Severity | Ringkasan | Dampak |
|---|---|---|---|
| F-01 | 🔴 blocker | Finance auth hanya email query-string | Impersonasi admin dan bypass RLS |
| F-02 | 🔴 blocker | `processed_by` dikirim email, schema meminta UUID | Mark paid gagal untuk caller normal |
| F-03 | 🔴 blocker | Bookmarklet mark paid sebelum AIST commit | DB dapat “lunas” walau AIST batal/gagal |
| F-04 | 🔴 blocker | Mark paid tanpa precondition | Pending/rejected dapat diproses; race overwrite metadata |
| F-05 | 🔴 blocker | Tidak ada dedup `client_id` di saldo request | Offline/retry dapat membuat transaksi ganda |
| F-06 | 🟡 warning | Sheet contract telah berubah menjadi arsip pasif | Checklist/operasional lama menyesatkan |
| F-07 | 🟡 warning | PWA subscribe Postgres Changes tanpa publication | Bubble tidak menerima update realtime |
| F-08 | 🟡 warning | Trigger processed tidak auto-chat “Terima kasih” | Notification chain tidak sesuai dokumentasi |
| F-09 | 🟡 warning | Finance list tidak enforce branch scope | Semua cabang terlihat bagi seluruh role Finance |
| F-10 | 🟡 warning | PWA submit request dan chat bukan transaksi atomik | Orphan request/bubble mungkin terjadi |
| F-11 | 🟡 warning | Driver cache tidak lengkap lintas consumer | Bookmarklet kehilangan data driver dari list response |
| F-12 | 🟡 warning | Reminder 15 menit, pesan masih menyuruh centang sheet | SLA dan instruksi operasional stale |
| F-13 | 🟡 warning | Tidak ada E2E/Playwright saldo | Regresi lintas repo tidak terdeteksi |
| F-14 | 🔵 info | Finance Broadcast dedup dengan Set `id` | Duplicate toast dibatasi per page lifetime |
| F-15 | 🔵 info | Status enum DB lebih luas dari filter UI tertentu | `cancelled` tidak punya filter Finance tersendiri |
---
## A. Data Flow Verification
### A.1 Submit `/isisaldo <nominal>` dari PWA RAOS
Parser berada di `RAOS/apps/pwa/src/lib/saldoRequest.ts:20-40`.
Perilaku parser:
- Regex menerima `/isisaldo`, `/isi saldo`, `/isi_saldo`, dan `/isi-saldo`.; Token nominal dibaca satu token setelah command.; Titik dan koma dihapus.; Suffix `k` dikali 1.000.; Nilai `<= 0`, `NaN`, atau kosong ditolak.
Validasi submit berada di `saldoRequest.ts:104-119`.
- `branchId` wajib.; `driverIdRef`, `driverLoginId`, dan `driverName` wajib.; Nominal harus ada di `branches.saldo_nominal_options` bila daftar tidak kosong.; Tidak ada validasi server-side yang mengikat nominal ke option cabang.
Routing room berada di `saldoRequest.ts:121-138`.
- Query mencari room aktif dengan `branch_id` request.; Nama room harus match “pengisian saldo” atau “isi saldo”.; Bila tidak ditemukan, fallback ke `roomId` aktif.; Fallback dapat menyimpan request dengan `chat_room_id` yang bukan room saldo.
INSERT actual berada di `saldoRequest.ts:140-155`.
Kolom yang dikirim:
- `request_no`; `staff_id`; `branch_id`; `nominal`; `status='pending'`; `chat_room_id`; `driver_id`; `driver_login_id`; `driver_name`
Kolom yang tidak dikirim:
- `client_id`; `requested_at` (default DB); `created_at` (default DB); `approved_by`, `approved_at`; `processed_by`, `processed_at`; `driver_branch_name`
Chat bubble dibuat terpisah di `saldoRequest.ts:161-195`.
- Tipe message: `saldo_request`.; `content` adalah JSON snapshot.; Snapshot memuat `driver_branch_name`.; `chat_messages.client_id` menerima `clientMsgId`.; Setelah message berhasil, request di-PATCH dengan `chat_message_id` secara fire-and-forget.
Atomicity:
- INSERT request dan INSERT chat bukan satu transaction.; Bila chat gagal, function mengembalikan error tetapi request sudah tersimpan.; Bila link `chat_message_id` gagal, request dan bubble ada tetapi tidak terhubung.
Rekomendasi:
- Gunakan satu RPC transactional untuk request + chat bubble.; Tambahkan idempotency key ke request, bukan hanya chat message.; Hilangkan fallback ke arbitrary active room atau validasi room target di RPC.
### A.2 Broadcast Realtime dari DB
Trigger aktual:
- `trg_raos_broadcast_new_saldo_request`; Event: `AFTER INSERT` pada `public.raos_saldo_requests`.; Function: `raos_broadcast_new_saldo_request()`.; Topic: `raos-saldo-new`.; Event: `new`.; Private: `false`.
Payload aktual:
- `id`; `request_no`; `staff_name`; `branch_name`; `branch_id`; `nominal`; `requested_at`
Finance subscribe di `rifim-os/modules/finance/index.html:960-974`.
- Membuat Supabase client dengan publishable key.; Subscribe `sb.channel('raos-saldo-new')`.; Handler `_srNotify(payload)`.; Tidak perlu `raos_saldo_requests` masuk publication untuk Broadcast ini.
Fallback Finance di `modules/finance/index.html:935-982`.
- Poll `finance_saldo_raos_list` status pending.; Interval aktual 60 detik, bukan 30 detik.; Initial poll hanya seed `_srSeenIds`.
Dedup Finance:
- `_srSeenIds` adalah `Set` request ID.; Broadcast dan fallback melewati `_srNotify`.; ID yang sudah dilihat tidak memunculkan toast kedua.; Set tidak dipersist antar reload/tab.
### A.3 Finance `/finance` tab Isi Saldo
Dispatcher ada di `rifim-os/automation/apps-script/crmApi.js:76-77`.
List handler: `_finSaldoRaosList_` di `crmApi.js:873-927`.
Sumber:
- REST service-role ke `public.raos_saldo_requests`.; Maximum 200 row.; Order `created_at.desc`.
Select DB:
- `id`; `staff_id`; `branch_id`; `nominal`; `status`; `is_processed`; `processed_at`; `processed_by`; `created_at`
Filter:
- `pending`: `is_processed=false AND status=pending`; `approved`: `is_processed=false AND status=approved`; `paid`: `is_processed=true`; `rejected`: `status=rejected`; optional `branch_id`; tidak ada filter tanggal; tidak ada default branch scope berdasarkan actor
Enrichment:
- Staff: `id`, `full_name`, `staff_id`.; Branch: `id`, `name`, `slug`.; Tidak mengambil `driver_id`, `driver_login_id`, atau `driver_name`.
Return row:
- `id`; `staff_name`; `staff_code`; `branch_name`; `branch_slug`; `nominal`; `status`; `is_processed`; `processed_at`; `processed_by`; `created_at`
UI ada di `modules/finance/index.html:844-891`.
- Tombol Lunas hanya dirender bila `status==='approved' && !is_processed`.; UI guard ini tidak diulang di backend.
### A.4 Bookmarklet AIST v2
Source: `rifim-os/automation/aist-bookmarklet/aist-fill-v2.source.js`.
Read endpoint di line 81-89:
- GET `finance_saldo_raos_list`.; Parameter `user` berasal dari `localStorage.rifim_auth.email`.; Default filter dalam dokumentasi adalah `approved`.; Refresh aktual setiap 30 detik di line 211-216.
Render mengharapkan:
- `driver_name`; `driver_login`; fallback `driver_id`
Namun Finance list tidak mengembalikan ketiganya.
Akibat:
- Search driver dan field Login dapat menjadi kosong.; Picker dapat menampilkan `?` untuk driver.; `fillAistModal()` dapat menulis empty string ke Driver login.
Klik row di line 133-157:
1. Cari input Amount dan Driver login.
2. Isi kedua input.
3. Tampilkan toast agar operator menekan OK.
4. Langsung fire-and-forget `finance_saldo_raos_mark_paid`.
Mark paid terjadi sebelum:
- tombol OK ditekan,; response AIST diterima,; transaksi AIST terbukti berhasil.
Ini adalah F-03 dan membuat state DB mendahului source eksternal.
### A.5 Mark paid endpoint
Handler ada di `crmApi.js:929-940`.
Body PATCH aktual:
- `is_processed=true`; `processed_at=now ISO`; `processed_by=params.user`
Masalah schema:
- Actual `processed_by` bertipe UUID.; `params.user` adalah email string.; PostgREST semestinya menolak input dengan invalid UUID syntax.
Masalah precondition:
- Filter hanya `id=eq.<id>`.; Tidak ada `is_processed=eq.false`.; Tidak ada `status=eq.approved`.; Tidak ada check returned row count.
### A.6 Trigger processed aktual
Trigger aktual:
- `trg_raos_saldo_after_processed`; `BEFORE UPDATE OF is_processed`; Guard `OLD.is_processed=false AND NEW.is_processed=true`.
Efek aktual:
1. Push “Saldo Anda Sudah Diisi” ke staff.
2. Tidak post ke Driver room.
3. Hitung snapshot progress KPI.
4. Buat/ambil chat pribadi staff.
5. Post progress KPI ke chat pribadi.
6. Push progress KPI ke staff.
Komentar function aktual eksplisit menyatakan auto-post Driver room dihapus.
Dengan demikian klaim “auto-chat Terima kasih” tidak benar untuk DB aktual.
### A.7 Sheet `Form Isi Saldo`
Header aktual diverifikasi 2026-08-06:
1. No Request
2. Tanggal
3. Nama Staff
4. Cabang
5. Nominal
6. ID Login Driver
7. Nama Driver
8. Status Validasi
9. Sudah Diisi
10. Waktu Diisi
11. Diisi Oleh
12. Alasan Tolak
13. Alert Terkirim
14. Alert Terakhir
15. Request ID
Header cocok dengan `RAOS/gas/16_saldo_sync.gs:26-53`.
Namun trigger setup aktual di `RAOS/gas/09_trigger.gs:72-80` menyatakan:
- `syncSaldoRequestsToSheet` deprecated dan trigger dihapus.; Sheet menjadi arsip pasif.; Reminder berjalan setiap 15 menit.
`onEdit` aktual di `09_trigger.gs:162-178` tidak memanggil checkbox handler.
Jadi alur sheet aktual:
- Tidak cron sync 5-menit.; Manual menu sync masih tersedia.; Checkbox “Sudah Diisi” bukan jalur operasional.; Sheet tidak write-back otomatis ke Supabase.
Kolom manual secara historis:
- F `ID Login Driver`; G `Nama Driver`; I `Sudah Diisi`; M `Alert Terkirim`
Tetapi F/G sekarang stale karena DB request sudah menyimpan driver data.
### A.8 Playwright
Hasil inventarisasi:
- `RAOS/apps/pwa/playwright/` tidak ada.; Tidak ada file `*.spec.*` atau `*.test.*` saldo pada RAOS PWA.; `rifim-os/apps/pwa/playwright/` tidak ada.; Test E2E yang ditemukan di rifim-os hanya Document Engine GAS.
Tidak ada coverage submit → approve → processed.
---
## B. Schema Drift Check
### B.1 Actual columns `raos_saldo_requests`
Actual 23 kolom:
- `id uuid not null default gen_random_uuid()`; `request_no text not null`; `staff_id uuid not null`; `branch_id uuid not null`; `nominal numeric not null`; `status text not null default 'pending'`; `requested_at timestamptz not null default now()`; `approved_by uuid null`; `approved_at timestamptz null`; `rejection_reason text null`; `chat_room_id uuid null`; `chat_message_id uuid null`; `note text null`; `synced_to_sheet_at timestamptz null`; `created_at timestamptz not null default now()`; `updated_at timestamptz not null default now()`; `is_processed boolean not null default false`; `processed_at timestamptz null`; `processed_by uuid null`; `auto_chat_posted boolean not null default false`; `driver_id uuid null`; `driver_login_id text null`; `driver_name text null`
### B.2 Constraint aktual
- PK `id`.; UNIQUE `request_no`.; `nominal > 0`.; Status CHECK: `pending`, `approved`, `rejected`, `cancelled`.; FK staff, branch, approver, processor, room, message, dan driver.; Tidak ada UNIQUE `client_id`.; Tidak ada kolom `client_id`.
### B.3 Consumer comparison
PWA insert menggunakan kolom valid, tetapi:
- Tidak memiliki request idempotency key.; `driver_branch_name` hanya berada di JSON bubble.; Cache nama driver di DB memang dipakai PWA riwayat/card.
Finance list:
- Menggunakan kolom valid.; Tidak select tiga kolom driver yang diperlukan Bookmarklet.
Bookmarklet:
- Mengharapkan `driver_login`/`driver_id`, bukan actual `driver_login_id`.; Kontrak response tidak compatible.
GAS sync:
- Tidak select driver cache.; Menulis F/G kosong agar admin mengisi manual.; Ini bertentangan dengan PWA yang mewajibkan driver sebelum submit.
### B.4 Dead/stale reference indicator
`driver_name` masih aktif dipakai:
- PWA SaldoRequestCard.; PWA Riwayat.; Chat content snapshot.
`driver_branch_name`:
- Bukan kolom DB.; Hanya snapshot JSON chat.; Dipakai komponen card untuk display.
`driver_login_id`:
- Kolom DB aktual.; Dipakai PWA card.; Tidak diteruskan Finance list.
`auto_chat_posted`:
- Masih ada di schema.; Trigger processed aktual tidak mengubahnya.; Kandidat dead column setelah auto-chat Driver room dihapus.
`synced_to_sheet_at`:
- Masih dipakai manual sync.; Karena cron dihapus, row baru dapat terus null.; Bukan indikator kegagalan pipeline operasional lagi.
### B.5 Enum status
DB canonical:
- `pending`; `approved`; `rejected`; `cancelled`
Finance chip memahami pending/approved/rejected dan paid via `is_processed`.
Finance filter tidak menyediakan `cancelled`.
Paid bukan enum DB; paid adalah `is_processed=true`.
Beberapa tipe lama RAOS masih memakai `valid` untuk scan, bukan saldo.
Rekomendasi:
- Dokumentasikan lifecycle dua dimensi: validation status + payment flag.; Jangan menambah enum `paid`; gunakan derived state tunggal di shared contract.
---
## C. Race Condition dan Idempotency
### C.1 Offline replay request
Claim migration 036 tentang `client_id` tidak cocok dengan DB aktual.
Yang memiliki `client_id` adalah `chat_messages`, bukan saldo request.
PWA `saldoRequest.ts:184` mengirim `clientMsgId` ke chat message.
PWA `saldoRequest.ts:143-153` tidak mengirim key tersebut ke request.
Risiko:
- Retry submit dapat membuat dua `request_no` berbeda.; Random suffix request number tidak deduplicate business action.; Chat dedup tidak mencegah request duplikat.
Rekomendasi:
- Tambah `client_id uuid not null` + unique index pada saldo request.; RPC submit gunakan `ON CONFLICT(client_id)` dan return row existing.; Satu client ID harus mengikat request dan chat message.
### C.2 Bookmarklet double-mark
Tidak ada guard client-side terhadap click ganda sebelum response.
Tidak ada disable row/loading state.
Endpoint tidak filter `is_processed=false`.
Trigger side effect terlindungi oleh transition guard, sehingga push tidak double.
Namun `processed_at` dan `processed_by` dapat ditulis ulang pada PATCH kedua.
Audit log juga dapat merekam mark paid berulang.
Rekomendasi:
- Backend conditional update: `id`, `status=approved`, `is_processed=false`.; Response harus membedakan `updated`, `already_processed`, dan `not_approved`.; UI disable row sampai AIST sukses dan mark-paid response sukses.
### C.3 Finance realtime dedup
Ada dedup by `id` pada `_srSeenIds`.
List render mengganti seluruh `tbody`, sehingga tidak append duplicate row.
Tidak ada duplicate render race yang nyata pada path ini.
Keterbatasan:
- Reload mengosongkan Set.; Set tumbuh tanpa pruning selama page hidup.; Poll hanya status pending, jadi tidak memperbaiki missed approved/paid toast.
### C.4 Submit/chat race
Request dibuat sebelum chat.
Koordinator dapat menerima push submitted dari trigger sebelum bubble chat selesai.
Koordinator bisa approve request yang belum punya `chat_message_id`.
Update bubble status kemudian tidak terjadi bila message ID undefined.
Rekomendasi: pindahkan create request, bubble, dan link ke satu RPC transaction.
---
## D. Auth dan RLS Scope
### D.1 Staff insert
Policy aktual `raos_saldo_requests_staff_insert`:
- Command INSERT.; Role `authenticated`.; WITH CHECK hanya `staff_id = auth.uid()`.
Tidak enforce:
- branch match user.; branch berada dalam scope.; driver berada pada branch yang benar.; nominal ada pada option cabang.
Design repo menyebut admin/direksi boleh submit lintas cabang.
Namun policy sekarang juga memungkinkan staff biasa memilih branch lain bila dapat UUID.
Severity: 🟡 warning.
Rekomendasi:
- WITH CHECK gabungkan ownership dan role-aware branch rule.; Staff/koord wajib `is_branch_in_scope(branch_id)`.; Admin/management/direksi boleh lintas branch secara eksplisit.
### D.2 Koordinator select/update
Policy SELECT:
- Role koordinator/admin/management/direksi.; `is_branch_in_scope(branch_id)`.
Policy UPDATE:
- USING sama.; Tidak memiliki WITH CHECK.; Tidak membatasi kolom yang boleh diubah.
Konsekuensi:
- Caller yang lolos dapat mengubah field lain pada row scoped.; Koordinator PWA secara kode hanya update approval fields, tetapi DB tidak enforce column-level intent.
Rekomendasi:
- Gunakan RPC approve/reject dengan transition guard.; Revoke direct UPDATE atau tambah trigger column-change guard.; Tambah WITH CHECK branch scope.
### D.3 Finance/GAS admin path
`_crmSbFetch_` memakai service-role dan bypass RLS.
Role gate di `crmApi.js:646-655` hanya menerima `params.user` email.
`authVerifyUser` di `authEngine.js:33-73`:
- Cek email ada di whitelist.; Lookup profil berdasarkan email.; Tidak memverifikasi password, JWT, session, signature, atau caller identity.; Bila Supabase gagal dan email ada config, fallback sebagai ADMIN.
Karena endpoint Web App dipanggil melalui GET dengan `user=<email>`:
- Pengetahuan email whitelist cukup untuk bertindak sebagai role tersebut.; Bookmarklet menyimpan email di localStorage, bukan access token.; Service-role memperbesar dampak menjadi bypass RLS penuh.
Severity: 🔴 blocker F-01.
Rekomendasi:
- Wajib Bearer Supabase access token atau signed short-lived session.; Verify token server-side dan derive user/role dari token.; Jangan percaya email request.; Hapus fallback ADMIN untuk action finansial.; Pisahkan endpoint read dan write dengan POST untuk mutation.
### D.4 Cross-branch Finance
Finance role gate mencakup admin/management/direksi/direktur.
Tidak mencakup koordinator.
Semua role yang lolos menerima semua branch kecuali UI mengirim `branch_id`.
Ini konsisten untuk pusat, tetapi bukan general branch-scoped contract.
Jika koordinator nanti ditambahkan ke Finance role gate tanpa server branch binding, BR-01 akan bocor.
Rekomendasi:
- Derive branch scope server-side.; Abaikan branch ID client yang lebih luas dari actor scope.
---
## E. Notification Chain
### E.1 Submit pending
Trigger actual `raos_saldo_after_submitted`:
- Target koordinator branch request.; Target admin/management/direksi global.; Exclude submitter.; Push title “Pengajuan Isi Saldo Baru”.; URL `/validasi-saldo`.; Category `validasi_koordinator`.
### E.2 Pending → approved
Approval dilakukan client di `saldoRequest.ts:221-251`.
Efek:
- Conditional update hanya bila status pending.; Post system message ke room saldo.; Push langsung ke staff.; Category push `pengumuman`.
Tidak ada trigger DB khusus status approved.
Jika client crash setelah DB update, chat/push approval dapat hilang.
Rekomendasi: pindahkan efek approval ke DB trigger/outbox/RPC transactional.
### E.3 Pending → rejected
Reject di `saldoRequest.ts:254-284`.
Efek:
- Conditional update status pending.; Simpan rejection reason.; Post message room saldo.; Push staff kategori `pengumuman`.
Risiko atomicity sama dengan approval.
### E.4 Processed
Trigger processed memberi dua push potensial:
- Push processed.; Push progress KPI bila target tersedia.
Trigger post progress ke chat pribadi.
Trigger tidak post “Terima kasih” ke Driver room.
PWA helper `markSaldoRequestProcessed` masih post message ke saldo room.
Finance GAS proxy tidak post message saldo room.
Jadi notification chain berbeda menurut caller:
- PWA helper: DB trigger + saldo-room message.; Finance/Bookmarklet: DB trigger saja.
Severity: 🟡 warning F-08.
### E.5 Reminder belum diproses
Function `reminderSaldoBelumDiisi` di `gas/16_saldo_sync.gs:232-354`.
Query:
- `is_processed=false`; status bukan rejected/cancelled; tidak membatasi status pending saja; approved juga diingatkan.
Threshold logic tetap 5 menit.
Scheduler aktual membuat trigger setiap 15 menit.
Room resolution:
1. Room saldo branch.
2. Room saldo parent branch.
3. Room saldo global.
Pesan masih mengatakan:
- isi AIST,; lalu centang “Sudah Diisi” di sheet.
Instruksi itu stale karena onEdit hook dihapus.
Dedup reminder:
- Function menandai alert di Sheet bila row ditemukan.; Query DB tidak filter flag reminder.; Logic tidak memeriksa `Alert Terkirim` sebelum mengirim.; Karena sync sheet deprecated, mapping request ke row sering tidak ada.; Reminder berpotensi dikirim ulang setiap 15 menit sampai processed.
Rekomendasi:
- Simpan `reminded_at`/outbox di DB dengan atomic conditional update.; Perbarui pesan agar mengarah ke Finance/Bookmarklet aktif.; Putuskan SLA: 5 atau 15 menit dan dokumentasikan konsisten.
---
## F. Test Coverage Gap
### F.1 Existing test list
RAOS:
- Tidak ada directory `apps/pwa/playwright/`.; Tidak ada saldo `spec`/`test` yang ditemukan.
rifim-os:
- Tidak ada directory `apps/pwa/playwright/`.; `automation/apps-script/testDocEngineE2E.js` hanya Document Engine.; Tidak ada test Bookmarklet AIST.; Tidak ada contract test `crmApi.js` saldo.
### F.2 Coverage flow
Tidak covered:
- command parse valid/invalid.; submit request.; RLS staff insert.; branch leakage negative test.; approval branch scope.; reject branch scope.; Finance list response contract.; Finance auth impersonation negative test.; mark paid UUID processor.; mark paid transition guard.; processed trigger push.; KPI private chat.; Broadcast notification.; fallback poll dedup.; Sheet manual archive sync.; reminder dedup.; AIST success/failure handshake.
### F.3 Missing test cases yang direkomendasikan
1. Parser accepts `45k`, `45.000`, `45,000` sesuai contract.
2. Parser rejects zero, negative, missing amount, dan trailing invalid token.
3. Staff submit branch sendiri berhasil.
4. Staff submit branch lain ditolak DB.
5. Duplicate `client_id` mengembalikan request existing.
6. Submit request + chat rollback bila salah satu gagal.
7. Koordinator branch A tidak dapat select branch B.
8. Koordinator branch A tidak dapat approve branch B.
9. Koordinator tidak dapat mengubah `staff_id`, `branch_id`, atau nominal.
10. Approval hanya transition pending → approved sekali.
11. Rejection hanya transition pending → rejected sekali.
12. Process hanya status approved dan false → true.
13. Process kedua return `already_processed` tanpa rewrite metadata.
14. Finance endpoint tanpa token return 401.
15. Finance endpoint dengan email forged return 401.
16. Finance list response memuat `driver_login_id` dan `driver_name`.
17. Bookmarklet tidak mark paid hanya karena field terisi.
18. Bookmarklet mark paid setelah AIST success acknowledgement.
19. AIST reject/cancel meninggalkan request approved, belum processed.
20. AIST timeout menampilkan retry state, bukan silent ignore.
21. Broadcast duplicate dan poll duplicate hanya satu toast.
22. Postgres Changes card update bekerja setelah table dipublish.
23. Trigger processed menghasilkan tepat satu push processed.
24. Trigger processed menghasilkan KPI chat hanya bila snapshot valid.
25. Reminder pertama atomically set `reminded_at`.
26. Reminder scheduler tidak mengirim ulang sebelum cooldown.
27. Manual Sheet sync mengisi driver cache dari DB.
28. Sheet edit tidak dianggap authoritative.
29. `cancelled` tampil konsisten pada Finance.
30. End-to-end submit → approve → AIST success → processed → notification.
### F.4 Bookmarklet isolated harness
Butuh fixture DOM minimal untuk:
- input label Amount.; input label Driver login.; React-compatible setter/event.; missing field error.; double click.; simulated AIST success/cancel.; GAS 401/409/500.; close interval cleanup.
---
## G. Cross-Repo Consistency
### G.1 Signature Finance endpoint
`finance_saldo_raos_list` menerima:
- `user` email.; `status` optional.; `branch_id` optional.
Bookmarklet mengirim user + status.
Finance UI mengirim status; `_gasCall` otomatis menambah user.
Signature transport compatible, tetapi response data Bookmarklet tidak compatible.
### G.2 Mark paid signature
`finance_saldo_raos_mark_paid` menerima:
- `user` email.; `id` request UUID.
Finance dan Bookmarklet sama-sama mengirim signature itu.
Schema tidak compatible karena handler memakai email sebagai `processed_by uuid`.
### G.3 Sheet mapping
Header actual cocok dengan GAS 15 kolom.
Mapping tidak cocok dengan source request modern:
- F/G dikosongkan walau DB punya driver data.; Sheet status tidak refresh setelah initial sync.; Sheet processed tidak refresh setelah initial sync.; `synced_to_sheet_at` menjadikan sync append-only, bukan reconciliation.
Dengan cron dihapus, Sheet bukan mirror aktual DB.
### G.4 Dua sisi GAS
RAOS GAS `gas/16_saldo_sync.gs`:
- Mirror manual/arsip dari Supabase.; Reminder chat.; Legacy checkbox handler disabled.
RIFIM OS GAS:
- `crmApi.js` adalah proxy live Supabase untuk Finance/Bookmarklet.; `saldoEngine.js` dan `staffAppApi.js` masih punya pipeline sheet lama terpisah.; `raosMonitoringEngine.js` membaca `Form Input Saldo AIST/PWA`, bukan `raos_saldo_requests`.
Semantik tidak sama.
Ada minimal tiga pipeline bernama saldo:
1. RAOS Supabase saldo request.
2. RIFIM OS Sheet `Form Input Saldo PWA/AIST` legacy.
3. Sheet RAOS `Form Isi Saldo` archive/manual sync.
Rekomendasi:
- Tetapkan satu diagram canonical dan label “legacy/archive” di code/docs/UI.; Jangan menyebut semua function saldo sebagai implementasi yang sama.; Finance live harus hanya memakai Supabase request contract.
### G.5 Realtime consistency
Finance memakai Realtime Broadcast dan berfungsi independen dari publication.
PWA `SaldoRequestCard.tsx:58-81` memakai Postgres Changes.
Actual `pg_publication_tables` tidak memuat `raos_saldo_requests`.
Akibat:
- Finance mendapat new-request broadcast.; PWA card tidak dijamin mendapat update status/processed realtime.; Card initial fetch masih dapat memperbaiki state saat mount/reload.
Rekomendasi: publish table atau ganti PWA ke Broadcast terotorisasi yang konsisten.
---
## H. Finding dan Rekomendasi Prioritas
| ID | Severity | File:line / bukti | Rekomendasi fix |
|---|---|---|---|
| F-01 | 🔴 blocker | `crmApi.js:646-655`; `authEngine.js:33-73`; bookmarklet `:23-25,81-89` | Verify JWT server-side; derive UUID/role dari token; reject email-only mutation dan fallback ADMIN. |
| F-02 | 🔴 blocker | DB `processed_by uuid`; `crmApi.js:933-938` mengirim email | Resolve verified actor ke `user_profiles.id`; fail closed bila UUID tidak ada. |
| F-03 | 🔴 blocker | `aist-fill-v2.source.js:133-156` | Mark paid hanya setelah acknowledgement AIST; jangan fire-and-forget. |
| F-04 | 🔴 blocker | `crmApi.js:929-940` | RPC row-lock dengan guard `status=approved AND is_processed=false`; typed outcome. |
| F-05 | 🔴 blocker | DB tanpa `client_id`; `saldoRequest.ts:140-185` | Unique request client ID dan transactional submit RPC dengan conflict handling. |
| F-06 | 🟡 warning | `gas/09_trigger.gs:72-80,162-178`; `gas/16_saldo_sync.gs:153-170` | Label Sheet archive/manual atau restore mirror read-only; jangan restore write-back lama. |
| F-07 | 🟡 warning | Actual publication kosong; `SaldoRequestCard.tsx:58-81` | Publish table dengan review RLS atau ganti subscription ke Broadcast terotorisasi. |
| F-08 | 🟡 warning | Trigger aktual hapus Driver auto-post; `saldoRequest.ts:287-299` stale | Pilih behavior canonical dan sinkronkan DB/comment/UX. |
| F-09 | 🟡 warning | `crmApi.js:873-884` | Derive allowed branches dari actor verified pada list dan mark paid. |
| F-10 | 🟡 warning | `saldoRequest.ts:140-195` | Satukan request, message, dan link dalam transaction RPC. |
| F-11 | 🟡 warning | Bookmarklet `:93-119,143-149`; Finance `crmApi.js:909-925` | Return `driver_id`, `driver_login_id`, `driver_name`; contract test. |
| F-12 | 🟡 warning | `gas/09_trigger.gs:77-80`; `gas/16_saldo_sync.gs:228-354` | Atomic `reminded_at`, cooldown, dan update copy ke Finance aktif. |
| F-13 | 🟡 warning | Tidak ada Playwright saldo pada kedua repo | Implement test section F; gate minimal auth, transition, idempotency, happy path. |
| F-14 | 🔵 info | `modules/finance/index.html:899-947` | Dedup saat ini cukup untuk satu page session; opsional prune/persist Set. |
| F-15 | 🔵 info | DB memuat `cancelled`; Finance tidak punya filter | Tampilkan cancelled eksplisit atau dokumentasikan grouping dengan rejected. |
---
## Urutan Remediasi yang Disarankan
P0 sebelum mengandalkan pipeline produksi:
1. Ganti email-only gate dengan verified token.
2. Perbaiki UUID `processed_by`.
3. Buat conditional/idempotent mark-paid RPC.
4. Hentikan premature mark paid Bookmarklet.
5. Tambah idempotency saldo request.
P1 untuk konsistensi operasional:
1. Perbaiki response driver Finance.
2. Putuskan notification/chat processed canonical.
3. Publish table untuk PWA realtime atau migrasikan subscription.
4. Perbaiki reminder dedup dan copy.
5. Dokumentasikan Sheet sebagai archive/manual.
P2 untuk quality gate:
1. Tambah contract tests GAS proxy.
2. Tambah Playwright happy path dan negative branch/auth tests.
3. Tambah Bookmarklet isolated harness.
4. Tambah drift check schema-to-consumer pada CI.
## Keputusan Audit
Pipeline **belum layak dinyatakan sinkron 100%**.
Happy path konseptual tersedia, tetapi jalur mark paid saat ini memiliki kegagalan tipe UUID,
authentication trust boundary yang lemah, dan ordering yang dapat menyatakan lunas sebelum AIST sukses.
Sheet SSoT yang disebut dalam checklist bukan lagi SSoT operasional untuk saldo request; actual SSoT adalah
`public.raos_saldo_requests`, sedangkan Sheet hanya archive/manual mirror yang saat ini tidak terjadwal.
Tidak ada fix diimplementasikan dalam audit ini.

## Remediation Log — 2026-08-07

- [x] **F-01** — saldo Finance tidak lagi mempercayai parameter email. Client mengirim access token melalui body POST; GAS memvalidasi token ke Supabase Auth, lalu mengambil UUID dan role dari `user_profiles`. Fallback ADMIN di `authVerifyUser()` dihapus dan auth gagal secara tertutup.
- [x] **F-02** — `processed_by` berasal dari UUID profil actor yang diturunkan dari token, bukan email.
- [x] **F-03** — Bookmarklet mengunci row dan menunggu acknowledgement sukses AIST. Error/cancel/timeout 30 detik mempertahankan row `approved` serta menampilkan retry state.
- [x] **F-04** — migration prod `raos_074_saldo_mark_paid_rpc.sql` aktif. GAS memakai `POST /rest/v1/rpc/raos_saldo_mark_paid`; outcome `updated`, `already_processed`, `not_approved`, dan `not_found` ditangani eksplisit.
- [x] **F-05** — migration prod `raos_075_saldo_client_id_idempotency.sql` aktif. PWA memakai UUID client yang sama untuk submit/retry offline dan memanggil RPC transactional `raos_saldo_submit`.
- [x] **F-10 (ikut terselesaikan)** — pembuatan request, bubble chat, dan link `chat_message_id` kini berada dalam satu transaksi RPC.
- [x] **F-11 (kontrak response)** — Finance list meneruskan `driver_id`, `driver_login_id`, dan `driver_name` untuk Bookmarklet.

Evidence implementasi rifim-os: commit `3903d67`. Evidence migration/client RAOS: commits `d5a8e59` dan `2bc9f38`. Validasi lokal: syntax GAS/Bookmarklet, inline script Finance/Portal, RAOS typecheck, lint (0 error), dan production build lulus. Eksekusi GAS deployed dan happy-path AIST manual dicatat terpisah setelah redeploy aktif.
