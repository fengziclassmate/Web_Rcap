create extension if not exists pgcrypto;

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount decimal(12, 2) not null check (amount >= 0),
  category text not null,
  note text not null default '',
  expense_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  budget_date date not null,
  amount decimal(12, 2) not null check (amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, budget_date)
);

create or replace function public.set_expense_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists expenses_set_updated_at on public.expenses;
create trigger expenses_set_updated_at
before update on public.expenses
for each row
execute function public.set_expense_updated_at();

drop trigger if exists daily_budgets_set_updated_at on public.daily_budgets;
create trigger daily_budgets_set_updated_at
before update on public.daily_budgets
for each row
execute function public.set_expense_updated_at();

create index if not exists expenses_user_date_idx
  on public.expenses(user_id, expense_date desc, created_at desc);

create index if not exists expenses_user_category_idx
  on public.expenses(user_id, category);

create index if not exists daily_budgets_user_date_idx
  on public.daily_budgets(user_id, budget_date desc);

alter table public.expenses enable row level security;
alter table public.daily_budgets enable row level security;

drop policy if exists "expenses_select_own" on public.expenses;
create policy "expenses_select_own"
on public.expenses
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "expenses_insert_own" on public.expenses;
create policy "expenses_insert_own"
on public.expenses
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "expenses_update_own" on public.expenses;
create policy "expenses_update_own"
on public.expenses
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "expenses_delete_own" on public.expenses;
create policy "expenses_delete_own"
on public.expenses
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists "daily_budgets_select_own" on public.daily_budgets;
create policy "daily_budgets_select_own"
on public.daily_budgets
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "daily_budgets_insert_own" on public.daily_budgets;
create policy "daily_budgets_insert_own"
on public.daily_budgets
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "daily_budgets_update_own" on public.daily_budgets;
create policy "daily_budgets_update_own"
on public.daily_budgets
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "daily_budgets_delete_own" on public.daily_budgets;
create policy "daily_budgets_delete_own"
on public.daily_budgets
for delete
to authenticated
using (auth.uid() = user_id);
