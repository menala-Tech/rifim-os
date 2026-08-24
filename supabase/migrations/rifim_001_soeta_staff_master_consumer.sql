-- ============================================================================
-- rifim_001: RIFIM OS consumer for RAOS SOETA staff master
-- ============================================================================
--
-- Depends on RAOS migration raos_116 (public.raos_staff_master).
-- Provides a read-only HRIS-facing view of activated SOETA staff.
--
-- Source-only migration for feature branch. Do not apply to production until
-- RAOS raos_116 has been applied and preview/UAT approved.
-- ============================================================================

-- View: HRIS-friendly projection of ACTIVATED SOETA master staff.
-- Service role (RIFIM GAS) reads this and upserts into employees.
CREATE OR REPLACE VIEW public.raos_staff_master_hris AS
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
  'HRIS-facing view of activated SOETA staff master in RAOS. RIFIM GAS reads and writes to employees.';

GRANT SELECT ON public.raos_staff_master_hris TO authenticated, service_role;
