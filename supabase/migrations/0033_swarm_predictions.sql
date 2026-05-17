-- ICP swarm predictions (content + funnel) with optional actual outcome

create table if not exists swarm_predictions (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references brands(id) on delete cascade,
  mode text not null,
  subject_ref text,
  funnel_id uuid references funnels(id) on delete cascade,
  prediction jsonb not null,
  actual_outcome jsonb,
  created_at timestamptz default now()
);

create index if not exists swarm_predictions_brand_mode_idx on swarm_predictions(brand_id, mode);
create index if not exists swarm_predictions_subject_ref_idx on swarm_predictions(brand_id, subject_ref);
create index if not exists swarm_predictions_funnel_idx on swarm_predictions(funnel_id);

alter table swarm_predictions enable row level security;

create policy "owner" on swarm_predictions
  for all
  using (brand_id in (select id from brands where user_id = auth.uid()))
  with check (brand_id in (select id from brands where user_id = auth.uid()));
