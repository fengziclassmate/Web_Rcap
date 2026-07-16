create extension if not exists pgcrypto;

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  alias text not null default '',
  relationship_type text not null default 'other' check (relationship_type in ('family','relative','friend','classmate','mentor','colleague','collaborator','student','neighbor','service_provider','other')),
  organization text not null default '',
  role text not null default '',
  phone text not null default '',
  email text not null default '',
  notes text not null default '',
  important_dates jsonb not null default '[]'::jsonb check (jsonb_typeof(important_dates) = 'array'),
  ai_usage_allowed boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table if not exists public.relationship_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  contact_id uuid not null,
  direction text not null check (direction in ('received','given','mutual')),
  title text not null check (char_length(title) between 1 and 240),
  event_type text not null check (event_type in ('gift','money','meal','expense_payment','loan','material_support','research_help','work_help','life_help','information','advice','introduction','recommendation','opportunity','emotional_support','invitation','visit','celebration','condolence','accompaniment','other')),
  occasion text not null default '',
  event_date date not null,
  occurred_at timestamptz,
  location text not null default '',
  description text not null default '',
  significance_level smallint check (significance_level between 1 and 5),
  expectation_level text not null default 'none' check (expectation_level in ('none','unclear','implicit','explicit')),
  status text not null default 'active' check (status in ('active','archived','cancelled')),
  privacy_level text not null default 'private' check (privacy_level in ('private','sensitive')),
  ai_usage_allowed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (id, user_id),
  constraint relationship_records_contact_owner_fk foreign key (contact_id, user_id)
    references public.contacts(id, user_id) on delete restrict
);

create table if not exists public.relationship_exchange_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  relationship_record_id uuid not null,
  category text not null check (category in ('gift','cash','meal','item','service','information','resource','introduction','opportunity','recommendation','time','emotional_support','other')),
  item_name text not null check (char_length(item_name) between 1 and 240),
  description text not null default '',
  quantity numeric(14,3) check (quantity is null or quantity > 0),
  estimated_value_minor bigint check (estimated_value_minor is null or estimated_value_minor >= 0),
  currency char(3),
  material_value_level smallint check (material_value_level between 1 and 5),
  is_returnable boolean not null default false,
  return_status text not null default 'not_applicable' check (return_status in ('not_applicable','not_returned','partially_returned','returned','waived')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint relationship_items_value_currency_check check (estimated_value_minor is null or currency is not null),
  constraint relationship_items_record_owner_fk foreign key (relationship_record_id, user_id)
    references public.relationship_records(id, user_id) on delete cascade
);

create table if not exists public.relationship_follow_ups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  relationship_record_id uuid not null,
  follow_up_type text not null check (follow_up_type in ('thank','return_gift','repay','return_item','invite_meal','provide_help','complete_promise','send_material','maintain_contact','congratulate','visit','other')),
  action_text text not null check (char_length(action_text) between 1 and 500),
  responsible_party text not null default 'me' check (responsible_party in ('me','other','mutual')),
  trigger_type text not null default 'manual' check (trigger_type in ('immediate','date','event','entity_status_change','manual')),
  trigger_date date,
  trigger_entity_type text check (trigger_entity_type is null or trigger_entity_type in ('task','schedule_event','research_project','research_paper','research_submission','research_meeting','log_post','literature')),
  trigger_entity_id text,
  due_date date,
  status text not null default 'pending_decision' check (status in ('pending_decision','pending','task_created','scheduled','completed','cancelled','not_needed')),
  related_task_id text,
  related_schedule_event_id text,
  completed_at timestamptz,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint relationship_follow_up_single_execution_link check (num_nonnulls(related_task_id, related_schedule_event_id) <= 1),
  constraint relationship_follow_ups_record_owner_fk foreign key (relationship_record_id, user_id)
    references public.relationship_records(id, user_id) on delete cascade
);

create table if not exists public.relationship_record_relations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  relationship_record_id uuid not null,
  target_type text not null check (target_type in ('task','schedule_event','research_project','research_paper','research_submission','research_meeting','log_post','literature')),
  target_id text not null,
  relation_type text not null default 'context' check (relation_type in ('context','source','outcome')),
  created_at timestamptz not null default now(),
  unique (user_id, relationship_record_id, target_type, target_id, relation_type),
  constraint relationship_relations_record_owner_fk foreign key (relationship_record_id, user_id)
    references public.relationship_records(id, user_id) on delete cascade
);

create table if not exists public.relationship_attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  relationship_record_id uuid not null,
  file_name text not null,
  mime_type text not null default '',
  file_size bigint not null default 0 check (file_size >= 0),
  storage_path text not null,
  created_at timestamptz not null default now(),
  constraint relationship_attachments_record_owner_fk foreign key (relationship_record_id, user_id)
    references public.relationship_records(id, user_id) on delete cascade
);

create index if not exists contacts_user_name_idx on public.contacts(user_id, name);
create index if not exists contacts_user_type_idx on public.contacts(user_id, relationship_type) where archived_at is null;
create index if not exists relationship_records_user_date_idx on public.relationship_records(user_id, event_date desc, created_at desc);
create index if not exists relationship_records_user_contact_idx on public.relationship_records(user_id, contact_id, event_date desc);
create index if not exists relationship_records_user_status_idx on public.relationship_records(user_id, status);
create index if not exists relationship_items_user_record_idx on public.relationship_exchange_items(user_id, relationship_record_id);
create index if not exists relationship_follow_ups_user_status_due_idx on public.relationship_follow_ups(user_id, status, due_date);
create index if not exists relationship_follow_ups_user_record_idx on public.relationship_follow_ups(user_id, relationship_record_id);
create index if not exists relationship_relations_user_target_idx on public.relationship_record_relations(user_id, target_type, target_id);
create index if not exists relationship_attachments_user_record_idx on public.relationship_attachments(user_id, relationship_record_id, created_at desc);

create or replace function public.set_relationship_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists contacts_set_updated_at on public.contacts;
create trigger contacts_set_updated_at before update on public.contacts for each row execute function public.set_relationship_updated_at();
drop trigger if exists relationship_records_set_updated_at on public.relationship_records;
create trigger relationship_records_set_updated_at before update on public.relationship_records for each row execute function public.set_relationship_updated_at();
drop trigger if exists relationship_items_set_updated_at on public.relationship_exchange_items;
create trigger relationship_items_set_updated_at before update on public.relationship_exchange_items for each row execute function public.set_relationship_updated_at();
drop trigger if exists relationship_follow_ups_set_updated_at on public.relationship_follow_ups;
create trigger relationship_follow_ups_set_updated_at before update on public.relationship_follow_ups for each row execute function public.set_relationship_updated_at();

alter table public.contacts enable row level security;
alter table public.relationship_records enable row level security;
alter table public.relationship_exchange_items enable row level security;
alter table public.relationship_follow_ups enable row level security;
alter table public.relationship_record_relations enable row level security;
alter table public.relationship_attachments enable row level security;

do $$
declare table_name text;
begin
  foreach table_name in array array['contacts','relationship_records','relationship_exchange_items','relationship_follow_ups','relationship_record_relations','relationship_attachments'] loop
    execute format('drop policy if exists %I on public.%I', table_name || '_select_own', table_name);
    execute format('create policy %I on public.%I for select to authenticated using (auth.uid() = user_id)', table_name || '_select_own', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_insert_own', table_name);
    execute format('create policy %I on public.%I for insert to authenticated with check (auth.uid() = user_id)', table_name || '_insert_own', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_update_own', table_name);
    execute format('create policy %I on public.%I for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', table_name || '_update_own', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_delete_own', table_name);
    execute format('create policy %I on public.%I for delete to authenticated using (auth.uid() = user_id)', table_name || '_delete_own', table_name);
  end loop;
end;
$$;

insert into storage.buckets (id, name, public)
values ('relationship-attachments', 'relationship-attachments', false)
on conflict (id) do update set public = false;

drop policy if exists "relationship_attachments_storage_select_own" on storage.objects;
create policy "relationship_attachments_storage_select_own" on storage.objects for select to authenticated
using (bucket_id = 'relationship-attachments' and auth.uid()::text = (storage.foldername(name))[1]);
drop policy if exists "relationship_attachments_storage_insert_own" on storage.objects;
create policy "relationship_attachments_storage_insert_own" on storage.objects for insert to authenticated
with check (bucket_id = 'relationship-attachments' and auth.uid()::text = (storage.foldername(name))[1]);
drop policy if exists "relationship_attachments_storage_update_own" on storage.objects;
create policy "relationship_attachments_storage_update_own" on storage.objects for update to authenticated
using (bucket_id = 'relationship-attachments' and auth.uid()::text = (storage.foldername(name))[1])
with check (bucket_id = 'relationship-attachments' and auth.uid()::text = (storage.foldername(name))[1]);
drop policy if exists "relationship_attachments_storage_delete_own" on storage.objects;
create policy "relationship_attachments_storage_delete_own" on storage.objects for delete to authenticated
using (bucket_id = 'relationship-attachments' and auth.uid()::text = (storage.foldername(name))[1]);
