-- 添加 annual_tasks 列
alter table public.schedule_data
add column if not exists annual_tasks jsonb not null default '[]'::jsonb;