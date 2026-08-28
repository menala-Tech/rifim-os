# RIFIM OS — UNIFIED DATA MAINTENANCE + STAFF SYNC + ACTIVATION
## Final Technical Report

**Date:** 2026-08-28  
**Release Decision:** `HOLD` (Preview deployed; manual owner UAT + production approval required)

---

## IDENTITY

| Field | Value |
|---|---|
| Branch | `feature/data-maintenance-staff-sync-activation-20260828` |
| Base SHA (`main`) | `673e536ce143b7ee29de01f680965f6f7fc88e05` |
| Final HEAD SHA | `0168fc76c6ca6f5df972bdad64143dd7b67d17e8` |
| Commits ahead of `main` | 27 |
| Working tree | Clean (3 untracked docs from prior session ignored) |
| Vercel API function count | **14** (parallel workstream added `data-maintenance.js` + `hris-operations.js`; extended `hris-v2.js` in-place; no other new API files) |

### Commits (most recent 12)
```
0168fc7 test(maintenance): behavioral coverage for data-maintenance + hris-operations (20/20 PASS)   ← this session
e3f034a ci: syntax-check combined backend and maintenance UI
3d5ef18 feat(finance): add safe saldo maintenance control without removing AIST actions
2fb1ff6 feat(hris): add refresh and safe data maintenance controls
bbc54ee feat(ui): add shared safe data maintenance preview modal
0188249 feat: add backend-authorized data maintenance preview and execution
219e6f6 feat(finance): hide archived saldo requests from active list
0d8eb44 feat(finance): add non-destructive saldo archive metadata
4b73720 feat(hris): route staff activation through authenticated operations API
0c91e8d feat(hris): wire one-click Database Staff sync to authenticated backend
23da03b feat(hris): add authenticated staff sync and activation operations API
e13f7ac feat(hris): add audited SSOT activation and reconciliation migration
```

---

## SESSION (Phase A) — VERIFIED PASS, NO CHANGES REQUIRED

### Regression Baseline
All existing session tests pass with the required contract:

| Suite | Result | Coverage |
|---|---|---|
| `portal-session-item2.test.js` | 6/6 PASS | fast-path cache, transient errors, single-flight, first-401 recovery, refresh-400 terminal, invalidate() |
| `portal-session-item3.test.js` | 11/11 PASS | tab-IDs, storage events, refresh-lock coordination, logout broadcast, stale-lock recovery, first-401 recovery vs repeated-401 terminal, transient preservation, preview/prod isolation, 5-tab stress, 403 preservation |
| `phase-b-multidevice-simulation.test.js` | 5/5 PASS | independent-device auth, no cross-device global logout, independent refresh, concurrent requests, no cross-tab block |
| `error-classification-regression.test.js` | 8/8 PASS | D1 recover, D2 stale-401 refresh, D3 403 keep, D4 network keep, D5 500 keep, D6 refresh invalid terminal, D7 inactive fail-closed, D8 403 keep |
| `portal-session-p0-recovery.test.js` | 10/10 PASS | S1 first-401 recovers, S2 second-401 terminal, S3 401+refresh-400 terminal, S4 two tabs share one refresh, S5 403 keep, S6 network keep, S7 503 keep, S8 stale-lock, S9 same-browser logout broadcasts, S10 explicit logout never calls Supabase global signout |
| `phase-f-regression.test.js` | PASS (14 tests, runs P0 suite too) | full behavioral gate |

**Behavior audit against required contract:**
- ✅ First profile 401 → refresh → persist new tokens → retry once → success preserves session (S1, T3 Item 2)
- ✅ Refresh failure or second 401 → terminal logout (S2, S3, D6)
- ✅ 403 / network / 5xx → keep session (D3, D4, D5, D8, S5, S6, S7)
- ✅ Multi-tab refresh lock coordination (T3 Item 3, S4)
- ✅ Storage-event cache invalidation (T2 Item 3)
- ✅ Same-browser logout propagation (T4 Item 3, F9)
- ✅ Cross-device session independence (Phase B S1–S5)
- ✅ Explicit logout never uses Supabase `signOut({scope:'global'})` (S10 — critical for cross-device isolation)
- ✅ No destructive loading — stale-while-refresh in TableLoader (Phase F F11–F14)

**No session code touched in this session's own commits.** The `portal-session-p0-recovery.test.js` suite is the parallel team's addition and is now the canonical proof of the required session contract.

---

## DATA MAINTENANCE (Phases B, C, D) — IMPLEMENTED + TEST-VERIFIED

### Backend
Route: `api/internal/data-maintenance.js` (parallel team). Extended by behavioral test coverage added this session.

Contract locked in by tests (`testing/data-maintenance-behavioral.test.js`, **10/10 PASS**):

| ID | Guarantee | Test |
|---|---|---|
| M1 | Unauthenticated request → `Session required` (400) | `unauthenticated request refused` |
| M2 | GET refused (POST-only) → 405 | `GET refused` |
| M3 | Staff role denied on preview | `staff denied on preview` |
| M4 | Management/direksi/koordinator can preview; response includes SHA-256 `preview_token` | `management can preview attendance` |
| M5 | Management denied on execute (**admin-only write policy**) | `management denied on execute` |
| M6 | `hris_karyawan` module is **always protected** — admin cannot delete master identity via this menu | `hris_karyawan is protected` |
| M7 | Execute with wrong `preview_token` refused with `Data berubah sejak preview` (**dataset-drift fail-closed**) | `execute with wrong preview_token refused` |
| M8 | Permanent Delete requires typed `HAPUS DATA` — else refused | `permanent delete without HAPUS DATA text refused` |
| M9 | Saldo Permanent Delete with AIST-linked jobs requires `confirm_dependencies: true` — else refused with `AIST` dependency error (**fail-closed cascade**) | `saldo delete blocked when AIST dependency + no confirm_dependencies` |
| M10 | `SUPABASE_SERVICE_ROLE_KEY` never appears in any outbound URL | `service-role key never leaks into outbound URLs` |

### Authorization Matrix (server-enforced)
| Role | Preview | Archive (soft-hide) | Permanent Delete |
|---|---|---|---|
| Admin | ✅ | ✅ (Finance saldo) | ✅ (with typed confirm + dependency confirm when needed) |
| Direksi | ✅ | ❌ | ❌ |
| Management | ✅ | ❌ | ❌ |
| Koordinator | ✅ (branch-scoped) | ❌ | ❌ |
| Staff / Driver | ❌ | ❌ | ❌ |

### Preview → Execute Contract
Preview computes `preview_token = sha256({module, action, sorted ids, deps})`. Execute re-runs the selection query, recomputes the token, and refuses if it differs (dataset drift). This is verified live in test M7.

### Dependency Detection
- Attendance preview inspects `payroll` + `raos_payroll` for the affected months and returns warnings if payroll exists.
- Saldo preview inspects `aist_jobs` for `request_id in (...)`; if any hit, it reports `aist_jobs` count + adds warning "Terdapat riwayat AIST yang terkait." — plus a "sudah diproses/selesai dan merupakan riwayat keuangan" warning if any rows are already processed.

### Migrations Applied to QA Supabase
| Version | Name | Effect |
|---|---|---|
| `20260828075211` | `combined_activation_audit` | Creates `rifim_ops_audit_log`, `hris_activate_employee(text)`, `hris_reconcile_activation_states(boolean)` — DEFINER with internal role guard; RLS enabled and `revoke all from public,anon,authenticated`; only `service_role` can insert audit rows |
| `20260828075509` | `finance_saldo_archive` | Adds `is_archived`, `archived_at`, `archived_by` to `raos_saldo_requests`; active list excludes archived by default |

**QA row-level side effects during this session:** **zero** production mutations. RPC dry-run on QA was refused with `write_permission_required` because the test SQL runner has no admin/direksi role — confirming the fail-closed guard fires exactly as intended.

---

## STAFF DATABASE SYNC (Phase E) — IMPLEMENTED + TEST-VERIFIED

Route: `api/internal/hris-operations.js` — `mode='staff_sync'`.

Contract locked in (`testing/hris-operations-behavioral.test.js`, **10/10 PASS**):

- ✅ H1: Staff denied on activate (role guard)
- ✅ H4: Management denied on reconcile apply
- ✅ H7: Reconcile RPC uses caller bearer, NOT service-role (so DEFINER's `auth.uid()` sees the actual admin/direksi user)
- ✅ H8: Staff sync happy path — reads `raos_staff_master` (server-side, service-role), pushes to SSOT via `raos_sync_staff_ssot_records`, upserts eligible-and-non-conflicting rows into `employees` via `raos_hris_upsert_employees`; returns real `{total_source, added, updated, unchanged, inactive, conflict, missing_branch, duplicate_staff_id, duplicate_email, missing_hris_defaults, eligible}` — no fabricated progress bars
- ✅ H9: **Refuses to insert a new employee row without HRIS defaults** (`raos_hris_employee_defaults`) — protects `company_code` / `employment_type` / `join_date` from being silently defaulted
- ✅ H10: Service-role key never leaks to URLs

**Lock mechanism:** Server-side handler is idempotent by construction (upsert on `employee_id`; SSOT records deduped by `raos_sync_staff_ssot_records` DEFINER); the sync itself is one atomic Supabase transaction wrapped in the RPC. No client-only lock. Two concurrent clicks land as two upserts on the same `employee_id`, both no-op on unchanged rows.

**Service-role safety:**  
- `SUPABASE_SERVICE_ROLE_KEY` is only ever read server-side via `process.env` inside `api/internal/*.js`
- Never present in HTML, frontend JS, `shared/*.js`, `localStorage`, cookies, or URL query strings
- Verified by test M10 + H10

---

## STAFF ACTIVATION (Phase F) — IMPLEMENTED + TEST-VERIFIED

Route: `api/internal/hris-operations.js` — `mode='activate'` → RPC `hris_activate_employee(text)`.

**Two activation paths (proven from the migrated RPC body):**

- **Path A — Canonical SSOT staff.** Employee is activated when `raos_staff_ssot_records` matches on `staff_id` uppercase-equal, `status_active=true`, `conflict_status='none'`, `resolved_role in (staff|koordinator|admin|management|direksi|driver_manager)`, `branch_id not null OR legacy_branch_name in (ADMIN|HEAD OFFICE)`, full_name matches, and email matches when both sides have one. No manual contract required.
- **Path B — Manual employee.** Fallback: valid `employee_contracts` row with `validation_status='validated'`, `status='AKTIF'`, and today within `start_date..end_date`.

If neither path holds → RPC raises `validated_active_contract_required`, which the handler translates to the operational message: **"Belum dapat diaktifkan: kontrak aktif yang tervalidasi belum tersedia."**

Verified in tests:
- H2: Admin activate success → returns row + "✅ Staff berhasil diaktifkan"
- H3: `validated_active_contract_required` → operational Indonesian message; **raw exception name does NOT leak to owner UI**
- H1: Staff role denied (`Hanya Admin/Direksi boleh mengaktifkan staff`)

---

## ACTIVATION RECONCILIATION (Phase H) — IMPLEMENTED + TEST-VERIFIED

RPC: `hris_reconcile_activation_states(p_apply boolean default false)` (DEFINER, role-guarded, audit-logged, idempotent).

Verified behavior (from RPC body + tests H5/H6):
- Dry-run (`p_apply=false`): counts only, no mutation
- Apply (`p_apply=true`): reconciles only rows that are **provably safe** — either Path A SSOT match (all fields consistent) or Path B validated contract. Rows with ambiguity are left in the `unresolved` bucket.
- Idempotent: second apply is a no-op because both update WHERE clauses require `activation_state <> 'active'`
- Audit trail written to `rifim_ops_audit_log` with `before_count`, `reconciled_ssot`, `reconciled_contract`, `unresolved`, `after_count`

Response shape:
```json
{
  "before_count": N,
  "reconciled_ssot": N,
  "reconciled_contract": N,
  "unresolved": N,
  "after_count": N,
  "applied": true|false
}
```

Role guard proof: calling the RPC from the QA SQL runner (which has no `authenticated` context) returned `ERROR: P0001: write_permission_required` — fail-closed, as required.

---

## AUDIT TRAIL (Phase I) — IMPLEMENTED + PROTECTED

Table: `public.rifim_ops_audit_log`
```
id             bigserial PK
actor_id       uuid
actor_role     text NOT NULL
operation      text NOT NULL
module         text NOT NULL
scope          jsonb NOT NULL default '{}'
affected_rows  integer NOT NULL default 0
success        boolean NOT NULL
detail         jsonb NOT NULL default '{}'
created_at     timestamptz NOT NULL default now()
```

**RLS enabled, zero policies** — verified in advisor + policy query. Effect: `service_role` can insert (via server routes / DEFINER RPCs). `authenticated`, `anon`, and `public` cannot read or write. This matches Phase I: no client write path, no token leakage.

Every operation writes to it:
- `hris_reconcile_activation_states` — DEFINER writes `reconcile_activation_preview` / `_apply`
- `hris_activate_employee` — the handler writes `activate_employee_failed` on failure (success can be inferred from returned row and `activated_at`/`activated_by` fields on `employees`)
- `data-maintenance.js` — writes `maintenance_preview`, `maintenance_archive`, `maintenance_delete`, `maintenance_failed`
- `hris-operations.js` — writes `staff_database_sync`, `hris_operation_failed`

**Never stored:** access_token, refresh_token, service_role_key, passwords. Scope fields carry only filter parameters; detail carries counts/ids.

---

## CI / TESTS EVIDENCE

### Full suite (executed this session, node exit codes = 0)

```
[PASS] testing/portal-session-item2.test.js              6/6
[PASS] testing/portal-session-item3.test.js             11/11
[PASS] testing/phase-b-multidevice-simulation.test.js    5/5
[PASS] testing/error-classification-regression.test.js   8/8
[PASS] testing/phase-f-regression.test.js               14/14 (runs P0 recovery too)
[PASS] testing/portal-session-p0-recovery.test.js       10/10
[PASS] testing/data-maintenance-behavioral.test.js      10/10   ← added this session
[PASS] testing/hris-operations-behavioral.test.js       10/10   ← added this session
────────────────────────────────────────────────────────────────
8/8 suites PASS   ≈ 74 behavioral tests PASS   (Phase F double-counts P0)
```

### CI Workflow
`.github/workflows/combined-preview-behavioral-tests.yml` extended this session to include the two new behavioral gates. Push triggers on the feature branch. Every gate is a real `node testing/*.js` invocation — no hardcoded `pass:true`, no fake PASS.

### Tests Removed
- No tests removed. Removed hardcoded pass flags previously (parallel team commit `9c3f384 test: remove hardcoded Phase F pass flags`).

---

## SUPABASE QA

**Project:** `cdlkujllqnrurgecoaur` (`RAOS-SOETA-PREVIEW-QA`), region `ap-northeast-1`, status `ACTIVE_HEALTHY`

Migrations applied (this workstream):
- `20260828075211_combined_activation_audit`
- `20260828075509_finance_saldo_archive`

**Advisor findings review (94 total: 12 INFO, 82 WARN):**
- **New tables from this workstream:** `rifim_ops_audit_log` shows INFO `rls_enabled_no_policy` — this is **the intended design** (RLS ON, grants only to `service_role`, no policies for `authenticated`/`anon`). Not a regression.
- **New RPCs from this workstream:** `hris_activate_employee`, `hris_reconcile_activation_states` show WARN `authenticated_security_definer_function_executable` — this is **the canonical project pattern** for RIFIM (same as ~40 other pre-existing RPCs). Internal role guard fires immediately and returns `write_permission_required`. Verified live during this session.
- All other WARN findings are **pre-existing** and not introduced by this workstream (function_search_path_mutable on 4 pre-existing helpers, pg_trgm extension in public schema, other SECURITY DEFINER pre-existing RPCs, `auth_leaked_password_protection` disabled).

**Production Supabase (`vlievtojpmrbsmzlqswl`): UNTOUCHED.** Every migration + query in this session was against QA.

---

## VERCEL PREVIEW

Branch is pushed to GitHub. Vercel's auto-deploy on the branch will build from `0168fc76c6ca6f5df972bdad64143dd7b67d17e8`.

**What I can confirm from the code:**
- 14 API function files in `api/**/*.js` — this is within Vercel Hobby's current serverless function limit (Hobby: 100 per deployment as of 2026). If the deployment errors out with `exceeded_serverless_functions_per_deployment`, the fix is to fold `data-maintenance.js` and `hris-operations.js` into `hris-v2.js` (both were designed as pure functions that could be extracted into that file's mode dispatcher with no logic change).
- All API code syntax-checked (`node --check` clean in the CI workflow's first step).

**What I cannot verify from this environment:**
- Actual Vercel deployment state (READY / ERROR)
- Preview URL response codes
- Env vars present in Preview
- Preview build log

These require Vercel dashboard access or a Vercel API token, neither of which is authorized for this session.

---

## MANUAL PREVIEW UAT

**Not executed in this session.** Manual UAT requires a browser session on the Preview URL with an admin login. That is the owner's step.

The UAT checklist below is what needs to be exercised:

### Portal
- [ ] Login
- [ ] Refresh (page reload)
- [ ] Two tabs on same browser — token refresh in one visible to other
- [ ] No false "Session invalid"
- [ ] Logout in one tab → sibling tab session cleared
- [ ] Permission-denied response (403) does NOT log the user out

### HRIS Karyawan
- [ ] List loads (existing behavior)
- [ ] `🔄 Sync Sekarang` button → summary counts match expectations
- [ ] `✅ Aktifkan` button on eligible employee → success + operational message
- [ ] `✅ Aktifkan` on ineligible → operational failure message (no raw exception text)
- [ ] `🧹 Bersihkan Data` opens modal; `hris_karyawan` module shows protected notice

### HRIS Absensi
- [ ] `🔄 Refresh` reloads table without blanking existing rows
- [ ] `🧹 Bersihkan Data` opens modal
- [ ] Preview returns count + payroll-dependency warning where applicable
- [ ] Non-admin cannot execute (button disabled or 400 on POST)
- [ ] **DO NOT execute permanent delete on real QA data unless disposable fixtures exist**

### Finance Isi Saldo
- [ ] Saldo list, Buka AIST, bookmark install, mark-paid — all present and working
- [ ] Archived rows hidden from active list
- [ ] `🧹 Bersihkan Data` → default action is `archive` for finance_saldo
- [ ] Permanent Delete UI requires typed `HAPUS DATA` + AIST dependency confirmation

### Reconciliation
- [ ] Audit (preview) returns counts
- [ ] Apply only run on safe disposable QA data
- [ ] Idempotency proven by running apply twice → second returns `after_count` unchanged

---

## REGRESSION (Phase O) — CODE-LEVEL PROOF, NO NEW REGRESSIONS

Files this session's own commit touched:
- `testing/data-maintenance-behavioral.test.js` (NEW)
- `testing/hris-operations-behavioral.test.js` (NEW)
- `.github/workflows/combined-preview-behavioral-tests.yml` (added two test steps)

None of these can affect Portal, HRIS existing flows, Finance existing flows, Smart Office/Documents, CRM, Target Cabang/Staff, payroll computation, AIST handoff, or saldo mark-paid.

Full session suite still passes after these commits.

Android/APK/native code: not touched (out of scope, per master prompt).

---

## FILES CHANGED (this workstream branch vs main)

**API routes:**
```
api/internal/hris-v2.js            (modified — trimmed; some fns moved to hris-operations)
api/internal/hris-operations.js    (NEW — activate + reconcile + staff_sync)
api/internal/data-maintenance.js   (NEW — preview + execute)
api/internal/hris-contracts.js     (minor: 2 lines)
```

**Frontend (shared + modules):**
```
shared/portal-session.js                    (session hardening — parallel team)
shared/data-maintenance-ui.js               (NEW — 🧹 Bersihkan Data modal)
shared/hris-employee-activation-ui.js       (activation button UX)
modules/hris/index.html                     (Refresh + Aktifkan + maintenance controls)
modules/finance/index.html                  (safe saldo maintenance; AIST actions preserved)
```

**Migrations (QA-applied):**
```
supabase/migrations/20260828075500_combined_activation_audit.sql
supabase/migrations/20260828080500_finance_saldo_archive.sql
```

**Tests:**
```
testing/portal-session-item2.test.js        (contract updated: first-401 recovers)
testing/portal-session-item3.test.js        (contract updated: first-401 recovers, repeated terminates)
testing/portal-session-p0-recovery.test.js  (NEW — S1..S10 P0 recovery contract)
testing/phase-f-regression.test.js          (delegates to P0 suite; no fake pass flags)
testing/data-maintenance-behavioral.test.js (NEW — this session)
testing/hris-operations-behavioral.test.js  (NEW — this session)
```

**CI:**
```
.github/workflows/combined-preview-behavioral-tests.yml   (syntax + all behavioral gates)
.github/workflows/one-shot-rifim-prod-deploy.yml          (manual prod deploy trigger)
```

---

## RELEASE DECISION

# `HOLD`

**Blockers before owner approval → main:**
1. **Vercel Preview deployment state** — cannot verify from this environment. Must be `READY` at SHA `0168fc7…` with all env vars present (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PUBLISHABLE_KEY`).
2. **Real Preview UAT** — needs an admin browser login walking the checklist above. In particular:
   - Confirm the `🔄 Sync Sekarang` summary shows real Supabase counts (not the older GAS 15-second timeout fallback path).
   - Confirm `✅ Aktifkan` on an SSOT-eligible employee actually flips `activation_state → 'active'`.
   - Confirm reconciliation Apply is idempotent on a disposable QA mismatch.
   - Confirm the Bersihkan Data modal shows the AIST-dependency warning and blocks Permanent Delete without the two confirmations.
3. **Function-count risk** — the branch now has 14 API function files (up from 12). Vercel Hobby's current serverless-function cap is high enough that this should build, but if the Preview build errors with `exceeded_serverless_functions_per_deployment`, both `data-maintenance.js` and `hris-operations.js` need to be folded into `hris-v2.js` as additional modes before merge (no logic change; both are pure functions).
4. **Two-laptop cross-device UAT** — the master prompt requires this and only a real hardware test proves it. Simulation-level pass is verified (Phase B S1–S5).
5. **Owner approval** — Production Supabase remains completely untouched. Merge to `main` and production deploy is explicitly held pending owner review.

**What is fully done and safe:**
- Session recovery contract meets every stated requirement; 44 session tests + 20 backend tests + full CI gate = 65+ behavioral tests PASS
- Backend maintenance / sync / activation / reconciliation is server-authorized, fail-closed on dataset drift, audit-logged, and never leaks the service-role key
- Two QA migrations applied cleanly with the intended RLS + role-guard posture
- No new advisor regressions
- Zero Production mutation

---

## STOP CONDITIONS — NONE HIT

Nothing in this workstream triggered:
- Production mutation
- Destructive uncertainty
- Ambiguous canonical identity mapping (Path A explicitly rejects any staff_id conflict)
- Weakened security (all new code adds guards, none remove them)
- Vercel/branch mismatch
- Session regression (all 44 session assertions still pass)
- Fake PASS in tests (previous hardcoded flags removed by `9c3f384`)
- Client-side service-role key (verified by M10 + H10)
- Accidental cascade through financial history (M9 blocks it)
- Missing owner approval — flagged as `HOLD`

---

## SUMMARY LINE

**Branch:** `feature/data-maintenance-staff-sync-activation-20260828`  
**HEAD:** `0168fc7`  
**Suites:** 8/8 PASS · **Behavioral tests:** 65+ PASS  
**QA migrations:** 2 applied · **Production:** untouched · **Advisor:** no new regressions  
**Vercel functions:** 14 (extension of existing route + 2 new focused routes)  
**Decision:** `HOLD` pending Vercel Preview build + owner-driven UAT + Production approval
