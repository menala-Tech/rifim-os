-- Safe non-destructive maintenance state for Finance Isi Saldo.
alter table public.raos_saldo_requests
  add column if not exists is_archived boolean not null default false,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.user_profiles(id) on delete set null;

create index if not exists idx_raos_saldo_requests_active_created
  on public.raos_saldo_requests (created_at desc)
  where is_archived=false;

comment on column public.raos_saldo_requests.is_archived is
  'Non-destructive Finance maintenance flag. Archived rows remain in history and keep AIST dependencies.';
comment on column public.raos_saldo_requests.archived_at is
  'Timestamp when Finance archived/hidden this request.';
comment on column public.raos_saldo_requests.archived_by is
  'Actor profile that archived/hidden this request.';
