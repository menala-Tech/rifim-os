-- ============================================================================
-- rifim_002: HRIS insert contract for RAOS -> RIFIM employee sync
-- ============================================================================
--
-- Root cause:
--   public.employees requires company_code and join_date on every INSERT.
--   The RAOS consumer must NOT overwrite HRIS-owned fields on UPDATE, so the
--   PostgREST payload excludes them. This makes brand-new INSERT fail.
--
-- Architecture:
--   Do NOT use a global BEFORE INSERT trigger on public.employees.
--   Manual HRIS inserts must remain untouched.
--   RAOS sync uses a dedicated, service-invokable RPC that handles:
--     - existing employee: UPDATE only RAOS-owned fields
--     - new employee: lookup HRIS defaults, then INSERT
--
-- Canonical source:
--   - company_code: public.raos_hris_employee_defaults.company_code
--   - join_date:    public.raos_hris_employee_defaults.join_date
--
-- These fields are HRIS-owned. RIFIM must populate this mapping before the
-- first RAOS sync for a staff_id. If the mapping is missing, the new-employee
-- path raises a clear error.
--
-- Applies to PREVIEW ONLY. Do not apply to production until review.
-- ============================================================================

-- Remove any previous global-trigger design from this migration session.
DROP TRIGGER IF EXISTS trg_employee_hris_defaults ON public.employees;
DROP FUNCTION IF EXISTS public.raos_employee_hris_defaults_insert();
DROP TABLE IF EXISTS public.raos_staff_master_hris_defaults;

-- ============================================================================
-- 1. HRIS-owned defaults mapping table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.raos_hris_employee_defaults (
  staff_id         text                     PRIMARY KEY,
  company_code     text                     NOT NULL,
  join_date        date                     NOT NULL,
  employment_type  text                     NOT NULL DEFAULT 'PKWT',
  created_at       timestamp with time zone NOT NULL DEFAULT now(),
  updated_at       timestamp with time zone NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.raos_hris_employee_defaults IS
  'HRIS-owned canonical defaults for employees created from RAOS staff master (company_code, join_date, employment_type). RIFIM HRIS populates this before first sync.';

COMMENT ON COLUMN public.raos_hris_employee_defaults.company_code IS
  'Canonical company_code for this staff in HRIS. NOT owned by RAOS.';

COMMENT ON COLUMN public.raos_hris_employee_defaults.join_date IS
  'Canonical join_date for this staff in HRIS. NOT owned by RAOS.';

ALTER TABLE public.raos_hris_employee_defaults ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.raos_hris_employee_defaults FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.raos_hris_employee_defaults TO service_role;

DROP POLICY IF EXISTS "raos_hris_employee_defaults_service_all" ON public.raos_hris_employee_defaults;
CREATE POLICY "raos_hris_employee_defaults_service_all"
  ON public.raos_hris_employee_defaults
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 2. Dedicated RAOS -> HRIS upsert RPC
-- ============================================================================
CREATE OR REPLACE FUNCTION public.raos_hris_upsert_employees(p_records jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec              jsonb;
  v_employee_id    text;
  v_full_name      text;
  v_email          text;
  v_phone          text;
  v_branch         text;
  v_position       text;
  v_status         text;
  v_defaults       record;
  v_exists         boolean;
  v_inserted       int := 0;
  v_updated        int := 0;
  v_skipped        int := 0;
  v_errors         jsonb := '[]'::jsonb;
BEGIN
  FOR rec IN SELECT value FROM jsonb_array_elements(p_records) LOOP
    v_employee_id := rec->>'employee_id';
    IF v_employee_id IS NULL OR btrim(v_employee_id) = '' THEN
      v_skipped := v_skipped + 1;
      v_errors := v_errors || jsonb_build_object('employee_id', v_employee_id, 'error', 'missing employee_id');
      CONTINUE;
    END IF;

    v_full_name := rec->>'full_name';
    v_email     := rec->>'email';
    v_phone     := rec->>'phone';
    v_branch    := rec->>'branch';
    v_position  := rec->>'position';
    v_status    := rec->>'status';

    SELECT EXISTS(SELECT 1 FROM public.employees WHERE employee_id = v_employee_id) INTO v_exists;

    IF v_exists THEN
      UPDATE public.employees
         SET full_name  = v_full_name,
             email      = v_email,
             phone      = v_phone,
             branch     = v_branch,
             position   = v_position,
             status     = v_status,
             updated_at = now()
       WHERE employee_id = v_employee_id;

      v_updated := v_updated + 1;
    ELSE
      SELECT company_code, join_date, employment_type
        INTO v_defaults
        FROM public.raos_hris_employee_defaults
       WHERE staff_id = v_employee_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Missing HRIS defaults for employee %. Populate public.raos_hris_employee_defaults first.', v_employee_id
          USING ERRCODE = 'not_null_violation';
      END IF;

      INSERT INTO public.employees (
        employee_id,
        full_name,
        email,
        phone,
        branch,
        position,
        status,
        company_code,
        join_date,
        employment_type
      ) VALUES (
        v_employee_id,
        v_full_name,
        v_email,
        v_phone,
        v_branch,
        v_position,
        v_status,
        v_defaults.company_code,
        v_defaults.join_date,
        COALESCE(v_defaults.employment_type, 'PKWT')
      );

      v_inserted := v_inserted + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'inserted', v_inserted,
    'updated',  v_updated,
    'skipped',  v_skipped,
    'errors',   v_errors
  );
END;
$$;

COMMENT ON FUNCTION public.raos_hris_upsert_employees(jsonb) IS
  'Dedicated RAOS -> HRIS bulk upsert. Updates only RAOS-owned fields on existing employees; looks up HRIS defaults for new employees.';

REVOKE ALL ON FUNCTION public.raos_hris_upsert_employees(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.raos_hris_upsert_employees(jsonb) TO service_role;
