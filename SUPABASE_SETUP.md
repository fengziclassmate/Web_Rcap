# Supabase + Vercel 最简上线步骤

## 1. 创建 Supabase 项目
- 在 [Supabase](https://supabase.com/) 新建项目。
- 进入 `Project Settings -> API`，复制：
  - `Project URL`
  - `anon public key`

## 2. 创建数据表和 RLS 策略
在 Supabase SQL Editor 执行以下 SQL：

```sql
create table if not exists public.schedule_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  events jsonb not null default '[]'::jsonb,
  tasks jsonb not null default '[]'::jsonb,
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
```

## 3. 配置本地环境变量
复制 `.env.example` 为 `.env.local`，填写：

```bash
NEXT_PUBLIC_SUPABASE_URL=你的 Project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的 anon public key
```

## 4. 配置邮件登录（Magic Link）
- Supabase 控制台打开 `Authentication -> Providers -> Email`，确保 Email 登录开启。
- 在 `Authentication -> URL Configuration` 设置：
  - `Site URL`: 你的 Vercel 域名（本地调试可填 `http://localhost:3000`）
  - `Redirect URLs`: 包含 `http://localhost:3000` 和你的线上域名

## 5. 部署到 Vercel
- 将仓库推到 GitHub。
- Vercel 导入项目并在 `Environment Variables` 中配置同样的两个变量：
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- 重新部署。

完成后，每个用户通过邮箱登录，都会只读写自己的 `schedule_data` 行，账号彼此隔离。
