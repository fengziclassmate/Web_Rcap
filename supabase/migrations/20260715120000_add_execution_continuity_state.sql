alter table public.schedule_data
  add column if not exists continuity_state jsonb not null default jsonb_build_object(
    'resumePackets', '[]'::jsonb,
    'decisions', '[]'::jsonb,
    'debts', '[]'::jsonb,
    'outcomes', '[]'::jsonb
  );
