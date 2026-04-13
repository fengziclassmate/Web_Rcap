alter table public.schedule_data
add column if not exists annual_tasks jsonb not null default '[]'::jsonb,
add column if not exists project_checkins jsonb not null default '[]'::jsonb,
add column if not exists footprints jsonb not null default '[]'::jsonb;
