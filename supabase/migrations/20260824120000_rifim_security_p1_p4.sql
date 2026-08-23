-- RIFIM OS security hardening P1/P4.
-- This migration is intentionally privilege-only and must be applied through
-- the approved Supabase migration process; it is not executed by Codex.

begin;

-- P1: legacy Portal/RAOS login bridge remains available only to trusted
-- backend/service-role callers. Public browser clients must use the
-- raos-login-exchange Edge Function, which first calls the canonical bcrypt
-- verifier and only then uses this legacy bridge for compatibility rows.
revoke execute on function public.raos_verify_and_bridge(text, text) from public;
revoke execute on function public.raos_verify_and_bridge(text, text) from anon;
revoke execute on function public.raos_verify_and_bridge(text, text) from authenticated;
grant execute on function public.raos_verify_and_bridge(text, text) to service_role;

-- Keep the canonical verifier service-role only. This is repeated here as a
-- defensive assertion in case an older migration or manual grant widened it.
revoke execute on function public.raos_verify_login_secret(text, text) from public;
revoke execute on function public.raos_verify_login_secret(text, text) from anon;
revoke execute on function public.raos_verify_login_secret(text, text) from authenticated;
grant execute on function public.raos_verify_login_secret(text, text) to service_role;

-- P4: AIST invoice refresh helpers are SECURITY DEFINER internals. Trigger
-- execution does not require anon/authenticated EXECUTE grants, and trusted
-- service-role execution remains available for internal maintenance flows.
revoke execute on function public.aist_refresh_invoice_for_request_id(uuid) from public;
revoke execute on function public.aist_refresh_invoice_for_request_id(uuid) from anon;
revoke execute on function public.aist_refresh_invoice_for_request_id(uuid) from authenticated;
grant execute on function public.aist_refresh_invoice_for_request_id(uuid) to service_role;

revoke execute on function public.aist_invoice_refresh_job_trigger() from public;
revoke execute on function public.aist_invoice_refresh_job_trigger() from anon;
revoke execute on function public.aist_invoice_refresh_job_trigger() from authenticated;
grant execute on function public.aist_invoice_refresh_job_trigger() to service_role;

revoke execute on function public.aist_invoice_refresh_saldo_trigger() from public;
revoke execute on function public.aist_invoice_refresh_saldo_trigger() from anon;
revoke execute on function public.aist_invoice_refresh_saldo_trigger() from authenticated;
grant execute on function public.aist_invoice_refresh_saldo_trigger() to service_role;

commit;
