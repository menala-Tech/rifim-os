# CX Session — Fonnte Deprecation + Chat Migration Full (Sesi 3)

**Source roadmap:** `rifim-os/docs/STATUS.md` sesi 2026-08-06 malam
**Prompt untuk:** Codex Desktop (CX)
**Priority:** P1 — Fonnte cost ~Rp 500rb-1jt/bulan, deprecate akhir Agustus 2026
**Estimasi:** 5-7 jam (all-in-one)
**Dependency:** CC sudah apply migration `raos_073_chat_system_message_rpc.sql` sebelum CX mulai

---

## Copy-paste prompt CX

````
Halo CX, sesi Sesi 3 chat migration full (Fonnte deprecation 100%).

KONTEKS: PR #10 audit approved 5 keputusan (rifim-os/docs/STATUS.md sesi 2026-08-06 malam):
- Decision #4: 🔥 TOTAL deprecate Fonnte, migrate ke chat room PWA RAOS
- Cost saving: ~Rp 500rb-1jt/bulan
- Postmortem: cancel kontrak Fonnte akhir Agustus 2026

CC sudah prep:
- Migration raos_073_chat_system_message_rpc.sql (apply setelah kamu confirm)
- 4 RPC baru: raos_post_system_message, raos_resolve_saldo_room,
  raos_resolve_driver_room, raos_resolve_announcement_room, raos_resolve_private_room
- type 'system' ditambah ke chat_messages.type CHECK constraint

═══════════════════════════════════════════════════════════
SCOPE — MIGRASI 12 CALL SITE FONNTE (ALL-IN-ONE)
═══════════════════════════════════════════════════════════

TARGET: Hapus 100% panggilan waSend* dari kedua file berikut,
redirect ke chat_messages via RPC raos_post_system_message.

FILE 1: automation/apps-script/notificationEngine.js
─────────────────────────────────────────────────────────
Ganti 8 panggilan berikut:

| Line | Function | Target chat room |
|------|----------|-------------------|
| 59   | notifDocumentCreated | raos_resolve_announcement_room() |
| 107  | notifCheckExpiringContracts | raos_resolve_announcement_room() |
| 149  | notifLeaveStatusChanged | raos_resolve_announcement_room() |
| 180  | notifPayslipReady (individu) | raos_resolve_private_room(user_id) FALLBACK announcement |
| 219  | notifPayrollSiapDiproses | raos_resolve_announcement_room() |
| 266  | notifRekapFinanceHarian | raos_resolve_announcement_room() |
| 281  | notifRekapFinanceBulanan | raos_resolve_announcement_room() |
| 295+302 | notifSaldoDriverRendah | raos_resolve_saldo_room(branch_id) |

FILE 2: automation/apps-script/raosMonitoringEngine.js
─────────────────────────────────────────────────────────
Ganti 5+ panggilan berikut (SLA cron):

| Line | Function | Target chat room |
|------|----------|-------------------|
| 374+377 | cekSLASaldo (per cabang) | raos_resolve_saldo_room(branch_id_cabang) |
| 558+572 | cekSLAPotongan (per cabang) | raos_resolve_saldo_room(branch_id_cabang) |
| 698+700 | cekSLASaldoPWA (per cabang) | raos_resolve_saldo_room(branch_id_cabang) |
| 744+754 | testMonitoringSaldoWA + testMonitoringPotonganWA | (hapus atau ganti resolve → sysMessage) |

FILE 3: automation/apps-script/raosLaporanEngine.js:443
─────────────────────────────────────────────────────────
| Line | Function | Target chat room |
|------|----------|-------------------|
| 443  | (laporan) | raos_resolve_announcement_room() |

FILE 4: automation/apps-script/waEngine.js (HAPUS 309 baris)
─────────────────────────────────────────────────────────
Setelah 3 file di atas migrated, HAPUS waEngine.js sepenuhnya.
Semua fungsi `waSend*` + `_fonntePost_` + helper WA sudah tidak dipakai.

FILE 5: automation/apps-script/configLoader.js:111
─────────────────────────────────────────────────────────
Hapus komentar setup FONNTE_TOKEN + WA_GROUP_ID (line 111-118).
JANGAN hapus Properties value dari Script Properties di GAS Editor
— biarkan user hapus manual di GAS Editor UI setelah verify migrated OK.

═══════════════════════════════════════════════════════════
PATTERN GANTI (contoh template)
═══════════════════════════════════════════════════════════

SEBELUM:
```js
try {
  waSendToGroup(waBuildPesanKontrakHampirBerakhir({
    namaKaryawan: emp.full_name,
    idKaryawan: emp.employee_id,
    tanggalBerakhir: c.end_date,
    sisaHari: daysLeft,
  }));
} catch (errWa) {
  Logger.log('notifCheckExpiringContracts WA gagal (non-fatal): ' + errWa.message);
}
```

SESUDAH:
```js
try {
  var roomId = _supaRpc('raos_resolve_announcement_room', {});
  if (roomId) {
    _supaRpc('raos_post_system_message', {
      p_room_id: roomId,
      p_content: _buildKontrakHampirBerakhirMessage({
        namaKaryawan: emp.full_name,
        idKaryawan: emp.employee_id,
        tanggalBerakhir: c.end_date,
        sisaHari: daysLeft,
      }),
      p_category: 'hris_kontrak',
      p_metadata: {
        employee_id: emp.employee_id,
        end_date: c.end_date,
        days_left: daysLeft
      }
    });
  }
} catch (errChat) {
  _gasLogError('HRIS', 'notifCheckExpiringContracts_chat', errChat);
}
```

Buat helper `_supaRpc(name, params)` di gasUtils.js (kalau belum ada):
```js
function _supaRpc(name, params) {
  var url = SUPABASE_URL + '/rest/v1/rpc/' + name;
  var opts = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY
    },
    payload: JSON.stringify(params || {}),
    muteHttpExceptions: true
  };
  var resp = UrlFetchApp.fetch(url, opts);
  if (resp.getResponseCode() >= 400) {
    throw new Error('RPC ' + name + ' failed: ' + resp.getContentText());
  }
  var body = resp.getContentText();
  return body ? JSON.parse(body) : null;
}
```

Buat helper builder function `_build*Message()` untuk tiap use case
(port dari waBuildPesan* di waEngine.js, ubah format ke plaintext chat-friendly).

═══════════════════════════════════════════════════════════
BRANCH_ID MAPPING (kritikal — jangan salah)
═══════════════════════════════════════════════════════════

raosMonitoringEngine.js:70-87 saat ini pakai key STRING cabang
('ID Rifim Airport Batam', dst). Untuk RPC raos_resolve_saldo_room,
butuh branch_id UUID. Mapping via RPC baru raos_resolve_branch_by_slug()
atau lookup langsung:

```js
var BRANCH_ID_BY_NAME = {
  'ID Rifim Airport Batam':      '029723bc-f500-464f-bbc6-f65a8160cc7b',
  'ID Rifim Airport Makassar':   '0a82c6dc-d072-4eec-bf4a-57a5b1625b80',
  'ID Rifim Jambi Luar':         '1a63f6e5-dffc-4dc5-a346-0e192dd086ce',
  'ID Rifim Airport Soekarno-Hatta': '53c52493-83c1-4e41-9702-bcbbc9f8b836',
  'ID Rifim Airport Pekanbaru':  '5446da8d-f5c5-487c-8d0d-c2b44af6c9bb',
  'ID Rifim Airport Jambi':      '99f16688-b172-42f9-815f-64a7cb3ea2ec',
  'ID Rifim Batam':              'cafa964d-45a2-480b-9a0a-1a15666a0e6b',
  'ID Rifim Airport Manado':     'd983f58b-9deb-411e-8876-2d1cc8a8c341',
  'ID Rifim Airport Balikpapan': 'ee4dca51-5348-4f64-96c6-e91641d3eb1a',
};
```
(UUID di atas snapshot 2026-08-07 dari CC verify actual DB.)

═══════════════════════════════════════════════════════════
DRIVER EKSTERNAL — POSTPONE ke sub-sesi 3B
═══════════════════════════════════════════════════════════

Scope onboarding driver eksternal (Batam + Jambi Luar) belum jelas.
CC riset dulu di sesi berikutnya. Untuk sekarang:
- Chat room "Driver — Rifim Batam" dan "Driver — Rifim Jambi Luar"
  sudah ada (verified DB 2026-08-07)
- raos_drivers sudah punya kolom source='ssot_driver_external'
  via gas/17_driver_external_sync.gs
- Membership chat room per driver eksternal → sub-sesi 3B nanti

═══════════════════════════════════════════════════════════
UI PWA — Render 'system' message type
═══════════════════════════════════════════════════════════

RAOS/apps/pwa/src/components/chat/MessageItem.tsx (atau equivalent)
perlu handle type='system':
- Avatar: 🤖 fallback (bukan user avatar)
- Sender name: "Sistem RAOS"
- Bubble style: distinct (mis. bg abu-abu, border kiri warning kuning)
- Parse metadata dari HTML comment `<!--SYSMETA:...-->` di awal content
  → strip dari display, extract untuk enrichment (badge kategori, deep link)

═══════════════════════════════════════════════════════════
URUTAN EKSEKUSI
═══════════════════════════════════════════════════════════

1. TUNGGU CC apply raos_073 migration (konfirmasi via ping).
2. Buat helper _supaRpc + _build*Message di gasUtils.js atau file baru chatBridge.js
3. Refactor notificationEngine.js — ganti 8 waSend → _supaRpc
4. Refactor raosMonitoringEngine.js — ganti 5+ waSend → _supaRpc
5. Refactor raosLaporanEngine.js:443 → _supaRpc
6. Hapus waEngine.js (309 baris)
7. Cleanup configLoader.js komentar FONNTE
8. RAOS PWA — component MessageItem tambah render type='system' + parse metadata
9. clasp push (rifim-os project) — cek GAS_PROJECTS_MAP.md
10. Manual redeploy GAS Web App di UI GAS Editor
11. Test 9 cabang: pancing SLA cron → verify pesan muncul di chat room saldo cabang
12. Update docs/STATUS.md + append fonnte deprecation success

═══════════════════════════════════════════════════════════
TESTING CHECKLIST (9 cabang wajib)
═══════════════════════════════════════════════════════════

Manual test setelah deploy:
- [ ] notifDocumentCreated → room "Pengumuman" muncul pesan ✅
- [ ] notifCheckExpiringContracts (jalankan manual di GAS Editor) → "Pengumuman"
- [ ] notifLeaveStatusChanged (DISETUJUI trigger) → "Pengumuman"
- [ ] notifPayslipReady → chat pribadi user OR fallback "Pengumuman"
- [ ] notifPayrollSiapDiproses (jalankan manual) → "Pengumuman"
- [ ] notifRekapFinanceHarian → "Pengumuman"
- [ ] cekSLASaldo Batam → "Pengisian Saldo — Bandara Batam"
- [ ] cekSLASaldo Jambi → "Pengisian Saldo — Bandara Jambi"
- [ ] cekSLASaldo Balikpapan → "Pengisian Saldo — Bandara Balikpapan"
- [ ] cekSLASaldo Manado → "Pengisian Saldo — Bandara Manado"
- [ ] cekSLASaldo Pekanbaru → "Pengisian Saldo — Bandara Pekanbaru"
- [ ] cekSLASaldo Batam non-airport → "Pengisian Saldo — Rifim Batam (non-airport)"
- [ ] cekSLASaldo Jambi Luar → "Pengisian Saldo — Rifim Jambi Luar"
- [ ] cekSLAPotongan (5 cabang airport) → route sama dgn cekSLASaldo
- [ ] cekSLASaldoPWA (7 cabang saldo) → route sama
- [ ] type='system' render benar di UI PWA (bubble abu-abu, avatar 🤖)
- [ ] Push notification masih fire ke room member sesuai raos_notify_new_chat_message

═══════════════════════════════════════════════════════════
DELIVERABLES
═══════════════════════════════════════════════════════════

• 2 PR: 
  - rifim-os: "feat(chat): deprecate Fonnte 100%, redirect 12 notif → chat room RAOS"
  - RAOS: "feat(chat): render type='system' message + parse metadata"
• Commit reference: STATUS.md sesi 2026-08-06 malam decision #4
• Update STATUS.md rifim-os + RAOS dgn ringkasan migrasi + link commit
• Delete waEngine.js (verify no lingering imports)
• Testing evidence: screenshot chat room 3-5 cabang menerima system message

═══════════════════════════════════════════════════════════
BLOCKER / CATATAN
═══════════════════════════════════════════════════════════

• JANGAN hapus FONNTE_TOKEN/WA_GROUP_ID dari Script Properties GAS
  — user hapus manual setelah confirm production stable 1 minggu
• Kalau ada Fonnte call di file lain (grep ulang `waSend|fonnte` sebelum
  hapus waEngine.js) → report ke CC dulu
• Push notification chain (raos_notify_new_chat_message trigger) TIDAK
  perlu diubah — system message otomatis fire push ke room member sesuai
  RLS chat_room_members
• Kalau raos_resolve_private_room return NULL untuk payslip individu,
  fallback ke announcement room (jangan gagal)

Konfirmasi paham scope, tunggu CC apply migration raos_073, lalu eksekusi.
Kalau ada ambiguity di mapping cabang atau room, report dulu.
````

---

## Follow-up

Setelah 2 PR merged + testing 9 cabang pass:
- **Sub-sesi 3B** — CC riset scope driver eksternal onboarding (invite ke chat room)
- **Sesi 2 KPI V2** — migration KPI V1→V2 dual-write transisi
- Postmortem akhir Agustus: user cancel kontrak Fonnte
- Update memory `session_2026_08_07_fonnte_deprecation.md`

## CC Todo (sebelum kirim ke CX)

- [x] Draft migration `raos_073_chat_system_message_rpc.sql`
- [ ] Apply migration via MCP `apply_migration` — TUNGGU user approve
- [ ] Verify RPC test manual (post 1 test message ke room "Pengumuman")
- [ ] Ping CX di chat "raos_073 applied, silakan mulai Sesi 3"
