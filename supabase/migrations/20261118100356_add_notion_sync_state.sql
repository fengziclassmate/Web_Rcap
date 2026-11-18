create table public.notion_sync_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  configuration jsonb check (jsonb_typeof(configuration) = 'object'),
  invocation_digest text unique check (invocation_digest ~ '^[0-9a-f]{64}$'),
  ledger jsonb not null default '{}'::jsonb check (jsonb_typeof(ledger) = 'object'),
  lease_id uuid,
  lease_until timestamptz not null default '-infinity',
  last_finished_at timestamptz,
  last_result jsonb,
  last_error text
);

alter table public.notion_sync_state enable row level security;
revoke all on public.notion_sync_state from public, anon, authenticated, service_role;
grant select, insert, update on public.notion_sync_state to service_role;
grant select (user_id, last_finished_at, last_result, last_error)
  on public.notion_sync_state to authenticated;

create policy "Notion sync status belongs to its owner"
  on public.notion_sync_state for select to authenticated
  using ((select auth.uid()) = user_id);

create function public.claim_notion_sync(p_user_id uuid, p_lease_id uuid)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  with claimed as (
    insert into public.notion_sync_state as state (user_id, lease_id, lease_until)
    values (p_user_id, p_lease_id, clock_timestamp() + interval '110 seconds')
    on conflict (user_id) do update
      set lease_id = excluded.lease_id, lease_until = excluded.lease_until
      where state.lease_until <= clock_timestamp()
    returning user_id
  )
  select exists (select 1 from claimed);
$$;

create function public.commit_notion_sync(
  p_user_id uuid,
  p_lease_id uuid,
  p_revision timestamptz,
  p_changes jsonb,
  p_ledger jsonb
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_revision timestamptz;
begin
  perform 1 from public.notion_sync_state
    where user_id = p_user_id and lease_id = p_lease_id and lease_until > clock_timestamp()
    for update;
  if not found then return false; end if;

  select updated_at into current_revision from public.schedule_data
    where user_id = p_user_id for update;
  if current_revision is distinct from p_revision then return false; end if;

  if p_changes <> '{}'::jsonb then
    if current_revision is null then
      insert into public.schedule_data (user_id, tasks, events, project_checkins, updated_at)
      values (
        p_user_id,
        coalesce(p_changes -> 'tasks', '[]'::jsonb),
        coalesce(p_changes -> 'events', '[]'::jsonb),
        coalesce(p_changes -> 'projectCheckins', '[]'::jsonb),
        clock_timestamp()
      )
      on conflict (user_id) do nothing;
      if not found then return false; end if;
    else
      update public.schedule_data set
        tasks = coalesce(p_changes -> 'tasks', tasks),
        events = coalesce(p_changes -> 'events', events),
        project_checkins = coalesce(p_changes -> 'projectCheckins', project_checkins),
        updated_at = greatest(clock_timestamp(), current_revision + interval '1 millisecond')
      where user_id = p_user_id;
    end if;
  end if;

  update public.notion_sync_state set ledger = p_ledger where user_id = p_user_id;
  return true;
end;
$$;

revoke execute on function public.claim_notion_sync(uuid, uuid)
  from public, anon, authenticated;
revoke execute on function public.commit_notion_sync(uuid, uuid, timestamptz, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.claim_notion_sync(uuid, uuid) to service_role;
grant execute on function public.commit_notion_sync(uuid, uuid, timestamptz, jsonb, jsonb)
  to service_role;
