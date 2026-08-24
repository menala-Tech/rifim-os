-- ============================================================================
-- rifim_001: RIFIM OS consumer for RAOS staff master
-- ============================================================================
--
-- Depends on RAOS migration raos_116 (public.raos_staff_master).
-- Provides a read-only HRIS-facing view of activated staff.
--
-- Security:
--   - SECURITY INVOKER: true (default in PG 15+) so RLS of raos_staff_master
--     is respected for any caller.
--   - GRANT is restricted to service_role only; PWA/authenticated users must
--     NOT read this HRIS view directly.
--
-- Source-only migration for feature branch. Do not apply to production until
-- RAOS raos_116 has been applied and preview/UAT approved.
-- ============================================================================

-- View: HRIS-friendly projection of ACTIVATED master staff.
-- RIFIM GAS (service_role) reads this and upserts into employees.
CREATE OR REPLACE VIEW public.raos_staff_master_hris
  WITH (security_invoker = true) AS
SELECT
  staff_id                       AS employee_id,
  full_name,
  email,
  phone,
  (airport || ' ' || terminal)   AS branch,
  role                           AS position,
  'AKTIF'                        AS status,
  is_activated,
  auth_user_id,
  branch_id
FROM public.raos_staff_master
WHERE is_activated = true;

COMMENT ON VIEW public.raos_staff_master_hris IS
  'HRIS-facing view of activated staff master in RAOS. Restricted to service_role. RIFIM GAS reads and writes to employees.';

-- Only service role (RIFIM GAS) and admin roles already allowed by RLS may read.
-- Authenticated/PWA users are explicitly not granted.
GRANT SELECT ON public.raos_staff_master_hris TO service_role;
