alter table public.schedule_data
  add column if not exists shopping_items jsonb not null default '[]'::jsonb;
