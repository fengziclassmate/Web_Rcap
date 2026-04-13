-- 完整的数据库迁移脚本
-- 在 Supabase 控制台的 SQL Editor 中执行

-- 创建 schedule_data 表
create table if not exists public.schedule_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  events jsonb not null default '[]'::jsonb,
  tasks jsonb not null default '[]'::jsonb,
  annual_tasks jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- 启用行级安全
alter table public.schedule_data enable row level security;

-- 创建读取权限策略
drop policy if exists "Users can read own schedule data" on public.schedule_data;
create policy "Users can read own schedule data"
on public.schedule_data
for select
to authenticated
using (auth.uid() = user_id);

-- 创建插入权限策略
drop policy if exists "Users can write own schedule data" on public.schedule_data;
create policy "Users can write own schedule data"
on public.schedule_data
for insert
to authenticated
with check (auth.uid() = user_id);

-- 创建更新权限策略
drop policy if exists "Users can update own schedule data" on public.schedule_data;
create policy "Users can update own schedule data"
on public.schedule_data
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- 验证表结构
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'schedule_data';

-- 验证策略
select policyname, tablename, cmd, roles, permissive, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'schedule_data';