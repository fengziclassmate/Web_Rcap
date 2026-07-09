alter table public.expenses
  add column if not exists category_main text,
  add column if not exists category_sub text not null default '',
  add column if not exists category_detail text not null default '';

update public.expenses
set category_main = coalesce(nullif(category_main, ''), category)
where category_main is null or category_main = '';

alter table public.expenses
  alter column category_main set not null,
  alter column category_main set default '其他';

create table if not exists public.period_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  budget_type text not null check (budget_type in ('week', 'month')),
  period_start date not null,
  amount decimal(12, 2) not null check (amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, budget_type, period_start)
);

drop trigger if exists period_budgets_set_updated_at on public.period_budgets;
create trigger period_budgets_set_updated_at
before update on public.period_budgets
for each row
execute function public.set_expense_updated_at();

create index if not exists expenses_user_category_path_idx
  on public.expenses(user_id, category_main, category_sub, category_detail);

create index if not exists period_budgets_user_period_idx
  on public.period_budgets(user_id, budget_type, period_start desc);

alter table public.period_budgets enable row level security;

drop policy if exists "period_budgets_select_own" on public.period_budgets;
create policy "period_budgets_select_own"
on public.period_budgets
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "period_budgets_insert_own" on public.period_budgets;
create policy "period_budgets_insert_own"
on public.period_budgets
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "period_budgets_update_own" on public.period_budgets;
create policy "period_budgets_update_own"
on public.period_budgets
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "period_budgets_delete_own" on public.period_budgets;
create policy "period_budgets_delete_own"
on public.period_budgets
for delete
to authenticated
using (auth.uid() = user_id);
