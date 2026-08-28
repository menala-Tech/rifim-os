-- RIFIM OS combined hardening: operations audit + safe HRIS activation/reconciliation.
-- Preview/QA first. Production only after owner approval.

create table if not exists public.rifim_ops_audit_log (
  id bigserial primary key,
  actor_id uuid,
  actor_role text not null,
  operation text not null,
  module text not null,
  scope jsonb not null default '{}'::jsonb,
  affected_rows integer not null default 0,
  success boolean not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.rifim_ops_audit_log enable row level security;
revoke all on public.rifim_ops_audit_log from public, anon, authenticated;
grant select, insert on public.rifim_ops_audit_log to service_role;

comment on table public.rifim_ops_audit_log is
  'Server/definer-written operational audit for maintenance, staff sync, activation and reconciliation. Never store tokens or secrets.';

create or replace function public.hris_activate_employee(p_employee_id text)
returns public.employees
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_actor uuid;
  e public.employees;
  c public.employee_contracts;
  s public.raos_staff_ssot_records;
  v_path text;
begin
  v_role := lower(public.get_my_role());
  v_actor := auth.uid();

  if v_actor is null or v_role not in ('admin','direksi','direktur') then
    raise exception 'write_permission_required';
  end if;

  if nullif(btrim(p_employee_id),'') is null then
    raise exception 'employee_id_required';
  end if;

  select * into e
  from public.employees
  where upper(employee_id)=upper(btrim(p_employee_id))
  for update;

  if not found then
    raise exception 'employee_not_found';
  end if;

  -- Path A: canonical SSOT staff. No manual HRIS contract is required when
  -- the canonical identity is active, conflict-free and safely mapped.
  select * into s
  from public.raos_staff_ssot_records x
  where upper(x.staff_id)=upper(e.employee_id)
    and x.status_active is true
    and x.conflict_status='none'
    and nullif(btrim(x.staff_id),'') is not null
    and x.resolved_role in ('staff','koordinator','admin','management','direksi','driver_manager')
    and (
      x.branch_id is not null
      or upper(coalesce(x.legacy_branch_name,'')) in ('ADMIN','HEAD OFFICE')
    )
    and lower(btrim(coalesce(x.full_name,''))) = lower(btrim(coalesce(e.full_name,'')))
    and (
      nullif(btrim(x.email),'') is null
      or nullif(btrim(e.email),'') is null
      or lower(btrim(x.email)) = lower(btrim(e.email))
    )
  order by x.imported_at desc nulls last, x.id desc
  limit 1;

  if found then
    v_path := 'ssot';
  else
    -- Path B: manual / non-SSOT employee. Existing validated contract guard
    -- remains mandatory and unchanged in strength.
    select * into c
    from public.employee_contracts
    where upper(employee_id)=upper(e.employee_id)
      and validation_status='validated'
      and status='AKTIF'
      and (start_date is null or start_date<=current_date)
      and (end_date is null or end_date>=current_date)
    order by start_date desc nulls last, updated_at desc
    limit 1;

    if not found then
      raise exception 'validated_active_contract_required';
    end if;

    v_path := 'contract';
  end if;

  update public.employees
  set status='AKTIF',
      activation_state='active',
      activation_ready=true,
      activated_at=now(),
      activated_by=v_actor,
      activation_contract_id=case when v_path='contract' then c.id else null end,
      updated_at=now()
  where id=e.id
  returning * into e;

  -- Only keep an already-existing auth/profile mapping consistent.
  -- SSOT-owned identity fields are never changed here.
  update public.user_profiles
  set is_active=true,
      updated_at=now()
  where upper(coalesce(staff_id,''))=upper(e.employee_id)
    and is_active is distinct from true;

  insert into public.employee_sync_outbox(employee_id,event_type,role,branch,branch_id,payload)
  values(
    e.employee_id,
    'employee_activated',
    lower(coalesce(e.position,'')),
    e.branch,
    e.branch_id,
    jsonb_build_object('employee',to_jsonb(e),'activation_path',v_path)
  );

  insert into public.rifim_ops_audit_log(
    actor_id,actor_role,operation,module,scope,affected_rows,success,detail
  ) values (
    v_actor,v_role,'activate_employee','hris',
    jsonb_build_object('employee_id',e.employee_id),
    1,true,
    jsonb_build_object('activation_path',v_path)
  );

  return e;
end
$$;

revoke all on function public.hris_activate_employee(text) from public, anon;
grant execute on function public.hris_activate_employee(text) to authenticated;

create or replace function public.hris_reconcile_activation_states(p_apply boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_actor uuid;
  v_before integer := 0;
  v_ssot integer := 0;
  v_contract integer := 0;
  v_unresolved integer := 0;
  v_after integer := 0;
begin
  v_role := lower(public.get_my_role());
  v_actor := auth.uid();

  if v_actor is null or v_role not in ('admin','direksi','direktur') then
    raise exception 'write_permission_required';
  end if;

  select count(*) into v_before
  from public.employees e
  where e.status='AKTIF' and coalesce(e.activation_state,'')<>'active';

  with inconsistent as (
    select e.*
    from public.employees e
    where e.status='AKTIF' and coalesce(e.activation_state,'')<>'active'
  ),
  eligible_ssot as (
    select distinct on (e.id) e.id
    from inconsistent e
    join public.raos_staff_ssot_records s
      on upper(s.staff_id)=upper(e.employee_id)
    where s.status_active is true
      and s.conflict_status='none'
      and nullif(btrim(s.staff_id),'') is not null
      and s.resolved_role in ('staff','koordinator','admin','management','direksi','driver_manager')
      and (s.branch_id is not null or upper(coalesce(s.legacy_branch_name,'')) in ('ADMIN','HEAD OFFICE'))
      and lower(btrim(coalesce(s.full_name,'')))=lower(btrim(coalesce(e.full_name,'')))
      and (
        nullif(btrim(s.email),'') is null
        or nullif(btrim(e.email),'') is null
        or lower(btrim(s.email))=lower(btrim(e.email))
      )
    order by e.id,s.imported_at desc nulls last,s.id desc
  ),
  eligible_contract as (
    select distinct e.id
    from inconsistent e
    join public.employee_contracts c
      on upper(c.employee_id)=upper(e.employee_id)
    where c.validation_status='validated'
      and c.status='AKTIF'
      and (c.start_date is null or c.start_date<=current_date)
      and (c.end_date is null or c.end_date>=current_date)
  )
  select
    (select count(*) from eligible_ssot),
    (select count(*) from eligible_contract ec where not exists(select 1 from eligible_ssot es where es.id=ec.id))
  into v_ssot,v_contract;

  v_unresolved := greatest(v_before-v_ssot-v_contract,0);

  if p_apply then
    with eligible_ssot as (
      select distinct on (e.id) e.id
      from public.employees e
      join public.raos_staff_ssot_records s
        on upper(s.staff_id)=upper(e.employee_id)
      where e.status='AKTIF'
        and coalesce(e.activation_state,'')<>'active'
        and s.status_active is true
        and s.conflict_status='none'
        and nullif(btrim(s.staff_id),'') is not null
        and s.resolved_role in ('staff','koordinator','admin','management','direksi','driver_manager')
        and (s.branch_id is not null or upper(coalesce(s.legacy_branch_name,'')) in ('ADMIN','HEAD OFFICE'))
        and lower(btrim(coalesce(s.full_name,'')))=lower(btrim(coalesce(e.full_name,'')))
        and (
          nullif(btrim(s.email),'') is null
          or nullif(btrim(e.email),'') is null
          or lower(btrim(s.email))=lower(btrim(e.email))
        )
      order by e.id,s.imported_at desc nulls last,s.id desc
    )
    update public.employees e
    set activation_state='active',
        activation_ready=true,
        activated_at=coalesce(e.activated_at,now()),
        activated_by=coalesce(e.activated_by,v_actor),
        activation_contract_id=null,
        updated_at=now()
    where e.id in (select id from eligible_ssot);

    with eligible_contract as (
      select distinct on (e.id) e.id,c.id contract_id
      from public.employees e
      join public.employee_contracts c
        on upper(c.employee_id)=upper(e.employee_id)
      where e.status='AKTIF'
        and coalesce(e.activation_state,'')<>'active'
        and c.validation_status='validated'
        and c.status='AKTIF'
        and (c.start_date is null or c.start_date<=current_date)
        and (c.end_date is null or c.end_date>=current_date)
      order by e.id,c.start_date desc nulls last,c.updated_at desc
    )
    update public.employees e
    set activation_state='active',
        activation_ready=true,
        activated_at=coalesce(e.activated_at,now()),
        activated_by=coalesce(e.activated_by,v_actor),
        activation_contract_id=ec.contract_id,
        updated_at=now()
    from eligible_contract ec
    where e.id=ec.id and coalesce(e.activation_state,'')<>'active';

    update public.user_profiles p
    set is_active=true,updated_at=now()
    where exists (
      select 1 from public.employees e
      where upper(e.employee_id)=upper(coalesce(p.staff_id,''))
        and e.status='AKTIF' and e.activation_state='active'
    )
    and p.is_active is distinct from true;
  end if;

  select count(*) into v_after
  from public.employees e
  where e.status='AKTIF' and coalesce(e.activation_state,'')<>'active';

  insert into public.rifim_ops_audit_log(
    actor_id,actor_role,operation,module,scope,affected_rows,success,detail
  ) values (
    v_actor,v_role,
    case when p_apply then 'reconcile_activation_apply' else 'reconcile_activation_preview' end,
    'hris',
    jsonb_build_object('apply',p_apply),
    case when p_apply then v_before-v_after else 0 end,
    true,
    jsonb_build_object(
      'before_count',v_before,
      'reconciled_ssot',v_ssot,
      'reconciled_contract',v_contract,
      'unresolved',v_unresolved,
      'after_count',v_after
    )
  );

  return jsonb_build_object(
    'before_count',v_before,
    'reconciled_ssot',v_ssot,
    'reconciled_contract',v_contract,
    'unresolved',v_unresolved,
    'after_count',v_after,
    'applied',p_apply
  );
end
$$;

revoke all on function public.hris_reconcile_activation_states(boolean) from public, anon;
grant execute on function public.hris_reconcile_activation_states(boolean) to authenticated;
