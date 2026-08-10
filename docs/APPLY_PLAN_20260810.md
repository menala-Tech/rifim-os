# Apply Plan — 17 Working Copies — 2026-08-10

## Strategy
Consolidate the 17 active working copies into one integration branch per repository instead of replaying obsolete layers as separate deployments. Preserve current `main` changes that are newer than the working copies.

## Superseded / inherited
- P8 V1: SKIP, superseded by P8 V2.
- P2, P4, P5: inherited by P6/P7 closure; used as audit provenance, not replayed after newer closure.
- P6/P7 standalone packages: inherited into final P7 cross-module release inside P8 V2; used as baseline/provenance.

## Current-main changes that must be preserved
### rifim-os
- portal true bottom-center login UI
- Finance light Maxim theme/sticky layout
- Finance Buka/Auto-Fill AIST
- desktop Notification API + repeating audio
- existing production fixes for Saldo/KPI

### raos-menala
- Role Sistem override + Jabatan fallback
- SOETA target inheritance
- offline read cache-first + OfflineBadge
- 5-minute Saldo reminder and `last_reminded_at`

## Final merge order
1. Current GitHub main as base.
2. Master Modules foundation.
3. Canonical Storage V4, then System Module V3 wins on overlapping System/Drive files.
4. HRIS target, contract activation, attendance rules, payroll V2.
5. Smart Office V2 canonical refactor.
6. Fase3 UI cache/driver lookup additions.
7. AIST portable agent additions.
8. P7 cross-module security/role/realtime/cache closure merged selectively over current-main features.
9. P8 V2 SQL/Edge cutover package and migration order retained.

## Git/Deploy plan
- Branch `integrate/working-copies-20260810` on each repo.
- One PR per repo to minimize Vercel deployment count.
- Local/static checks before PR.
- Squash merge after verification.
- Verify actual Vercel deployment state after merge.
- Supabase migration/Edge cutover follows P8 V2 zero-downtime order; credential finalization only after login exchange smoke test.

## Expected deployment count
- rifim-os: ~2 (preview + production)
- raos-menala: ~2 (preview + production)
