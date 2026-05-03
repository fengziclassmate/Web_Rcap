create table if not exists public.research_project_attachments (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id text not null references public.research_projects(id) on delete cascade,
  file_name text not null,
  file_type text not null default '',
  file_size bigint not null default 0,
  storage_path text not null,
  file_url text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists research_project_attachments_user_project_idx
  on public.research_project_attachments(user_id, project_id, created_at desc);

alter table public.research_project_attachments enable row level security;

drop policy if exists "research_project_attachments_select_own" on public.research_project_attachments;
create policy "research_project_attachments_select_own"
on public.research_project_attachments
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "research_project_attachments_insert_own" on public.research_project_attachments;
create policy "research_project_attachments_insert_own"
on public.research_project_attachments
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "research_project_attachments_update_own" on public.research_project_attachments;
create policy "research_project_attachments_update_own"
on public.research_project_attachments
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "research_project_attachments_delete_own" on public.research_project_attachments;
create policy "research_project_attachments_delete_own"
on public.research_project_attachments
for delete
to authenticated
using (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('research-project-attachments', 'research-project-attachments', false)
on conflict (id) do nothing;

drop policy if exists "research_project_attachments_storage_select_own" on storage.objects;
create policy "research_project_attachments_storage_select_own"
on storage.objects
for select
to authenticated
using (bucket_id = 'research-project-attachments' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "research_project_attachments_storage_insert_own" on storage.objects;
create policy "research_project_attachments_storage_insert_own"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'research-project-attachments' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "research_project_attachments_storage_update_own" on storage.objects;
create policy "research_project_attachments_storage_update_own"
on storage.objects
for update
to authenticated
using (bucket_id = 'research-project-attachments' and auth.uid()::text = (storage.foldername(name))[1])
with check (bucket_id = 'research-project-attachments' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "research_project_attachments_storage_delete_own" on storage.objects;
create policy "research_project_attachments_storage_delete_own"
on storage.objects
for delete
to authenticated
using (bucket_id = 'research-project-attachments' and auth.uid()::text = (storage.foldername(name))[1]);
