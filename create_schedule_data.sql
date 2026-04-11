create table if not exists public.schedule_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  events jsonb not null default '[]'::jsonb,
  tasks jsonb not null default '[]'::jsonb,
  annual_tasks jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.schedule_data enable row level security;

drop policy if exists "Users can read own schedule data" on public.schedule_data;
create policy "Users can read own schedule data"
on public.schedule_data
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can write own schedule data" on public.schedule_data;
create policy "Users can write own schedule data"
on public.schedule_data
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own schedule data" on public.schedule_data;
create policy "Users can update own schedule data"
on public.schedule_data
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);