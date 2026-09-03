-- ─────────────────────────────────────────────────────────────────────────────
-- 20260903_admin_direksi_delete_policies
-- Owner 2026-09-03: rapikan permission DELETE di semua tabel bisnis.
--
-- Sebelum: 22 tabel bisnis (raos_*, doc_*, crm_*, branches) RLS-enabled tapi
-- TIDAK punya policy DELETE apapun → deny-all default, termasuk Admin gagal
-- senyap. Sisanya 3 tabel (raos_attendance, scan_orders, doc_documents) punya
-- policy campur admin+direksi+direktur (direktur = dead string, sudah
-- normalize ke direksi via master-role-policy.js).
--
-- Sesudah: Admin+Direksi bisa hapus 21 tabel bisnis. Chat pribadi user tetap
-- delete-scope milik sendiri (tidak diubah). Audit/log tables tetap
-- append-only (crm_audit_log, doc_audit_log, raos_shift_schedule_edit_log,
-- raos_saldo_alert_ack, raos_background_location_points). user_profiles
-- sengaja dilewat (approval khusus, cascade risk ke Supabase Auth).
--
-- Applied di PROD (vlievtojpmrbsmzlqswl) via Supabase MCP apply_migration
-- pada 2026-09-03. File ini dicommit sebagai record.
-- ─────────────────────────────────────────────────────────────────────────────

-- A. Cleanup: hapus dead 'direktur' string dari existing policies
drop policy if exists "raos_attendance_admin_delete" on public.raos_attendance;
create policy "raos_attendance_admin_delete" on public.raos_attendance
  for delete to authenticated
  using (get_my_role() = any (array['admin','direksi']));

drop policy if exists "scan_orders_admin_delete" on public.scan_orders;
create policy "scan_orders_admin_delete" on public.scan_orders
  for delete to authenticated
  using (get_my_role() = any (array['admin','direksi']));

-- B. Add admin+direksi DELETE policy ke 19 tabel bisnis (deny-all sebelumnya)
do $$
declare
  tbl text;
  tables text[] := array[
    'branches',
    'crm_contacts',
    'doc_approval_rules',
    'doc_approvals',
    'doc_revisions',
    'raos_drivers',
    'raos_driver_queue',
    'raos_driver_ssot_records',
    'raos_driver_staff_assignment',
    'raos_hris_employee_defaults',
    'raos_kpi_targets_branch',
    'raos_kpi_targets_staff',
    'raos_payroll',
    'raos_saldo_requests',
    'raos_shift_schedules',
    'raos_soeta_kpi_manual_inputs',
    'raos_soeta_staff_sheet_mirror',
    'raos_staff_master',
    'raos_staff_ssot_records'
  ];
begin
  foreach tbl in array tables loop
    execute format(
      'drop policy if exists %I on public.%I',
      tbl || '_admin_direksi_delete', tbl
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (get_my_role() = any (array[''admin'',''direksi'']))',
      tbl || '_admin_direksi_delete', tbl
    );
  end loop;
end $$;
