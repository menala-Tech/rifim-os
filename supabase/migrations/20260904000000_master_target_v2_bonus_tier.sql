-- 2026-09-04: MASTER TARGET v2 — split mode per axis + bonus tier
-- APPLIED KE PROD 2026-09-04 via Supabase MCP apply_migration (project vlievtojpmrbsmzlqswl).
-- File ini record-only, tidak akan di-re-apply karena kolom-nya sudah exist.
--
-- SSoT bergeser dari RAOS Master 1eYS (OLD 4-kolom) ke DATABASE STAFF 1fcraq3
-- (NEW 6-kolom: Cabang, Target Cabang, Target Staff, Bonus Tier 1, Bonus Tier 2, Bulan Aktif).
-- Soeta tetap fallback via RAOS Master 1eYS (row satu-satunya yg belum di-migrate).
--
-- Tier semantics (owner decision 2026-09-04):
--   Tier 1 = staff hit target_staff  → bonus_tier_1 per staff
--   Tier 2 = cabang hit target_cabang → bonus_tier_2 tambahan per staff
--
-- Mode axes:
--   mode_cabang = unit target_cabang (saldo | order | scan)
--   mode_staff  = unit target_staff  (saldo | order | scan)
--   Contoh Makassar: mode_cabang='order' (5000 order), mode_staff='scan' (455 scan).
--
-- Backcompat: kolom `mode` lama dipertahankan; writer mirror ke mode_cabang.
ALTER TABLE public.raos_kpi_targets_branch
  ADD COLUMN IF NOT EXISTS target_staff  bigint,
  ADD COLUMN IF NOT EXISTS bonus_tier_1  numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus_tier_2  numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mode_cabang   text,
  ADD COLUMN IF NOT EXISTS mode_staff    text;

-- Backfill mode_cabang untuk row existing supaya query PWA yang pindah ke
-- mode_cabang tidak melihat NULL setelah writer switch.
UPDATE public.raos_kpi_targets_branch
  SET mode_cabang = mode
  WHERE mode_cabang IS NULL;

COMMENT ON COLUMN public.raos_kpi_targets_branch.target_staff  IS 'Target per-staff numerik (unit di mode_staff). NULL kalau sheet cabang belum set target staff.';
COMMENT ON COLUMN public.raos_kpi_targets_branch.bonus_tier_1  IS 'Bonus staff kalau realisasi >= target_staff (Rupiah).';
COMMENT ON COLUMN public.raos_kpi_targets_branch.bonus_tier_2  IS 'Bonus tambahan per-staff kalau cabang capai target_cabang (Rupiah).';
COMMENT ON COLUMN public.raos_kpi_targets_branch.mode_cabang   IS 'Unit target_cabang: saldo | order | scan.';
COMMENT ON COLUMN public.raos_kpi_targets_branch.mode_staff    IS 'Unit target_staff:  saldo | order | scan.';
