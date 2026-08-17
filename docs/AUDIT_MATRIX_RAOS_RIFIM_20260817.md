# RAOS + RIFIM OS — Full Audit Matrix

Date: 2026-08-17
Branch: `audit-full-sync-20260817`

## Baseline

- RAOS source main baseline: `bb14ed6ef2ef5506e86232b8e7be055e28e19d3c`
- RIFIM OS source main baseline: `849ac2c4766c2b95fac7b797f3de012fee7e6de5`
- Production mutation/deploy/migration: NOT PERFORMED in this audit branch.
- Status vocabulary: PASS / PARTIAL / FAIL / BLOCKED.

## Audit rules

PASS requires source contract to be internally consistent for the audited dimension. Full E2E PASS still requires authenticated runtime tests, write/read-back where applicable, realtime/cache verification, and production-version reconciliation.

## RAOS route matrix — source audit pass 1

| MODULE | TAB/ROUTE | UI | API | AUTH | ROLE | DATA | E2E | STATUS | FINDING |
|---|---|---|---|---|---|---|---|---|---|
| RAOS | `/` | PASS | PASS | PASS | PARTIAL | PASS | BLOCKED | PARTIAL | Login route exists; full role matrix runtime test pending. |
| RAOS | `/dashboard` | PASS | PASS | PASS | PARTIAL | PASS | BLOCKED | PARTIAL | Route exists; deep role/navigation runtime test pending. |
| RAOS | `/scan` | PASS | PASS | PASS | PARTIAL | PASS | BLOCKED | PARTIAL | Operational scan engine present; E2E not rerun in this branch. |
| RAOS | `/absensi` | PASS | PASS | PASS | PARTIAL | PASS | BLOCKED | PARTIAL | Attendance source present; cross-module HRIS read-back pending. |
| RAOS | `/riwayat` | PASS | PASS | PASS | PARTIAL | PASS | BLOCKED | PARTIAL | Large live history implementation present; cache/realtime E2E pending. |
| RAOS | `/chat` | PASS | PASS | PASS | PARTIAL | PASS | BLOCKED | PARTIAL | Chat implementation present; role/scope/realtime E2E pending. |
| RAOS | `/settings` | PASS | PASS | PASS | PARTIAL | PASS | BLOCKED | PARTIAL | Shift roster implementation present; full role test pending. |
| RAOS | `/admin` | PASS | PARTIAL | PASS | FAIL | FAIL | BLOCKED | FAIL | Direct `user_profiles` mutation controls remain; Staff SSOT ownership conflict/stale RLS-denied UI. |
| RAOS | `/admin/barcodes` | PASS | PASS | PASS | PARTIAL | PASS | BLOCKED | PARTIAL | Reads canonical Driver source; runtime role test pending. |
| RAOS | `/validasi-saldo` | PASS | PASS | PASS | PASS | PASS | BLOCKED | PARTIAL | Source is view-only; Finance owns mark-paid; realtime refresh present. Runtime E2E pending. |
| RAOS | `/antrian-driver` | PASS | PASS | PASS | PARTIAL | PASS | BLOCKED | PARTIAL | Queue engine exists; scope/runtime test pending. |
| RAOS | `/kpi` | PASS | PASS | PASS | PARTIAL | PASS | BLOCKED | PARTIAL | Canonical KPI helpers present; reconciliation with payroll pending. |
| RAOS | `/laporan` | PASS | PASS | PASS | PARTIAL | PASS | BLOCKED | PARTIAL | Route exists; data/export runtime test pending. |
| RAOS | `/status` | PASS | PASS | PASS | PARTIAL | PASS | BLOCKED | PARTIAL | Integration health source exists; version reconciliation incomplete. |
| RAOS | `/drivers` | PASS | FAIL | PASS | FAIL | FAIL | BLOCKED | FAIL | Reads `raos_drivers` correctly but source still contains direct master insert/update path. Branch policy patch removes `driver:mutate` grants so UI fails closed; dead writer code still needs removal. |
| RAOS | `/notifications` | PASS | PASS | PASS | PARTIAL | PASS | BLOCKED | PARTIAL | Notification engine UI exists; push E2E pending. |
| RAOS | `/settings/bantuan` | PASS | N/A | PASS | PARTIAL | N/A | BLOCKED | PARTIAL | Route exists; navigation/mobile test pending. |
| RAOS | `/reset-password` | PASS | PARTIAL | PARTIAL | PARTIAL | PARTIAL | BLOCKED | PARTIAL | Route exists; credential bridge/reset contract requires dedicated audit. |
| RAOS | `/driver-workspace` | PASS | PASS | PASS | PARTIAL | PASS | BLOCKED | PARTIAL | Driver workspace implementation exists; self-scope E2E pending. |

## RIFIM OS matrix — source audit pass 1

| MODULE | TAB | UI | API | AUTH | ROLE | DATA | E2E | STATUS | FINDING |
|---|---|---|---|---|---|---|---|---|---|
| PORTAL | Canonical Login/Session | PASS | PASS | PASS | PASS | PASS | BLOCKED | PARTIAL | Shared Supabase token validation/refresh exists; expired-session browser E2E pending. |
| HRIS | Karyawan | PASS | PASS | PASS | PARTIAL | PASS | BLOCKED | PARTIAL | CRUD paths exist; branch now fail-closes critical mutations. |
| HRIS | Kontrak | PASS | PASS | PASS | PASS | PASS | BLOCKED | PARTIAL | `add_contract` is mutation-guarded; E2E pending. |
| HRIS | Absensi | PASS | PASS | PASS | PASS | PASS | BLOCKED | PARTIAL | `add_attendance` was missing from shared guard; fixed in audit branch commit `5a6669f`. Runtime E2E pending. |
| HRIS | Cuti | PASS | PASS | PASS | PASS | PASS | BLOCKED | PARTIAL | `canUserApprove()` is canonical Admin/Direksi; approve mutation guarded. |
| HRIS | Payroll | PASS | PASS | PASS | PASS | PASS | BLOCKED | PARTIAL | Canonical `autofillPotonganFromAbsensi` caller/function already match; payroll read-back/finalize E2E pending. |
| CRM | Company Config | PARTIAL | PARTIAL | PASS | PASS | PARTIAL | BLOCKED | PARTIAL | UI still contains stale TODO/write-path copy; backend must be matched before cleanup. |
| CRM | System Config | PASS | FAIL | PASS | PASS | FAIL | BLOCKED | FAIL | Supabase write followed by Sheet sync fire-and-forget; UI can report success while mirror failed. Must change to write→mirror→verify→success or durable outbox. |
| CRM | Whitelist Portal | PARTIAL | PARTIAL | PASS | PARTIAL | PARTIAL | BLOCKED | PARTIAL | Copy/legacy assumptions require reconciliation with canonical Portal Auth. |
| CRM | User Supabase RAOS | PARTIAL | PARTIAL | PASS | PARTIAL | FAIL | BLOCKED | FAIL | Potential Staff SSOT dual-writer surface; must not mutate canonical Staff identity outside SSOT flow. |
| CRM | Kontak Eksternal | PARTIAL | PARTIAL | PASS | PARTIAL | PARTIAL | BLOCKED | PARTIAL | Endpoint/data audit pending. |
| CRM | Audit Log | PARTIAL | PARTIAL | PASS | PARTIAL | PARTIAL | BLOCKED | PARTIAL | Endpoint/data audit pending. |
| FINANCE | Dashboard | PARTIAL | PARTIAL | PASS | PASS | PARTIAL | BLOCKED | PARTIAL | Stale TODO/placeholder audit still needed against existing backend actions. |
| FINANCE | Per Cabang | PARTIAL | PARTIAL | PASS | PASS | PARTIAL | BLOCKED | PARTIAL | Backend wiring audit pending. |
| FINANCE | Tagihan | PARTIAL | PARTIAL | PASS | PASS | PARTIAL | BLOCKED | PARTIAL | Known backend actions exist; frontend completeness audit pending. |
| FINANCE | Rekap Harian/Bulanan | FAIL | PARTIAL | PASS | PASS | PARTIAL | BLOCKED | FAIL | Source contains visible TODO/unimplemented copy; must wire existing canonical backend if available. |
| FINANCE | Isi Saldo RAOS | PASS | PASS | PASS | PASS | PASS | BLOCKED | PARTIAL | Skip-approval contract represented; mark-paid E2E + RAOS read-back pending. |
| FINANCE | Target Cabang | PASS | PASS | PASS | PASS | PASS | BLOCKED | PARTIAL | UI/RPC present; runtime mutation/read-back pending. |
| FINANCE | Target Staff | PASS | PASS | PASS | PASS | PASS | BLOCKED | PARTIAL | UI/data present; payroll reconciliation pending. |
| FINANCE | DB Driver | PASS | PASS | PASS | PASS | PASS | BLOCKED | PARTIAL | Role UI canonical Admin/Direksi; Management/Koordinator read-only. Runtime role test pending. |
| SMART OFFICE | Buat Dokumen | PARTIAL | PARTIAL | PASS | PARTIAL | PARTIAL | BLOCKED | PARTIAL | Canonical Portal boot exists; sensitive API method normalization still needs audit. |
| SMART OFFICE | Arsip | PARTIAL | PARTIAL | PASS | PARTIAL | PARTIAL | BLOCKED | PARTIAL | Runtime/API contract audit pending. |
| SMART OFFICE | Penomoran | PARTIAL | PARTIAL | PASS | PARTIAL | PARTIAL | BLOCKED | PARTIAL | Runtime/API contract audit pending. |
| SMART OFFICE | Pengaturan | STALE | PARTIAL | PASS | PARTIAL | PARTIAL | BLOCKED | PARTIAL | Legacy `ALLOWED_EMAILS` data/settings remain although login now redirects to Portal; no active bypass found in source boot. |
| SISTEM | Health/Sync/Audit/Recovery | PARTIAL | PARTIAL | PARTIAL | PARTIAL | PARTIAL | BLOCKED | PARTIAL | Existing System V3 must be audited, not replaced. Version/deployment reconciliation pending. |

## P0 findings verified from source

1. **HRIS mutation gap** — `add_attendance` was a real POST mutation but omitted from shared fail-close guard. Patched on audit branch only.
2. **RAOS Driver second-writer surface** — `/drivers` still contains direct `raos_drivers.insert/update`; branch access policy now grants no `driver:mutate` capability to Admin/Direksi/Direktur. Queue operations remain separate.
3. **CRM critical mirror sync** — System Config still performs Sheet sync fire-and-forget and reports Supabase success without mirror verification. Not fixed yet; next P0 patch.
4. **Smart Office legacy auth residue** — canonical Portal session boot is active and `doLogin()` redirects to `/portal`, but `ALLOWED_EMAILS` and settings rendering remain stale. Treat as stale cleanup, not an active auth bypass unless deeper handler audit proves otherwise.
5. **GAS source/version drift** — repository Driver Airport/External GAS currently writes canonical `raos_drivers` through service-credential REST bulk upsert, while newer operational handoff describes an RPC-based sync. Do not rewrite a PASS flow; reconcile deployed GAS version/source before backend hardening.

## Branch-only changes so far

### RIFIM OS
- `shared/portal-session.js`: add `add_attendance` to HRIS guarded POST mutations.
- Commit: `5a6669f964c849e9a961133becf5c3ea2635b5a5`

### RAOS
- `apps/pwa/src/lib/accessPolicy.ts`: remove `driver:mutate` grants from Admin/Direksi/Direktur; PWA master Driver management fails closed while queue capabilities remain.
- Commit: `404d304cb642adde48675f999b30452651c901e4`

## Next P0 work

1. CRM System Config: replace fire-and-forget mirror sync with verified synchronous mirror or durable outbox using existing canonical endpoints.
2. RAOS `/drivers`: remove dead Add/Edit master writer implementation, not only hide it by policy.
3. RAOS `/admin`: remove/replace direct Staff identity mutation controls that conflict with MASTER DATA STAFF SSOT; do not loosen `user_profiles` RLS.
4. Reconcile deployed GAS Driver writer version before drafting RLS hardening migration.
5. Continue route-by-route role/RLS/query/mutation/realtime/cache audit and browser E2E in non-production environment.
