-- Focus shares the existing account-scoped drafts, revision checks and schedule_data RLS.
alter table public.schedule_data
  add column if not exists focus_state jsonb not null
    default '{"active":null,"sessions":[]}'::jsonb;

alter table public.schedule_data
  add constraint schedule_data_focus_state_shape check (
    jsonb_typeof(focus_state) = 'object'
    and focus_state ? 'active'
    and focus_state ? 'sessions'
    and jsonb_typeof(focus_state -> 'active') in ('null', 'object')
    and jsonb_typeof(focus_state -> 'sessions') = 'array'
  );

comment on column public.schedule_data.focus_state is
  'Account focus timer and append-only pause segments; immutable segment IDs merge retries across devices';
