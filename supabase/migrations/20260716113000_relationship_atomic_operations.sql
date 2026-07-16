create table if not exists public.relationship_storage_cleanup (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now(),
  unique (user_id, storage_path)
);

alter table public.relationship_storage_cleanup enable row level security;
drop policy if exists "relationship_storage_cleanup_select_own" on public.relationship_storage_cleanup;
create policy "relationship_storage_cleanup_select_own" on public.relationship_storage_cleanup for select to authenticated using (auth.uid() = user_id);
drop policy if exists "relationship_storage_cleanup_delete_own" on public.relationship_storage_cleanup;
create policy "relationship_storage_cleanup_delete_own" on public.relationship_storage_cleanup for delete to authenticated using (auth.uid() = user_id);

create or replace function public.create_relationship_record_atomic(p_payload jsonb)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  new_record_id uuid;
  exchange_item jsonb;
  follow_up jsonb := p_payload -> 'followUp';
  relation jsonb;
begin
  if current_user_id is null then raise exception 'authentication required'; end if;

  insert into public.relationship_records (
    user_id, contact_id, direction, title, event_type, occasion, event_date,
    location, description, significance_level, expectation_level, privacy_level, ai_usage_allowed
  ) values (
    current_user_id,
    (p_payload ->> 'contactId')::uuid,
    p_payload ->> 'direction',
    p_payload ->> 'title',
    p_payload ->> 'eventType',
    coalesce(p_payload ->> 'occasion', ''),
    (p_payload ->> 'eventDate')::date,
    coalesce(p_payload ->> 'location', ''),
    coalesce(p_payload ->> 'description', ''),
    nullif(p_payload ->> 'significanceLevel', '')::smallint,
    coalesce(p_payload ->> 'expectationLevel', 'none'),
    coalesce(p_payload ->> 'privacyLevel', 'private'),
    coalesce((p_payload ->> 'aiUsageAllowed')::boolean, false)
  ) returning id into new_record_id;

  for exchange_item in select value from jsonb_array_elements(p_payload -> 'items') loop
    insert into public.relationship_exchange_items (
      user_id, relationship_record_id, category, item_name, description, quantity,
      estimated_value_minor, currency, material_value_level, is_returnable, return_status, notes
    ) values (
      current_user_id,
      new_record_id,
      exchange_item ->> 'category',
      exchange_item ->> 'itemName',
      coalesce(exchange_item ->> 'description', ''),
      nullif(exchange_item ->> 'quantity', '')::numeric,
      nullif(exchange_item ->> 'estimatedValueMinor', '')::bigint,
      nullif(exchange_item ->> 'currency', ''),
      nullif(exchange_item ->> 'materialValueLevel', '')::smallint,
      coalesce((exchange_item ->> 'isReturnable')::boolean, false),
      coalesce(exchange_item ->> 'returnStatus', 'not_applicable'),
      coalesce(exchange_item ->> 'notes', '')
    );
  end loop;

  if follow_up is not null and jsonb_typeof(follow_up) = 'object' then
    insert into public.relationship_follow_ups (
      user_id, relationship_record_id, follow_up_type, action_text, responsible_party,
      trigger_type, trigger_date, trigger_entity_type, trigger_entity_id, due_date,
      status, related_task_id, related_schedule_event_id, notes
    ) values (
      current_user_id,
      new_record_id,
      follow_up ->> 'followUpType',
      follow_up ->> 'actionText',
      coalesce(follow_up ->> 'responsibleParty', 'me'),
      coalesce(follow_up ->> 'triggerType', 'manual'),
      nullif(follow_up ->> 'triggerDate', '')::date,
      nullif(follow_up ->> 'triggerEntityType', ''),
      nullif(follow_up ->> 'triggerEntityId', ''),
      nullif(follow_up ->> 'dueDate', '')::date,
      coalesce(follow_up ->> 'status', 'pending_decision'),
      nullif(follow_up ->> 'relatedTaskId', ''),
      nullif(follow_up ->> 'relatedScheduleEventId', ''),
      coalesce(follow_up ->> 'notes', '')
    );
  end if;

  for relation in select value from jsonb_array_elements(coalesce(p_payload -> 'relations', '[]'::jsonb)) loop
    insert into public.relationship_record_relations (
      user_id, relationship_record_id, target_type, target_id, relation_type
    ) values (
      current_user_id,
      new_record_id,
      relation ->> 'targetType',
      relation ->> 'targetId',
      coalesce(relation ->> 'relationType', 'context')
    );
  end loop;

  return new_record_id;
end;
$$;

create or replace function public.delete_relationship_record_atomic(p_record_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  deleted_count integer;
begin
  if current_user_id is null then raise exception 'authentication required'; end if;
  insert into public.relationship_storage_cleanup (user_id, storage_path)
  select current_user_id, storage_path from public.relationship_attachments
  where relationship_record_id = p_record_id and user_id = current_user_id
  on conflict (user_id, storage_path) do nothing;
  delete from public.relationship_records where id = p_record_id and user_id = current_user_id;
  get diagnostics deleted_count = row_count;
  return deleted_count > 0;
end;
$$;

create or replace function public.clear_relationship_workspace_atomic()
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then raise exception 'authentication required'; end if;
  insert into public.relationship_storage_cleanup (user_id, storage_path)
  select current_user_id, storage_path from public.relationship_attachments where user_id = current_user_id
  on conflict (user_id, storage_path) do nothing;
  delete from public.relationship_records where user_id = current_user_id;
  delete from public.contacts where user_id = current_user_id;
end;
$$;

revoke all on function public.create_relationship_record_atomic(jsonb) from public;
revoke all on function public.delete_relationship_record_atomic(uuid) from public;
revoke all on function public.clear_relationship_workspace_atomic() from public;
grant execute on function public.create_relationship_record_atomic(jsonb) to authenticated;
grant execute on function public.delete_relationship_record_atomic(uuid) to authenticated;
grant execute on function public.clear_relationship_workspace_atomic() to authenticated;
