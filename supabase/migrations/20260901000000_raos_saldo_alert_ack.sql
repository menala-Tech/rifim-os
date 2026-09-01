-- Finance saldo alert-acknowledgment log.
--
-- Owner complaint (audit 2026-09-01): pengajuan isi saldo sering tidak
-- terdengar. Root cause -- the browser fires _srBeep() fire-and-forget with
-- no record of whether an admin actually heard/saw it. The RAOS sheet's
-- "Alert Terkirim" / "Alert Terakhir" columns exist but are never written.
--
-- This migration adds the missing acknowledgment surface:
--   * raos_saldo_alert_ack: one row per (request, admin device) pair when the
--     admin clicks the toast/notification. Composite PK stops the same device
--     acking a request twice.
--   * raos_saldo_ack_alert(p_request_id, p_device_id, p_method): RPC the
--     Finance UI calls. SECURITY DEFINER + explicit search_path so the check
--     against user_profiles.role can't be short-circuited by a role that has
--     no direct INSERT on the table. Rejects non admin/direksi/management.
--
-- No column drop, no data mutation on raos_saldo_requests. Additive only.

create table if not exists public.raos_saldo_alert_ack (
  request_id uuid not null references public.raos_saldo_requests(id) on delete cascade,
  device_id text not null,
  acked_at timestamptz not null default now(),
  acked_by uuid references public.user_profiles(id) on delete set null,
  ack_method text not null check (ack_method in ('click','notification','keyboard')),
  primary key (request_id, device_id)
);

comment on table public.raos_saldo_alert_ack is
  'One row per (saldo request, admin device) once an admin acknowledges the alert (clicks toast/notification). Escalation sweep uses absence of a row as "still unheard".';

create index if not exists idx_raos_saldo_alert_ack_request
  on public.raos_saldo_alert_ack (request_id);
create index if not exists idx_raos_saldo_alert_ack_acked_at
  on public.raos_saldo_alert_ack (acked_at desc);

alter table public.raos_saldo_alert_ack enable row level security;

-- Reads: any active admin/direksi/management can see who ack'd what. Used
-- by the escalation sweep and by the UI's "seen by" hover.
drop policy if exists raos_saldo_alert_ack_read on public.raos_saldo_alert_ack;
create policy raos_saldo_alert_ack_read
  on public.raos_saldo_alert_ack
  for select
  to authenticated
  using (
    exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid()
        and up.is_active = true
        and up.role in ('admin','direksi','management','direktur')
    )
  );

-- Writes: RPC-only. Direct INSERT is denied so nobody can spoof an ack for
-- another device.
revoke insert, update, delete on public.raos_saldo_alert_ack from anon, authenticated;

create or replace function public.raos_saldo_ack_alert(
  p_request_id uuid,
  p_device_id  text,
  p_method     text default 'click'
)
returns table (
  request_id uuid,
  device_id  text,
  acked_at   timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_active boolean;
begin
  if p_request_id is null then
    raise exception 'request_id_required' using errcode = '22023';
  end if;
  if p_device_id is null or length(trim(p_device_id)) = 0 then
    raise exception 'device_id_required' using errcode = '22023';
  end if;
  if p_method not in ('click','notification','keyboard') then
    raise exception 'invalid_method' using errcode = '22023';
  end if;

  select up.role, up.is_active
    into v_role, v_active
  from public.user_profiles up
  where up.id = auth.uid();

  if v_role is null or v_active is not true then
    raise exception 'role_not_allowed' using errcode = '42501';
  end if;
  if v_role not in ('admin','direksi','management','direktur') then
    raise exception 'role_not_allowed' using errcode = '42501';
  end if;

  return query
  insert into public.raos_saldo_alert_ack (request_id, device_id, acked_by, ack_method)
  values (p_request_id, p_device_id, auth.uid(), p_method)
  on conflict (request_id, device_id) do update
    set acked_at = excluded.acked_at,
        ack_method = excluded.ack_method,
        acked_by = excluded.acked_by
  returning raos_saldo_alert_ack.request_id,
            raos_saldo_alert_ack.device_id,
            raos_saldo_alert_ack.acked_at;
end;
$$;

revoke execute on function public.raos_saldo_ack_alert(uuid, text, text) from public, anon;
grant execute on function public.raos_saldo_ack_alert(uuid, text, text) to authenticated;

comment on function public.raos_saldo_ack_alert(uuid, text, text) is
  'Finance admin acks a saldo-request alert. RLS via SECURITY DEFINER + explicit role gate; direct INSERT on raos_saldo_alert_ack is revoked so this is the only write path.';
