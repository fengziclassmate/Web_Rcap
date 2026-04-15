alter table public.schedule_data
add column if not exists achievements jsonb not null default '[]'::jsonb,
add column if not exists research_projects jsonb not null default '[]'::jsonb,
add column if not exists paper_progress jsonb not null default '{}'::jsonb,
add column if not exists submissions jsonb not null default '[]'::jsonb,
add column if not exists group_meetings jsonb not null default '[]'::jsonb;

