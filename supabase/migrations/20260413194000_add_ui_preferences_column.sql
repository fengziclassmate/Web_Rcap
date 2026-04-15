alter table public.schedule_data
add column if not exists ui_preferences jsonb not null default '{}'::jsonb;
