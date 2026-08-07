# CX Parallel Sessions — Kickoff Message

**Konteks:** CX punya 2 sesi paralel yang tidak overlap file. Bisa kerja di 2 tab Codex Desktop bergantian atau simultan.

---

## Copy-paste kickoff untuk CX

````
Halo CX, ada 2 sesi paralel untuk kamu. File-nya TIDAK overlap, jadi
aman dikerjakan bergantian atau simultan di 2 tab Codex Desktop.

═══════════════════════════════════════════════════════════
SESI A — P0 Saldo Blockers (URGENT, prioritas #1)
═══════════════════════════════════════════════════════════

Prompt lengkap: rifim-os/prompts/CX_SESSION_SALDO_P0_FIX.md

Ringkas: fix 5 blocker P0 dari audit AUDIT_SALDO_20260806.md:
- F-01 auth bypass email → Bearer token
- F-02 processed_by UUID mismatch
- F-03 bookmarklet mark-paid sebelum AIST confirm
- F-04 mark-paid tanpa transition guard
- F-05 client_id idempotency saldo request

File touched:
- rifim-os: crmApi.js, authEngine.js, aist-fill-v2.source.js
- RAOS: apps/pwa/src/lib/saldoRequest.ts
- Migration: baru (RPC mark_paid + client_id column + RPC submit)

Deliverable: 2 PR (rifim-os + RAOS).

═══════════════════════════════════════════════════════════
SESI B — Fonnte Deprecation + Chat Migration (Sesi 3)
═══════════════════════════════════════════════════════════

Prompt lengkap: rifim-os/prompts/CX_SESSION_CHAT_MIGRATION.md

Ringkas: deprecate 100% Fonnte, redirect 12 call site waSend* →
chat room RAOS via 5 RPC baru yang CC sudah apply (raos_073).

File touched:
- rifim-os: notificationEngine.js, raosMonitoringEngine.js,
  raosLaporanEngine.js, waEngine.js (HAPUS), configLoader.js
- RAOS: apps/pwa/src/components/chat/MessageItem.tsx (render type=system)

Dependency: RAOS PR #60 harus merged dulu (migration raos_073) —
sudah di https://github.com/menala-Tech/raos-menala/pull/60,
user tinggal merge.

Deliverable: 2 PR (rifim-os + RAOS).

═══════════════════════════════════════════════════════════
URUTAN REKOMENDASI
═══════════════════════════════════════════════════════════

1. Mulai Sesi A dulu (SALDO P0 — menyentuh uang, prioritas #1)
2. Sambil tunggu CC/user merge RAOS PR #60, buka tab kedua untuk
   Sesi B kalau Sesi A idle (mis. tunggu response dari user, tunggu
   Vercel build, tunggu CC review PR).
3. Kalau Sesi A stuck di JWT verify library (blocker teknis mungkin),
   pindah dulu ke Sesi B — kabari CC.

═══════════════════════════════════════════════════════════
KOORDINASI DENGAN CC
═══════════════════════════════════════════════════════════

CC standby di worktree branch:
- claude/rifim-os-chat-sessions-e3e2ba (RAOS)

CC tugas selama kamu kerja:
- Apply migration baru kalau Sesi A butuh (mark_paid RPC + client_id)
- Review PR kalau tag @claude
- Update STATUS.md kedua repo setelah PR merged

Ping CC di chat kalau:
- Blocker teknis (mis. GAS library untuk Supabase JWT verify)
- Ambiguity mapping (mis. UUID cabang, room resolver return NULL)
- Butuh contract change (rare — CC eksklusif)

═══════════════════════════════════════════════════════════
CATATAN CROSS-REPO
═══════════════════════════════════════════════════════════

Sesi A + Sesi B sama-sama sentuh 2 repo (rifim-os + RAOS), jadi:
- Buat 4 PR total (2 per sesi)
- Commit message reference finding ID (F-01, F-02, dst) atau
  keputusan roadmap (decision #4 Fonnte deprecation)
- Update STATUS.md kedua repo per-sesi

Konfirmasi paham, lalu pilih sesi mana yang dimulai duluan.
Kalau butuh apapun dari CC, tag di chat.
````

---

## Yang CC lakukan setelah kirim ini

- [ ] User merge PR #60 RAOS (dependency Sesi B)
- [ ] Standby untuk apply migration Sesi A kalau CX request
- [ ] Review PR yang di-tag @claude
- [ ] Update STATUS.md setelah PR merged
