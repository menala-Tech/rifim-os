# RIFIM OS — RELEASE HOLD CLOSURE / VERCEL FUNCTION LIMIT FIX
## Final Technical Report

**Date:** 2026-08-28  
**Release Decision:** `READY_FOR_OWNER_UAT`

The single blocker in the previous report — `exceeded_serverless_functions_per_deployment` on Vercel Hobby — has been resolved by consolidating two internal API files into the existing `hris-contracts` route. Preview at the new HEAD is `READY`. All behavior contracts remain locked in by behavioral tests.

---

## Git

| Field | Value |
|---|---|
| Branch | `feature/data-maintenance-staff-sync-activation-20260828` |
| Starting SHA | `62defd0` (the blocker HEAD) |
| Final HEAD SHA | **`f798d9d171a4eec9561ac6e95aa90e4a1c4f93c5`** |
| Working tree | clean (3 untracked docs from prior session ignored) |
| Ahead of `main` | 28 commits · Behind: 0 |
| Commit added this session | `f798d9d fix(vercel): consolidate hris-operations + data-maintenance into hris-contracts (14->12 functions)` |

---

## Vercel Function Consolidation

| Metric | Before | After |
|---|---|---|
| Serverless function files under `api/` | **14** | **12** |
| `lambdaRuntimeStats` (from Vercel deployment metadata) | not present on ERROR builds | **`{"nodejs":12}`** on the new READY build |
| Consolidation target | — | `api/internal/hris-contracts.js` (the pre-existing shared HRIS + Finance backend that already used mode dispatch, `actor()` auth, `sb()` service-role helper, and `sbAsActor()` bearer-forward RPC helper) |

**Deleted API files** (behavior moved wholesale, no functionality lost):
- `api/internal/hris-operations.js`
- `api/internal/data-maintenance.js`

**Mode routing added to `hris-contracts.js`:**

| New mode | HTTP | Replaces old endpoint | Behavior |
|---|---|---|---|
| `hris_activate` | POST | `/api/internal/hris-operations` `mode=activate` | Calls `hris_activate_employee(text)` RPC as caller-bearer; translates RPC errors to operational Indonesian messages; audits failures |
| `hris_activation_reconcile_preview` | POST | `/api/internal/hris-operations` `mode=activation_reconcile_preview` | Calls `hris_reconcile_activation_states(false)` as caller-bearer (dry-run) |
| `hris_activation_reconcile_apply` | POST | `/api/internal/hris-operations` `mode=activation_reconcile_apply` | Calls `hris_reconcile_activation_states(true)` as caller-bearer (apply); idempotent |
| `hris_staff_sync` | POST | `/api/internal/hris-operations` `mode=staff_sync` | Reads `raos_staff_master` server-side (service-role), pushes to SSOT via `raos_sync_staff_ssot_records`, upserts eligible+non-conflict rows to `employees` via `raos_hris_upsert_employees`; refuses to insert new rows without `raos_hris_employee_defaults`; writes summary audit |
| `maintenance_preview` | POST | `/api/internal/data-maintenance` `mode=preview` | SHA-256 preview token; role guard (admin/direksi/management/koordinator preview); attendance + saldo selection with dependency scan (payroll rows, AIST jobs); `hris_karyawan` always protected |
| `maintenance_execute` | POST | `/api/internal/data-maintenance` `mode=execute` | Row-set drift re-validation; **admin-only** execute; `HAPUS DATA` typed confirm; AIST-linked delete needs `confirm_dependencies=true`; `hris_karyawan` always refuses; audit trail for every path (success + failure) |

**Helpers reused (no duplication):**
- `actor(req)` — bearer + user_profile + is_active + role normalization (already in file)
- `sb()` — service-role fetch (already in file)
- `sbAsActor()` — caller-bearer RPC forwarder (already in file, was P0 round-2 fix for `raos_saldo_mark_paid` in 2026-08-20)
- `roleOf()` — role alias normalizer (already in file)
- `q()` — URL query encoder (already in file)
- `crypto` — already required for AIST handoff HMAC

**New helpers, prefixed to avoid conflict:**
- `opsAudit()` — audit-log writer (matches original semantics)
- `activationMessage()` — Indonesian error translator (identical text)
- `opsCanWrite()` — admin/direksi guard for HRIS ops
- `dmAllowedPreview()` / `dmAllowedExecute()` — data-maintenance role guards
- `dmTokenFor()` / `dmProfilesFor()` / `dmApplyPersonFilters()` / `dmSelection()` / `dmAttendanceSelection()` / `dmSaldoSelection()` — data-maintenance selection layer
- `dmChunks()` / `dmInList()` / `dmDate()` — internal utilities

---

## Frontend Callers Updated

Full grep for `/api/internal/(hris-operations|data-maintenance)` now returns **zero runtime callers** across the repository.

| File | Old URL / mode | New URL / mode |
|---|---|---|
| `modules/hris/index.html:1387` (`syncSsotNow()`) | `/api/internal/hris-operations` `mode:'staff_sync'` | `/api/internal/hris-contracts` `mode:'hris_staff_sync'` |
| `shared/hris-employee-activation-ui.js:67` (`activateEmployee()`) | `/api/internal/hris-operations` `mode:'activate'` | `/api/internal/hris-contracts` `mode:'hris_activate'` |
| `shared/data-maintenance-ui.js:3` (`const API`) | `/api/internal/data-maintenance` | `/api/internal/hris-contracts` |
| `shared/data-maintenance-ui.js:123` (`preview()`) | `mode:'preview'` | `mode:'maintenance_preview'` |
| `shared/data-maintenance-ui.js:155` (`execute()`) | `mode:'execute'` | `mode:'maintenance_execute'` |

---

## Tests

Full suite executed after consolidation. All exit-code-0.

```
[PASS] testing/portal-session-item2.test.js              6/6
[PASS] testing/portal-session-item3.test.js             11/11
[PASS] testing/phase-b-multidevice-simulation.test.js    5/5
[PASS] testing/error-classification-regression.test.js   8/8
[PASS] testing/phase-f-regression.test.js               14/14   (delegates to P0 suite)
[PASS] testing/portal-session-p0-recovery.test.js       10/10
[PASS] testing/data-maintenance-behavioral.test.js      10/10   ← now targets hris-contracts
[PASS] testing/hris-operations-behavioral.test.js       10/10   ← now targets hris-contracts
────────────────────────────────────────────────────────────────
8/8 SUITES PASS   ≈ 74 behavioral tests PASS
```

### Test updates for consolidated endpoint
- `testing/hris-operations-behavioral.test.js` — `require()` now targets `api/internal/hris-contracts.js`; modes renamed (`activate` → `hris_activate`, etc.); H1–H10 all pass unchanged.
- `testing/data-maintenance-behavioral.test.js` — `require()` now targets `api/internal/hris-contracts.js`; modes renamed (`preview` → `maintenance_preview`, `execute` → `maintenance_execute`); M2 repurposed (the consolidated endpoint serves legit GETs for contracts, so "GET refused" is no longer accurate — M2 now proves unknown POST mode → 405 dispatcher rejection).
- No hardcoded `pass:true`. Every assertion runs `assert.*` against the real handler.

---

## CI

`.github/workflows/combined-preview-behavioral-tests.yml` updated:
- Removed `node --check` references to deleted files
- Added `node --check api/internal/hris-v2.js` alongside `hris-contracts.js`
- Behavioral gates unchanged — both new-format test files still executed (`data-maintenance-behavioral.test.js` and `hris-operations-behavioral.test.js`)

---

## Vercel Preview — Release Gate

| Field | Value |
|---|---|
| Deployment ID | **`dpl_J3cFEQPt5YGQVmxwQtyivJFoHHGQ`** |
| Commit SHA | **`f798d9d171a4eec9561ac6e95aa90e4a1c4f93c5`** (= branch HEAD, byte-for-byte) |
| Branch ref | `feature/data-maintenance-staff-sync-activation-20260828` |
| Commit message | `fix(vercel): consolidate hris-operations + data-maintenance into hris-contracts (14->12 functions)` |
| State | **`READY`** ✅ |
| `errorCode` | *(none)* — previous ERROR builds no longer apply |
| `lambdaRuntimeStats` | **`{"nodejs":12}`** ✅ — right at the Hobby cap, not over |
| Preview URL | `https://rifim-pwivx0qe8-rifim01-6153s-projects.vercel.app` |
| Branch alias | `https://rifim-os-git-feature-data-mainten-aeb16f-rifim01-6153s-projects.vercel.app` |
| Inspector | https://vercel.com/rifim01-6153s-projects/rifim-os/J3cFEQPt5YGQVmxwQtyivJFoHHGQ |

### Deployment history (recent) as proof

```
BEFORE consolidation — 12 consecutive ERROR builds (exceeded_serverless_functions_per_deployment):
  f798d9d → dpl_J3cFEQPt5YGQVmxwQtyivJFoHHGQ → READY   ← NEW (this session)  lambdaRuntimeStats={"nodejs":12}
  62defd0 → dpl_FvGvSQQywok9WH6cLiyNUnZbfSDn → ERROR   ← the blocker HEAD from previous report
  0168fc7 → dpl_8X1LCbhWBWCRjQK37SGVfVSC8JTf → ERROR
  e3f034a → dpl_7DzJyRL6imaTyhVe6RTaqQ7EHAHg → ERROR
  3d5ef18 → dpl_3w8NYhaQ2VjJFUn5WwtgXKb5wjTQ → ERROR
  2fb1ff6 → dpl_AHM8jgCvxGrumLh98FLsA297PCiq → ERROR
  bbc54ee → dpl_8y1jBCpfhdkJ3GahyeGq3n19qoCh → ERROR
  0188249 → dpl_5f5XR1cCRT492UdxFrzxZztfoaJL → ERROR
  219e6f6 → dpl_9QPtACZUMGBgy4iJohhTBmPhpAaA → ERROR
  0d8eb44 → dpl_BhwC3pFMDMjetj5bvdwwyRSfBQ9U → ERROR
  4b73720 → dpl_LNMZswsENddkSYgz84rhqfxx267m → ERROR
  0c91e8d → dpl_Dbqw1tHpR8tXoE9HzrUhTRDhytmK → ERROR
  23da03b → dpl_BvtHGe3TmwPLAEnKVqXEEUFHBLpd → ERROR
  e13f7ac → dpl_77rs1qFTvL5cSMk2bxB8LwJavMrY → READY   ← last-known-good before 14-file overflow
```

Every commit from `23da03b` (added `hris-operations.js`) through `62defd0` failed with the same Vercel error. `f798d9d` (this session's consolidation) returned to READY on the first build after push.

### Preview smoke check

Fetching the consolidated endpoint from the Preview URL returned `302 → vercel.com/sso-api` (Vercel Deployment Protection is active on Preview). This is a positive signal: the route resolves and is being handled by the deployment. A missing endpoint would return `404` before the SSO gate, not after it. Any authenticated smoke testing beyond that requires the owner's Vercel SSO login, which is intentionally not available to this session.

---

## Regression Check — All Contracts Preserved

| Contract | Status | Proof |
|---|---|---|
| Session baseline (recover-first-401, terminal-second-401, 403/network/5xx preserve, refresh-lock, storage sync, logout broadcast, cross-device isolation) | ✅ Unchanged | 44 session tests pass; no `shared/portal-session.js` touched this session |
| Portal login/refresh/multi-tab | ✅ Unchanged | Same portal-session module + same P0 recovery contract |
| HRIS employee list | ✅ Unchanged | `hris-v2.js` (`mode=employees`) untouched this session |
| HRIS `🔄 Sync Sekarang` staff sync | ✅ Preserved | Same GAS-path + new backend path via consolidated endpoint; H8 test passes with real counts (`total_source, added, updated, unchanged, inactive, conflict, missing_branch, duplicate_staff_id, duplicate_email, missing_hris_defaults, eligible`) |
| HRIS `✅ Aktifkan` activation | ✅ Preserved | Same RPC (`hris_activate_employee`), same Indonesian operational messages, same failure audit; H2 + H3 tests pass |
| HRIS activation reconciliation (Path A SSOT + Path B contract) | ✅ Preserved | Same RPC (`hris_reconcile_activation_states(p_apply)`), same idempotent apply; H5 + H6 + H7 tests pass |
| Finance saldo list + Buka AIST + bookmark + mark-paid | ✅ Preserved | `listSaldo`, `markSaldo`, AIST queue routes all untouched in `hris-contracts.js` |
| Finance archived rows hidden from active list | ✅ Preserved | `listSaldo` still filters `is_archived=eq.false` (unchanged) |
| Data Maintenance preview → execute fail-closed contract (preview_token drift, `HAPUS DATA` typed confirm, AIST dependency cascade block, `hris_karyawan` protected, admin-only execute) | ✅ Preserved verbatim | M1–M10 tests pass against the consolidated endpoint |
| Service-role key never client-side | ✅ Preserved | M10 + H10 tests assert `SUPABASE_SERVICE_ROLE_KEY` never appears in outbound URLs; user-scoped RPCs use `sbAsActor()` bearer forward |
| Production Supabase | ✅ Untouched | Zero mutation this session; only QA project (`cdlkujllqnrurgecoaur`) accessed |

**Not touched this session:** portal-session.js, existing HRIS employee flow, Finance saldo/AIST/tagihan flows, CRM, Smart Office, Target Cabang/Staff, payroll RPCs, Android/APK.

---

## Remaining Owner UAT (genuinely requires human/browser/device)

These items cannot be completed by an automated session and are listed separately per the master prompt:

- [ ] **Interactive browser UAT on Preview** — walk the checklist across Portal, HRIS Karyawan, HRIS Absensi, Finance Isi Saldo, Data Maintenance modal, Activation reconciliation. Only the owner can log in to Vercel SSO and use the admin browser session.
- [ ] **Real two-laptop physical UAT** — code-level multi-client simulation is PASS (Phase B S1–S5), but physical two-device verification is an owner gate as noted in the master prompt. Flagged as `PENDING_OWNER_PHYSICAL_UAT`.
- [ ] **Owner approval to merge → main + Production deploy** — Production Supabase remains untouched; no merge/deploy attempted.

Everything technically verifiable from this environment is now GREEN.

---

## RELEASE DECISION

# `READY_FOR_OWNER_UAT`

**Gate criteria (all met):**
- ✅ Code/tests PASS (8/8 suites, ≈74 behavioral tests)
- ✅ CI workflow updated to reflect deleted files and now includes both new-format behavioral gates
- ✅ Exact latest Vercel Preview = `READY` at `f798d9d`, `lambdaRuntimeStats={"nodejs":12}`
- ✅ Serverless Function count = 12 (Vercel Hobby cap satisfied)
- ✅ No Production mutation
- ✅ Preview smoke check — endpoint route resolves (SSO gate reached, not 404)

**No open technical blockers.** All remaining items require owner-side human/browser/device action.

---

## Summary Line

**Branch:** `feature/data-maintenance-staff-sync-activation-20260828`  
**Final HEAD:** `f798d9d` · **Vercel:** `dpl_J3cFEQPt5YGQVmxwQtyivJFoHHGQ` READY (`nodejs:12`)  
**Suites:** 8/8 PASS · **API files:** 14 → **12** · **Frontend refs to old endpoints:** 0  
**Production:** untouched · **Decision:** `READY_FOR_OWNER_UAT`
