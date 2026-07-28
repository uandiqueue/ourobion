-- Issue #182: truthful lifecycle semantics for every nao control mutation.
-- Applied migrations stay immutable; this file strengthens the R4-U2 table additively.

alter table public.nao_control_events
  add column operation_id uuid not null default gen_random_uuid(),
  add column phase text not null default 'legacy_unverified',
  add column error_code text;

-- Existing one-row events did not prove that their mutations completed. Keep that uncertainty
-- explicit, then require every new writer to supply an operation id and lifecycle phase.
alter table public.nao_control_events
  alter column operation_id drop default,
  alter column phase drop default,
  add constraint nao_control_events_phase_check
    check (phase in ('legacy_unverified', 'attempted', 'succeeded', 'failed')),
  add constraint nao_control_events_error_code_check check (
    (phase = 'failed' and error_code is not null and error_code ~ '^[a-z][a-z0-9_]{2,63}$')
    or (phase <> 'failed' and error_code is null)
  ),
  add constraint nao_control_events_detail_object_check
    check (jsonb_typeof(detail) = 'object');

create unique index nao_control_events_operation_phase_idx
  on public.nao_control_events (actor_user_id, operation_id, phase)
  where phase <> 'legacy_unverified';

create unique index nao_control_events_one_outcome_idx
  on public.nao_control_events (actor_user_id, operation_id)
  where phase in ('succeeded', 'failed');

-- The original trigger remains the attribution boundary. Outcomes additionally require a
-- matching durable attempt, and must keep its action/target. This blocks orphan or rewritten
-- success records even through direct PostgREST inserts.
create or replace function public.nao_stamp_control_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_attempt public.nao_control_events%rowtype;
begin
  new.actor_user_id := auth.uid();
  if new.actor_user_id is null then
    raise exception 'nao_control_events requires an authenticated actor' using errcode = '42501';
  end if;
  new.actor_role := public.nao_role();
  if new.actor_role is null then
    raise exception 'nao_control_events requires an effective nao membership' using errcode = '42501';
  end if;
  new.occurred_at := now();

  if new.phase in ('succeeded', 'failed') then
    select * into v_attempt
      from public.nao_control_events
     where actor_user_id = new.actor_user_id
       and operation_id = new.operation_id
       and phase = 'attempted';
    if not found then
      raise exception 'control outcome requires a durable attempt' using errcode = '23514';
    end if;
    if v_attempt.action <> new.action or v_attempt.target is distinct from new.target then
      raise exception 'control outcome does not match its attempt' using errcode = '23514';
    end if;
  end if;
  return new;
end
$$;

-- Idempotent append primitive for external effects. SECURITY INVOKER is explicit: the caller's
-- grants, curator policy, auth.uid(), and attribution trigger all remain in force.
create or replace function public.nao_record_control_event(
  p_operation_id uuid,
  p_action text,
  p_phase text,
  p_target text default null,
  p_detail jsonb default '{}'::jsonb,
  p_error_code text default null
)
returns boolean
language plpgsql
volatile
security invoker
set search_path = public, pg_temp
as $$
declare
  v_inserted boolean := false;
begin
  if p_phase not in ('attempted', 'succeeded', 'failed') then
    raise exception 'invalid control-event phase' using errcode = '23514';
  end if;
  insert into public.nao_control_events
    (operation_id, phase, action, target, detail, error_code)
  values
    (p_operation_id, p_phase, p_action, p_target, coalesce(p_detail, '{}'::jsonb), p_error_code)
  on conflict do nothing
  returning true into v_inserted;
  return coalesce(v_inserted, false);
end
$$;

revoke all on function public.nao_record_control_event(uuid, text, text, text, jsonb, text)
  from public, anon, service_role;
grant execute on function public.nao_record_control_event(uuid, text, text, text, jsonb, text) to authenticated;

-- Closed transactional boundary for the four Postgres-backed nao controls. Each branch is one
-- short local mutation; no network call occurs in this transaction. Mutation errors are caught
-- in a subtransaction so the failed outcome commits beside the attempt. If either audit write
-- itself fails, Postgres aborts the RPC and no mutation commits.
create or replace function public.nao_apply_control_mutation(
  p_operation_id uuid,
  p_action text,
  p_target text,
  p_detail jsonb,
  p_payload jsonb
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = public, pg_temp
as $$
declare
  v_attempted boolean;
  v_result jsonb;
  v_error_code text;
  v_status integer;
begin
  if p_action not in ('seeds.add', 'seeds.toggle', 'claims.reject', 'models.cap_override') then
    raise exception 'unsupported transactional control action' using errcode = '23514';
  end if;

  select public.nao_record_control_event(
    p_operation_id, p_action, 'attempted', p_target, p_detail, null
  ) into v_attempted;
  if not v_attempted then
    return jsonb_build_object(
      'ok', false, 'operationId', p_operation_id,
      'errorCode', 'duplicate_operation', 'status', 409
    );
  end if;

  begin
    case p_action
      when 'seeds.add' then
        insert into public.ingestion_seeds (slug, label, query_hint, created_by)
        values (p_target, p_payload->>'label', nullif(p_payload->>'queryHint', ''), auth.uid())
        returning jsonb_build_object(
          'id', id,
          'slug', slug,
          'label', label,
          'query_hint', query_hint,
          'enabled', enabled,
          'created_at', created_at
        ) into v_result;

      when 'seeds.toggle' then
        update public.ingestion_seeds
           set enabled = (p_payload->>'enabled')::boolean
         where slug = p_target
        returning jsonb_build_object(
          'id', id,
          'slug', slug,
          'label', label,
          'query_hint', query_hint,
          'enabled', enabled,
          'created_at', created_at
        ) into v_result;
        if not found then
          v_error_code := 'unknown_seed';
          v_status := 404;
        end if;

      when 'claims.reject' then
        if not exists (select 1 from public.relationship_claims where edge_id = p_target) then
          v_error_code := 'unknown_edge';
          v_status := 404;
        else
          insert into public.edge_human_verdicts (edge_id, action, reason, created_by)
          values (p_target, 'reject', nullif(p_payload->>'reason', ''), auth.uid())
          returning jsonb_build_object(
            'id', id,
            'edge_id', edge_id,
            'action', action,
            'reason', reason,
            'created_at', created_at
          ) into v_result;
        end if;

      when 'models.cap_override' then
        insert into public.llm_router_cap_overrides
          (node, per_day_usd_cap, per_run_token_cap, updated_by, updated_at)
        values (
          p_target,
          nullif(p_payload->>'perDayUsdCap', '')::numeric,
          nullif(p_payload->>'perRunTokenCap', '')::integer,
          auth.uid(), now()
        )
        on conflict (node) do update set
          per_day_usd_cap = excluded.per_day_usd_cap,
          per_run_token_cap = excluded.per_run_token_cap,
          updated_by = auth.uid(),
          updated_at = now()
        returning jsonb_build_object(
          'node', node,
          'per_day_usd_cap', per_day_usd_cap,
          'per_run_token_cap', per_run_token_cap,
          'updated_at', updated_at
        ) into v_result;
    end case;
  exception
    when unique_violation then
      v_error_code := case when p_action = 'seeds.add' then 'duplicate_seed' else 'mutation_conflict' end;
      v_status := 409;
    when others then
      v_error_code := 'mutation_failed';
      v_status := 500;
  end;

  if v_error_code is not null then
    perform public.nao_record_control_event(
      p_operation_id, p_action, 'failed', p_target, '{}'::jsonb, v_error_code
    );
    return jsonb_build_object(
      'ok', false, 'operationId', p_operation_id,
      'errorCode', v_error_code, 'status', v_status
    );
  end if;

  perform public.nao_record_control_event(
    p_operation_id, p_action, 'succeeded', p_target, '{}'::jsonb, null
  );
  return jsonb_build_object(
    'ok', true, 'operationId', p_operation_id, 'record', v_result
  );
end
$$;

revoke all on function public.nao_apply_control_mutation(uuid, text, text, jsonb, jsonb)
  from public, anon, service_role;
grant execute on function public.nao_apply_control_mutation(uuid, text, text, jsonb, jsonb) to authenticated;

create or replace view public.nao_unresolved_control_operations
with (security_invoker = true) as
select a.id, a.occurred_at, a.actor_user_id, a.actor_role,
       a.operation_id, a.action, a.target, a.detail
  from public.nao_control_events a
 where a.phase = 'attempted'
   and not exists (
     select 1 from public.nao_control_events o
      where o.actor_user_id = a.actor_user_id
        and o.operation_id = a.operation_id
        and o.phase in ('succeeded', 'failed')
   );

revoke all on public.nao_unresolved_control_operations from anon, authenticated;
grant select on public.nao_unresolved_control_operations to authenticated;

comment on view public.nao_unresolved_control_operations is
  'Admin-only through the underlying security-invoker RLS. Durable attempts without a terminal '
  'succeeded/failed event; these are the explicit reconciliation queue after external outcome '
  'persistence failures.';
