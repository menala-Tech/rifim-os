# CX Session — Fix 5 Blocker P0 Audit Saldo (2026-08-06)

**Source audit:** `docs/AUDIT_SALDO_20260806.md` (rifim-os PR #38, merged ke main commit `4e892a2`)
**Prompt untuk:** Codex Desktop (CX)
**Priority:** P0 — pipeline saldo Finance menyentuh uang, wajib fix sebelum sesi KPI/chat migration.
**Estimasi:** 1 sesi CX (multi-file, cross-repo RAOS + rifim-os).

---

## Copy-paste prompt CX

````
Halo CX, sesi lanjutan dari audit saldo (docs/AUDIT_SALDO_20260806.md di rifim-os PR #38 sudah merged ke main).

TASK: Fix 5 blocker P0 dari audit tsb. Zero-tolerance karena menyentuh transaksi uang (Finance mark-paid saldo cabang).

SCOPE: rifim-os (Finance/GAS/Bookmarklet) + RAOS (client_id saldoRequest.ts + migration).

═══════════════════════════════════════════════════════════
5 BLOCKER YANG WAJIB DIFIX
═══════════════════════════════════════════════════════════

F-01 [rifim-os] Auth bypass — endpoint Finance percaya param email
─────────────────────────────────────────────────────────
Lokasi: automation/apps-script/crmApi.js:646-655 + authEngine.js:33-73
Bookmarklet: automation/aist-bookmarklet/aist-fill-v2.source.js:23-25,81-89
Masalah: caller cukup kirim ?user=<email whitelist> untuk bertindak sbg role tsb. Fallback ADMIN aktif kalau Supabase timeout.
Fix:
  • Verify Bearer Supabase access token server-side (Supabase JWT verify pakai JWKS/publishable key).
  • Derive user_profiles.id + role dari sub token, JANGAN dari param email.
  • Hapus fallback ADMIN untuk semua action finansial (mark_paid, approve, reject).
  • Pisahkan endpoint: GET utk read (list) tetap boleh dgn token, POST wajib utk mutation (mark_paid).
  • Bookmarklet: ambil access_token dari localStorage.rifim_auth.access_token (bukan email); kalau tidak ada, force login ulang.

F-02 [rifim-os] Type mismatch — processed_by UUID diisi email
─────────────────────────────────────────────────────────
Lokasi: crmApi.js:929-940 (_finSaldoRaosMarkPaid_) — body PATCH kirim processed_by=params.user (email)
DB actual: raos_saldo_requests.processed_by uuid null (FK ke user_profiles.id)
Fix:
  • Setelah F-01 selesai (token verified), lookup user_profiles.id via token.sub atau via email→id.
  • Kirim processed_by=<uuid> ke PATCH body.
  • Fail-closed kalau UUID tidak ditemukan (return 401 dgn error typed).

F-03 [rifim-os] Bookmarklet mark-paid sebelum AIST confirm
─────────────────────────────────────────────────────────
Lokasi: automation/aist-bookmarklet/aist-fill-v2.source.js:133-157
Masalah: fillAistModal isi field → toast "tekan OK" → LANGSUNG fire mark_paid tanpa tunggu AIST commit.
Fix:
  • Restructure: setelah fillAistModal, WAIT for AIST success signal (poll DOM utk toast sukses AIST, atau observe MutationObserver di modal).
  • Hanya panggil mark_paid setelah acknowledgement terkonfirmasi.
  • Timeout 30 detik → tampilkan retry state, JANGAN silent-ignore.
  • Disable row/loading state selama menunggu → cegah double-click.
  • Kalau AIST cancel/error → row tetap `approved`, tidak processed.

F-04 [rifim-os] Mark-paid tanpa transition guard
─────────────────────────────────────────────────────────
Lokasi: crmApi.js:929-940 — filter PATCH hanya id=eq.<id>, tidak check status/is_processed
Fix (WAJIB via RPC, bukan PATCH langsung):
  • Buat migration Supabase: RPC raos_saldo_mark_paid(request_id uuid, processor_id uuid) RETURNS jsonb.
  • Guard: SELECT ... FOR UPDATE lalu:
      - IF is_processed=true → return {status: 'already_processed', row: ...}
      - IF status != 'approved' → return {status: 'not_approved', current_status: ...}
      - ELSE UPDATE + return {status: 'updated', row: ...}
  • SECURITY DEFINER, search_path=public, grant EXECUTE ke authenticated (dan gate role di dalam RPC).
  • crmApi.js panggil RPC via POST /rpc/raos_saldo_mark_paid, JANGAN PATCH.
  • Response typed → UI Finance + Bookmarklet handle 3 outcome berbeda.

F-05 [RAOS] Idempotency client_id saldo request
─────────────────────────────────────────────────────────
Lokasi RAOS: apps/pwa/src/lib/saldoRequest.ts:140-155 (INSERT), 161-195 (chat)
DB actual: raos_saldo_requests TIDAK punya kolom client_id (cek migration 036 salah — hanya chat_messages yg punya)
Fix:
  1. Migration Supabase (raos_073 atau lanjutan):
     ALTER TABLE raos_saldo_requests ADD COLUMN client_id uuid;
     CREATE UNIQUE INDEX raos_saldo_requests_client_id_uidx 
       ON raos_saldo_requests(client_id) WHERE client_id IS NOT NULL;
  2. RPC raos_saldo_submit(...) SECURITY DEFINER:
     • ON CONFLICT (client_id) DO NOTHING RETURNING id
     • Kalau conflict → SELECT existing row, return-nya
     • Include INSERT chat_messages + link chat_message_id DALAM SATU transaction (fix F-10 sekaligus)
  3. PWA saldoRequest.ts:
     • Generate client_id = crypto.randomUUID() sebelum submit
     • Simpan di offline queue (idb) → retry pakai client_id yang sama
     • Panggil RPC, bukan direct INSERT

═══════════════════════════════════════════════════════════
URUTAN EKSEKUSI
═══════════════════════════════════════════════════════════

1. Migration Supabase dulu (F-04 RPC mark_paid + F-05 client_id column + RPC submit) — apply ke prod via MCP apply_migration
2. Update crmApi.js F-01 + F-02 + F-04 (token verify + UUID lookup + panggil RPC)
3. Update authEngine.js F-01 (hapus fallback ADMIN, tambah JWT verify helper)
4. Update bookmarklet F-01 + F-03 (token + wait-for-AIST)
5. Update RAOS saldoRequest.ts F-05 (client_id + panggil RPC submit)
6. Deploy GAS rifim-os (clasp push + manual redeploy — cek GAS_PROJECTS_MAP.md)
7. Verify manual: submit → approve → mark-paid (Finance UI) → mark-paid retry (harus return already_processed)
8. Update docs/STATUS.md dgn ringkasan 5 fix + link commit

═══════════════════════════════════════════════════════════
DELIVERABLES
═══════════════════════════════════════════════════════════

• 1 PR di rifim-os berjudul: fix(saldo): P0 blockers F-01..F-04 dari audit 20260806
• 1 PR di RAOS berjudul: fix(saldo): F-05 idempotency client_id + RPC submit
• Migration file di sql/ folder kedua repo (mirror ke Supabase Dashboard actual)
• Commit message reference finding ID (F-01, F-02, dst)
• Update AUDIT_SALDO_20260806.md dgn seksi "Remediation Log" di bawah — checklist mana yg fixed

Kalau ada trade-off (mis. token verify butuh JWKS caching), ambil keputusan dgn tetap prioritaskan SECURITY > convenience. Report balik decision-nya di PR body.

Tolong konfirmasi paham scope, lalu mulai eksekusi. Kalau ada blocker teknis (mis. Supabase JWT verify di GAS ternyata butuh library eksternal), report dulu sebelum lanjut.
````

---

## Follow-up setelah CX selesai

Setelah 2 PR merged:
- Lanjut ke **Sesi 2 KPI V2** atau **Sesi 3 chat migration** (branch worktree ini sudah `claude/rifim-os-chat-sessions-e3e2ba` — lebih efisien lanjut Sesi 3).
- Update memory `session_2026_08_06_saldo_p0_fix.md` (mirror di RAOS & rifim-os memory).
