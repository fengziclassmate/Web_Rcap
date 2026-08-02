alter table public.expenses
  add column if not exists excluded_from_budget boolean not null default false;

create index if not exists expenses_user_budget_scope_date_idx
  on public.expenses(user_id, excluded_from_budget, expense_date desc);
