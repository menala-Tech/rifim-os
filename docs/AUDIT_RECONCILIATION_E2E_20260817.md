# RAOS + RIFIM OS — Reconciliation & E2E Evidence

Date: 2026-08-17
Branch: `audit-full-sync-20260817`
Production writes/deploy/migrations performed by this audit: **NONE**.

## 1. CRM User Supabase RAOS ownership — PASS (source contract)

Canonical ownership:

`MASTER DATA STAFF → GAS canonical sync → Supabase Auth + user_profiles + raos_credentials`

CRM `User Supabase RAOS` is now audit/read-only. The active source no longer exposes or calls:

- `raos_users_update`
- `raos_users_reset_pin`
- `raos_credentials_reset_pin`
- `master_staff_update_pin`
- Edit User modal/actions
- direct two-way writer guidance

The tab keeps listing/filtering only. Database evidence also shows `user_profiles` has SELECT policy for authenticated consumers and no authenticated UPDATE policy.

Status: **PASS source contract / E2E authenticated UI BLOCKED by preview protection and unavailable test session.**

## 2. Deployed Driver GAS reconciliation — PASS

Repository GAS source is older than the deployed automation. Production evidence proves the deployed Driver flow is already RPC-based:

- `ssot_driver_airport`: 242 staging records imported on 2026-08-17 11:20:34 UTC (19:20:34 WITA), conflict status `none`.
- `ssot_driver_external`: 273 staging records imported on 2026-08-17 11:47:19 UTC (19:47:19 WITA), conflict status `none`.
- Total canonical SSOT records: **515**.
- `system_logs` records successful `syncDriverAirportFromSSOT` and `syncDriverExternalFromSSOT` entries with `RPC OK`, conflict=0, unmapped=0, and canonical rows touched 242/273.
- Production function `public.raos_sync_driver_ssot(p_source,p_records)` is SECURITY DEFINER and rejects non-service-role JWTs.
- Routine EXECUTE privilege is present only for `postgres` and `service_role`.
- The RPC stages into `raos_driver_ssot_records`, validates duplicates/branch mapping, then upserts/deactivates `raos_drivers`.

Conclusion: deployed GAS is newer than `gas/12_driver_airport_sync.gs` / `gas/17_driver_external_sync.gs` currently stored in the repo. Do **not** replace the deployed PASS flow with those stale direct-REST files. Repo source should later be synchronized from the deployed canonical implementation.

Status: **PASS deployed architecture / repo-version drift remains documentation/source-sync debt.**

## 3. Driver master DB hardening audit

Current production state:

- `raos_drivers_read_scoped`: authenticated SELECT policy.
- `raos_drivers_admin_manage`: authenticated ALL policy for Admin/Direksi/Direktur still exists.
- Table-level authenticated role still has DML grants.
- PWA `/drivers` direct master CRUD has already been removed in the audit branch.
- Function inventory shows only `raos_sync_driver_ssot` directly inserts/updates `raos_drivers`; queue, assignment and saldo RPCs use Driver as reference rather than master writer.

Draft-only hardening SQL prepared in RAOS branch:

`docs/sql/RAOS_DRIVER_MASTER_READONLY_DRAFT_20260817.sql`

It is **NOT a migration and has NOT been applied**. Proposed effect after explicit authorization: revoke authenticated Driver-master DML and keep service-role SSOT sync as sole writer.

## 4. Manual Driver reference audit

Production has 10 `raos_drivers` rows with `source='manual'`.

Reference audit checked foreign-key consumers:

- `aist_jobs`
- `raos_driver_queue`
- `raos_driver_staff_assignment`
- `raos_saldo_requests`
- `scan_orders`
- `user_profiles`

All 10 manual rows currently have **zero references** across those tables.

No rows were deleted or modified. Cleanup remains a separate explicit production decision.

## 5. Role/scope policy evidence — PASS (policy contract)

Production `is_branch_in_scope(target_branch)` returns global scope for Admin/Management/Direksi/Direktur and branch/parent-child scope for branch roles.

Read/write policy audit is aligned at a contract level for key operational tables:

- Staff attendance: own insert/select/update-today with branch/date checks.
- Koordinator: branch-scoped reads.
- Driver queue: Driver own row; Staff/Koordinator branch-scoped; central roles global.
- Payroll: Staff own, Koordinator branch, central roles read; Admin/Direksi writer.
- Saldo requests: Driver own, Staff own, Koordinator scoped, central roles global via scope helper.
- Scan orders: Staff constrained insert; Driver own-linked read; Koordinator/central scoped read; Admin/Direksi mutation policy.

Status: **PASS policy contract / authenticated browser role matrix E2E still BLOCKED.**

## 6. Preview/runtime E2E

### RAOS preview

- Branch preview deployment: READY.
- Root login shell responds successfully.
- Authenticated routes such as `/drivers` are protected by Vercel preview authentication; connector requests are redirected to Vercel SSO.
- Existing branch validation already passed ESLint, TypeScript `tsc --noEmit`, and Next.js production build on Node 22.

### RIFIM OS preview

- CRM branch preview deployment: READY and build has no reported build error.
- `/crm` is protected by Vercel preview authentication; connector request is redirected to Vercel SSO.

Therefore authenticated browser E2E cannot honestly be marked PASS without a usable preview/test session for each role.

Status: **BLOCKED (preview auth/test identities), not FAIL.**

## 7. Write/readback E2E

Production `raos_saldo_requests` currently contains real pending/approved-but-unprocessed requests and no completed processed row suitable as a disposable test fixture. A Finance `mark_paid` test would be a production mutation, so it was not performed.

Status Finance mark-paid → RAOS readback: **BLOCKED pending non-production test fixture/session or explicit production authorization.**

The same no-production-write rule applies to HRIS attendance/payroll mutation E2E.

## 8. Environment-file audit

RAOS repository tracks `apps/pwa/.env.production`. It contains only `NEXT_PUBLIC_*` client configuration (Supabase URL, anonymous/public client key, app name/version), **not a service-role or private secret**. `.gitignore` already ignores `.env*`, so the tracked file is legacy hygiene debt.

It was not removed because this connector cannot verify that the equivalent Vercel project environment variables are configured; deleting it blindly could break preview/build runtime configuration.

Status: **PARTIAL hygiene; no secret rotation required from this finding.**

## Remaining closure blockers

1. Obtain/use non-production authenticated test sessions for Admin, Direksi, Management, Koordinator, Staff and Driver, then execute browser route/scope/realtime/cache E2E.
2. Create a disposable non-production saldo request and validate Finance mark-paid → RAOS readback.
3. Validate HRIS attendance/payroll write-readback with test records.
4. Synchronize repo GAS source with the deployed RPC implementation so GitHub becomes an accurate source copy again.
5. After the above passes, review the draft Driver master read-only SQL and apply only with explicit production authorization.
6. Then perform one batched merge/deploy per repo and production smoke test, only after explicit authorization.
