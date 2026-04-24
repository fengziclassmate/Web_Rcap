create table if not exists public.research_projects (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  summary text not null default '',
  status text not null default 'idea',
  priority text not null default 'medium',
  progress integer not null default 0,
  start_date date,
  target_end_date date,
  research_question text not null default '',
  hypothesis text not null default '',
  method text not null default '',
  data_sources text not null default '',
  current_issues text not null default '',
  next_actions text not null default '',
  planned_task_ids text[] not null default '{}',
  linked_task_ids text[] not null default '{}',
  linked_event_ids text[] not null default '{}',
  linked_activity_log_ids text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.research_project_logs (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id text not null,
  entry_date date not null,
  progress_text text not null default '',
  issues text not null default '',
  next_actions text not null default '',
  sync_to_activity_log boolean not null default false,
  linked_task_ids text[] not null default '{}',
  linked_event_ids text[] not null default '{}',
  linked_activity_log_ids text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.research_papers (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  abstract text not null default '',
  keywords text[] not null default '{}',
  status text not null default 'planning',
  target_venue text not null default '',
  chapter_count integer not null default 0,
  completed_chapters integer not null default 0,
  overall_progress integer not null default 0,
  current_issues text not null default '',
  next_actions text not null default '',
  writing_plan text not null default '',
  linked_task_ids text[] not null default '{}',
  linked_event_ids text[] not null default '{}',
  linked_activity_log_ids text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.research_paper_project_links (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  paper_id text not null,
  project_id text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.research_paper_sections (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  paper_id text not null,
  title text not null,
  sort_order integer not null default 1,
  status text not null default 'planned',
  target_words integer not null default 0,
  current_words integer not null default 0,
  notes text not null default '',
  issues text not null default '',
  next_actions text not null default '',
  linked_task_ids text[] not null default '{}',
  linked_event_ids text[] not null default '{}',
  linked_activity_log_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.research_paper_feedback (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  paper_id text not null,
  source text not null default 'advisor',
  feedback_date date not null,
  content text not null default '',
  suggested_action text not null default '',
  status text not null default 'open',
  related_section_id text,
  linked_task_ids text[] not null default '{}',
  linked_event_ids text[] not null default '{}',
  linked_activity_log_ids text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.research_submissions (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  paper_id text not null,
  venue_name text not null,
  venue_type text not null default 'journal',
  submitted_at date,
  manuscript_id text not null default '',
  status text not null default 'preparing',
  decision_date date,
  revision_due_date date,
  result_note text not null default '',
  response_letter_status text not null default 'open',
  revision_plan text not null default '',
  materials_checklist jsonb not null default '[]'::jsonb,
  linked_task_ids text[] not null default '{}',
  linked_event_ids text[] not null default '{}',
  linked_activity_log_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.research_submission_status_history (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  submission_id text not null,
  status text not null,
  changed_at date not null,
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.research_review_comments (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  submission_id text not null,
  reviewer text not null default '',
  comment text not null default '',
  response text not null default '',
  status text not null default 'open',
  paper_section_id text,
  linked_task_ids text[] not null default '{}',
  linked_event_ids text[] not null default '{}',
  linked_activity_log_ids text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.research_meetings (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  meeting_date date not null,
  title text not null,
  meeting_type text not null default 'group',
  attendees text not null default '',
  summary text not null default '',
  discussion_notes text not null default '',
  mentor_feedback text not null default '',
  decisions text not null default '',
  next_meeting_date date,
  project_ids text[] not null default '{}',
  paper_ids text[] not null default '{}',
  submission_ids text[] not null default '{}',
  follow_up text not null default '',
  linked_task_ids text[] not null default '{}',
  linked_event_ids text[] not null default '{}',
  linked_activity_log_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.research_meeting_action_items (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  meeting_id text not null,
  content text not null,
  owner text not null default '',
  due_date date,
  priority text not null default 'medium',
  status text not null default 'todo',
  project_id text,
  paper_id text,
  submission_id text,
  linked_task_ids text[] not null default '{}',
  linked_event_ids text[] not null default '{}',
  linked_activity_log_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.research_timeline_entries (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null,
  entity_id text not null,
  entry_date date not null,
  title text not null,
  description text not null default '',
  linked_task_ids text[] not null default '{}',
  linked_event_ids text[] not null default '{}',
  linked_activity_log_ids text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists research_projects_user_idx on public.research_projects(user_id);
create index if not exists research_project_logs_user_project_idx on public.research_project_logs(user_id, project_id);
create index if not exists research_papers_user_idx on public.research_papers(user_id);
create index if not exists research_paper_project_links_user_idx on public.research_paper_project_links(user_id);
create index if not exists research_paper_sections_user_paper_idx on public.research_paper_sections(user_id, paper_id);
create index if not exists research_paper_feedback_user_paper_idx on public.research_paper_feedback(user_id, paper_id);
create index if not exists research_submissions_user_paper_idx on public.research_submissions(user_id, paper_id);
create index if not exists research_submission_history_user_submission_idx on public.research_submission_status_history(user_id, submission_id);
create index if not exists research_review_comments_user_submission_idx on public.research_review_comments(user_id, submission_id);
create index if not exists research_meetings_user_idx on public.research_meetings(user_id);
create index if not exists research_meeting_action_items_user_meeting_idx on public.research_meeting_action_items(user_id, meeting_id);
create index if not exists research_timeline_entries_user_entity_idx on public.research_timeline_entries(user_id, entity_type, entity_id);

alter table public.research_projects enable row level security;
alter table public.research_project_logs enable row level security;
alter table public.research_papers enable row level security;
alter table public.research_paper_project_links enable row level security;
alter table public.research_paper_sections enable row level security;
alter table public.research_paper_feedback enable row level security;
alter table public.research_submissions enable row level security;
alter table public.research_submission_status_history enable row level security;
alter table public.research_review_comments enable row level security;
alter table public.research_meetings enable row level security;
alter table public.research_meeting_action_items enable row level security;
alter table public.research_timeline_entries enable row level security;

drop policy if exists "research_projects_select_own" on public.research_projects;
create policy "research_projects_select_own" on public.research_projects for select to authenticated using (auth.uid() = user_id);
drop policy if exists "research_projects_insert_own" on public.research_projects;
create policy "research_projects_insert_own" on public.research_projects for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "research_projects_update_own" on public.research_projects;
create policy "research_projects_update_own" on public.research_projects for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "research_projects_delete_own" on public.research_projects;
create policy "research_projects_delete_own" on public.research_projects for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "research_project_logs_select_own" on public.research_project_logs;
create policy "research_project_logs_select_own" on public.research_project_logs for select to authenticated using (auth.uid() = user_id);
drop policy if exists "research_project_logs_insert_own" on public.research_project_logs;
create policy "research_project_logs_insert_own" on public.research_project_logs for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "research_project_logs_update_own" on public.research_project_logs;
create policy "research_project_logs_update_own" on public.research_project_logs for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "research_project_logs_delete_own" on public.research_project_logs;
create policy "research_project_logs_delete_own" on public.research_project_logs for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "research_papers_select_own" on public.research_papers;
create policy "research_papers_select_own" on public.research_papers for select to authenticated using (auth.uid() = user_id);
drop policy if exists "research_papers_insert_own" on public.research_papers;
create policy "research_papers_insert_own" on public.research_papers for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "research_papers_update_own" on public.research_papers;
create policy "research_papers_update_own" on public.research_papers for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "research_papers_delete_own" on public.research_papers;
create policy "research_papers_delete_own" on public.research_papers for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "research_paper_project_links_select_own" on public.research_paper_project_links;
create policy "research_paper_project_links_select_own" on public.research_paper_project_links for select to authenticated using (auth.uid() = user_id);
drop policy if exists "research_paper_project_links_insert_own" on public.research_paper_project_links;
create policy "research_paper_project_links_insert_own" on public.research_paper_project_links for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "research_paper_project_links_update_own" on public.research_paper_project_links;
create policy "research_paper_project_links_update_own" on public.research_paper_project_links for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "research_paper_project_links_delete_own" on public.research_paper_project_links;
create policy "research_paper_project_links_delete_own" on public.research_paper_project_links for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "research_paper_sections_select_own" on public.research_paper_sections;
create policy "research_paper_sections_select_own" on public.research_paper_sections for select to authenticated using (auth.uid() = user_id);
drop policy if exists "research_paper_sections_insert_own" on public.research_paper_sections;
create policy "research_paper_sections_insert_own" on public.research_paper_sections for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "research_paper_sections_update_own" on public.research_paper_sections;
create policy "research_paper_sections_update_own" on public.research_paper_sections for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "research_paper_sections_delete_own" on public.research_paper_sections;
create policy "research_paper_sections_delete_own" on public.research_paper_sections for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "research_paper_feedback_select_own" on public.research_paper_feedback;
create policy "research_paper_feedback_select_own" on public.research_paper_feedback for select to authenticated using (auth.uid() = user_id);
drop policy if exists "research_paper_feedback_insert_own" on public.research_paper_feedback;
create policy "research_paper_feedback_insert_own" on public.research_paper_feedback for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "research_paper_feedback_update_own" on public.research_paper_feedback;
create policy "research_paper_feedback_update_own" on public.research_paper_feedback for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "research_paper_feedback_delete_own" on public.research_paper_feedback;
create policy "research_paper_feedback_delete_own" on public.research_paper_feedback for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "research_submissions_select_own" on public.research_submissions;
create policy "research_submissions_select_own" on public.research_submissions for select to authenticated using (auth.uid() = user_id);
drop policy if exists "research_submissions_insert_own" on public.research_submissions;
create policy "research_submissions_insert_own" on public.research_submissions for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "research_submissions_update_own" on public.research_submissions;
create policy "research_submissions_update_own" on public.research_submissions for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "research_submissions_delete_own" on public.research_submissions;
create policy "research_submissions_delete_own" on public.research_submissions for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "research_submission_status_history_select_own" on public.research_submission_status_history;
create policy "research_submission_status_history_select_own" on public.research_submission_status_history for select to authenticated using (auth.uid() = user_id);
drop policy if exists "research_submission_status_history_insert_own" on public.research_submission_status_history;
create policy "research_submission_status_history_insert_own" on public.research_submission_status_history for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "research_submission_status_history_update_own" on public.research_submission_status_history;
create policy "research_submission_status_history_update_own" on public.research_submission_status_history for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "research_submission_status_history_delete_own" on public.research_submission_status_history;
create policy "research_submission_status_history_delete_own" on public.research_submission_status_history for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "research_review_comments_select_own" on public.research_review_comments;
create policy "research_review_comments_select_own" on public.research_review_comments for select to authenticated using (auth.uid() = user_id);
drop policy if exists "research_review_comments_insert_own" on public.research_review_comments;
create policy "research_review_comments_insert_own" on public.research_review_comments for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "research_review_comments_update_own" on public.research_review_comments;
create policy "research_review_comments_update_own" on public.research_review_comments for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "research_review_comments_delete_own" on public.research_review_comments;
create policy "research_review_comments_delete_own" on public.research_review_comments for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "research_meetings_select_own" on public.research_meetings;
create policy "research_meetings_select_own" on public.research_meetings for select to authenticated using (auth.uid() = user_id);
drop policy if exists "research_meetings_insert_own" on public.research_meetings;
create policy "research_meetings_insert_own" on public.research_meetings for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "research_meetings_update_own" on public.research_meetings;
create policy "research_meetings_update_own" on public.research_meetings for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "research_meetings_delete_own" on public.research_meetings;
create policy "research_meetings_delete_own" on public.research_meetings for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "research_meeting_action_items_select_own" on public.research_meeting_action_items;
create policy "research_meeting_action_items_select_own" on public.research_meeting_action_items for select to authenticated using (auth.uid() = user_id);
drop policy if exists "research_meeting_action_items_insert_own" on public.research_meeting_action_items;
create policy "research_meeting_action_items_insert_own" on public.research_meeting_action_items for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "research_meeting_action_items_update_own" on public.research_meeting_action_items;
create policy "research_meeting_action_items_update_own" on public.research_meeting_action_items for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "research_meeting_action_items_delete_own" on public.research_meeting_action_items;
create policy "research_meeting_action_items_delete_own" on public.research_meeting_action_items for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "research_timeline_entries_select_own" on public.research_timeline_entries;
create policy "research_timeline_entries_select_own" on public.research_timeline_entries for select to authenticated using (auth.uid() = user_id);
drop policy if exists "research_timeline_entries_insert_own" on public.research_timeline_entries;
create policy "research_timeline_entries_insert_own" on public.research_timeline_entries for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "research_timeline_entries_update_own" on public.research_timeline_entries;
create policy "research_timeline_entries_update_own" on public.research_timeline_entries for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "research_timeline_entries_delete_own" on public.research_timeline_entries;
create policy "research_timeline_entries_delete_own" on public.research_timeline_entries for delete to authenticated using (auth.uid() = user_id);
