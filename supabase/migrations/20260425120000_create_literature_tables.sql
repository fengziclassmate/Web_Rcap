create extension if not exists pgcrypto;

create table if not exists public.literatures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  authors text not null default '',
  publish_year integer,
  venue text not null default '',
  doi text not null default '',
  url text not null default '',
  pdf_url text not null default '',
  abstract text not null default '',
  keywords text[] not null default '{}',
  status text not null default 'to_read',
  importance text not null default 'medium',
  summary text not null default '',
  contributions text not null default '',
  limitations text not null default '',
  linked_task_ids text[] not null default '{}',
  linked_event_ids text[] not null default '{}',
  linked_meeting_ids text[] not null default '{}',
  linked_log_post_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.literature_notes (
  id uuid primary key default gen_random_uuid(),
  literature_id uuid not null references public.literatures(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  research_question text not null default '',
  research_background text not null default '',
  data_source text not null default '',
  method text not null default '',
  findings text not null default '',
  innovations text not null default '',
  shortcomings text not null default '',
  inspiration text not null default '',
  quotable_content text not null default '',
  updated_at timestamptz not null default now(),
  unique (literature_id, user_id)
);

create table if not exists public.literature_excerpts (
  id uuid primary key default gen_random_uuid(),
  literature_id uuid not null references public.literatures(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  page text not null default '',
  note text not null default '',
  excerpt_type text not null default 'quote',
  paper_section text not null default 'literature_review',
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.literature_method_notes (
  id uuid primary key default gen_random_uuid(),
  literature_id uuid not null references public.literatures(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default '',
  description text not null default '',
  required_data text not null default '',
  strengths text not null default '',
  weaknesses text not null default '',
  applicability text not null default '',
  planned_to_use boolean not null default false,
  project_id text,
  paper_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.literature_paper_usages (
  id uuid primary key default gen_random_uuid(),
  literature_id uuid not null references public.literatures(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  paper_id text not null,
  chapter text not null default '',
  usage_type text not null default 'background',
  note text not null default '',
  citation_status text not null default 'planned',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.literature_project_links (
  id uuid primary key default gen_random_uuid(),
  literature_id uuid not null references public.literatures(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.literature_reading_logs (
  id uuid primary key default gen_random_uuid(),
  literature_id uuid not null references public.literatures(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  logged_at timestamptz not null default now(),
  duration_minutes integer not null default 0,
  progress_text text not null default '',
  status_after text not null default 'to_read',
  linked_task_id text,
  linked_event_id text,
  linked_log_post_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.literature_tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text,
  usage_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.literature_tag_links (
  literature_id uuid not null references public.literatures(id) on delete cascade,
  tag_id uuid not null references public.literature_tags(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (literature_id, tag_id)
);

create index if not exists literatures_user_updated_idx on public.literatures(user_id, updated_at desc);
create index if not exists literatures_user_status_idx on public.literatures(user_id, status);
create index if not exists literature_notes_user_literature_idx on public.literature_notes(user_id, literature_id);
create index if not exists literature_excerpts_user_literature_idx on public.literature_excerpts(user_id, literature_id, created_at desc);
create index if not exists literature_method_notes_user_literature_idx on public.literature_method_notes(user_id, literature_id);
create index if not exists literature_paper_usages_user_literature_idx on public.literature_paper_usages(user_id, literature_id);
create index if not exists literature_project_links_user_literature_idx on public.literature_project_links(user_id, literature_id);
create index if not exists literature_reading_logs_user_literature_idx on public.literature_reading_logs(user_id, literature_id, logged_at desc);
create index if not exists literature_tags_user_usage_idx on public.literature_tags(user_id, usage_count desc);
create index if not exists literature_tag_links_user_literature_idx on public.literature_tag_links(user_id, literature_id);

alter table public.literatures enable row level security;
alter table public.literature_notes enable row level security;
alter table public.literature_excerpts enable row level security;
alter table public.literature_method_notes enable row level security;
alter table public.literature_paper_usages enable row level security;
alter table public.literature_project_links enable row level security;
alter table public.literature_reading_logs enable row level security;
alter table public.literature_tags enable row level security;
alter table public.literature_tag_links enable row level security;

drop policy if exists "literatures_select_own" on public.literatures;
create policy "literatures_select_own" on public.literatures for select to authenticated using (auth.uid() = user_id);
drop policy if exists "literatures_insert_own" on public.literatures;
create policy "literatures_insert_own" on public.literatures for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "literatures_update_own" on public.literatures;
create policy "literatures_update_own" on public.literatures for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "literatures_delete_own" on public.literatures;
create policy "literatures_delete_own" on public.literatures for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "literature_notes_select_own" on public.literature_notes;
create policy "literature_notes_select_own" on public.literature_notes for select to authenticated using (auth.uid() = user_id);
drop policy if exists "literature_notes_insert_own" on public.literature_notes;
create policy "literature_notes_insert_own" on public.literature_notes for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "literature_notes_update_own" on public.literature_notes;
create policy "literature_notes_update_own" on public.literature_notes for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "literature_notes_delete_own" on public.literature_notes;
create policy "literature_notes_delete_own" on public.literature_notes for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "literature_excerpts_select_own" on public.literature_excerpts;
create policy "literature_excerpts_select_own" on public.literature_excerpts for select to authenticated using (auth.uid() = user_id);
drop policy if exists "literature_excerpts_insert_own" on public.literature_excerpts;
create policy "literature_excerpts_insert_own" on public.literature_excerpts for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "literature_excerpts_update_own" on public.literature_excerpts;
create policy "literature_excerpts_update_own" on public.literature_excerpts for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "literature_excerpts_delete_own" on public.literature_excerpts;
create policy "literature_excerpts_delete_own" on public.literature_excerpts for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "literature_method_notes_select_own" on public.literature_method_notes;
create policy "literature_method_notes_select_own" on public.literature_method_notes for select to authenticated using (auth.uid() = user_id);
drop policy if exists "literature_method_notes_insert_own" on public.literature_method_notes;
create policy "literature_method_notes_insert_own" on public.literature_method_notes for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "literature_method_notes_update_own" on public.literature_method_notes;
create policy "literature_method_notes_update_own" on public.literature_method_notes for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "literature_method_notes_delete_own" on public.literature_method_notes;
create policy "literature_method_notes_delete_own" on public.literature_method_notes for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "literature_paper_usages_select_own" on public.literature_paper_usages;
create policy "literature_paper_usages_select_own" on public.literature_paper_usages for select to authenticated using (auth.uid() = user_id);
drop policy if exists "literature_paper_usages_insert_own" on public.literature_paper_usages;
create policy "literature_paper_usages_insert_own" on public.literature_paper_usages for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "literature_paper_usages_update_own" on public.literature_paper_usages;
create policy "literature_paper_usages_update_own" on public.literature_paper_usages for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "literature_paper_usages_delete_own" on public.literature_paper_usages;
create policy "literature_paper_usages_delete_own" on public.literature_paper_usages for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "literature_project_links_select_own" on public.literature_project_links;
create policy "literature_project_links_select_own" on public.literature_project_links for select to authenticated using (auth.uid() = user_id);
drop policy if exists "literature_project_links_insert_own" on public.literature_project_links;
create policy "literature_project_links_insert_own" on public.literature_project_links for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "literature_project_links_update_own" on public.literature_project_links;
create policy "literature_project_links_update_own" on public.literature_project_links for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "literature_project_links_delete_own" on public.literature_project_links;
create policy "literature_project_links_delete_own" on public.literature_project_links for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "literature_reading_logs_select_own" on public.literature_reading_logs;
create policy "literature_reading_logs_select_own" on public.literature_reading_logs for select to authenticated using (auth.uid() = user_id);
drop policy if exists "literature_reading_logs_insert_own" on public.literature_reading_logs;
create policy "literature_reading_logs_insert_own" on public.literature_reading_logs for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "literature_reading_logs_update_own" on public.literature_reading_logs;
create policy "literature_reading_logs_update_own" on public.literature_reading_logs for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "literature_reading_logs_delete_own" on public.literature_reading_logs;
create policy "literature_reading_logs_delete_own" on public.literature_reading_logs for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "literature_tags_select_own" on public.literature_tags;
create policy "literature_tags_select_own" on public.literature_tags for select to authenticated using (auth.uid() = user_id);
drop policy if exists "literature_tags_insert_own" on public.literature_tags;
create policy "literature_tags_insert_own" on public.literature_tags for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "literature_tags_update_own" on public.literature_tags;
create policy "literature_tags_update_own" on public.literature_tags for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "literature_tags_delete_own" on public.literature_tags;
create policy "literature_tags_delete_own" on public.literature_tags for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "literature_tag_links_select_own" on public.literature_tag_links;
create policy "literature_tag_links_select_own" on public.literature_tag_links for select to authenticated using (auth.uid() = user_id);
drop policy if exists "literature_tag_links_insert_own" on public.literature_tag_links;
create policy "literature_tag_links_insert_own" on public.literature_tag_links for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "literature_tag_links_update_own" on public.literature_tag_links;
create policy "literature_tag_links_update_own" on public.literature_tag_links for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "literature_tag_links_delete_own" on public.literature_tag_links;
create policy "literature_tag_links_delete_own" on public.literature_tag_links for delete to authenticated using (auth.uid() = user_id);
