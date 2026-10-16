-- Research / self-study boards share the account-scoped schedule draft,
-- optimistic concurrency control, and existing schedule_data RLS policies.
alter table public.schedule_data
  add column if not exists project_boards jsonb not null default '[]'::jsonb;

comment on column public.schedule_data.project_boards is
  'Research and self-study project boards, tasks, annotated text and checklists';
