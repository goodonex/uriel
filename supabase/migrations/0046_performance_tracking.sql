-- Brand OS — Performance Tracking (H2 2026 Zielsetzung)

-- Fix: sales_goals fehlende Spalten
alter table sales_goals
  add column if not exists linkedin_target int not null default 0,
  add column if not exists qualifications_target int not null default 0;

-- Tägliche Aktivitäts-Targets pro Brand
create table if not exists daily_metric_targets (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade unique,
  dial_attempts_target int not null default 50,
  linkedin_target int not null default 30,
  pitches_target int not null default 5,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists daily_metric_targets_brand_idx on daily_metric_targets (brand_id);

alter table daily_metric_targets enable row level security;
drop policy if exists "daily_metric_targets_via_brand" on daily_metric_targets;
create policy "daily_metric_targets_via_brand" on daily_metric_targets
  for all
  using (exists (select 1 from brands b where b.id = daily_metric_targets.brand_id and b.user_id = auth.uid()))
  with check (exists (select 1 from brands b where b.id = daily_metric_targets.brand_id and b.user_id = auth.uid()));

-- Strategische H2-Ziele
create table if not exists business_targets (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  period_label text not null default 'H2 2026',
  north_star_mrr numeric(12,2) not null default 8000,
  north_star_deadline date not null default '2026-11-30',
  mrr_dec_target numeric(12,2) not null default 11000,
  total_revenue_target numeric(12,2) not null default 168000,
  new_customers_target int not null default 24,
  margin_min numeric(5,2) not null default 65,
  margin_max numeric(5,2) not null default 75,
  hire_trigger_mrr numeric(12,2) not null default 8000,
  hire_trigger_profit numeric(12,2) not null default 10000,
  milestones jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, period_label)
);

create index if not exists business_targets_brand_idx on business_targets (brand_id);

alter table business_targets enable row level security;
drop policy if exists "business_targets_via_brand" on business_targets;
create policy "business_targets_via_brand" on business_targets
  for all
  using (exists (select 1 from brands b where b.id = business_targets.brand_id and b.user_id = auth.uid()))
  with check (exists (select 1 from brands b where b.id = business_targets.brand_id and b.user_id = auth.uid()));

-- Wöchentliche Reviews
create table if not exists weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  week_start date not null,
  snapshot jsonb not null default '{}'::jsonb,
  notes text not null default '',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, week_start)
);

create index if not exists weekly_reviews_brand_idx on weekly_reviews (brand_id, week_start desc);

alter table weekly_reviews enable row level security;
drop policy if exists "weekly_reviews_via_brand" on weekly_reviews;
create policy "weekly_reviews_via_brand" on weekly_reviews
  for all
  using (exists (select 1 from brands b where b.id = weekly_reviews.brand_id and b.user_id = auth.uid()))
  with check (exists (select 1 from brands b where b.id = weekly_reviews.brand_id and b.user_id = auth.uid()));

-- Monatliche Snapshots
create table if not exists monthly_snapshots (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  month date not null,
  mrr numeric(12,2) not null default 0,
  mrr_override numeric(12,2),
  mrr_delta numeric(12,2) not null default 0,
  project_revenue numeric(12,2) not null default 0,
  total_revenue numeric(12,2) not null default 0,
  active_customers int not null default 0,
  churn_rate numeric(5,2) not null default 0,
  new_customers int not null default 0,
  ads_cpl numeric(12,2),
  ads_cpk numeric(12,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, month)
);

create index if not exists monthly_snapshots_brand_idx on monthly_snapshots (brand_id, month desc);

alter table monthly_snapshots enable row level security;
drop policy if exists "monthly_snapshots_via_brand" on monthly_snapshots;
create policy "monthly_snapshots_via_brand" on monthly_snapshots
  for all
  using (exists (select 1 from brands b where b.id = monthly_snapshots.brand_id and b.user_id = auth.uid()))
  with check (exists (select 1 from brands b where b.id = monthly_snapshots.brand_id and b.user_id = auth.uid()));

comment on table daily_metric_targets is 'Tägliche Aktivitäts-Targets (6 Zahlen)';
comment on table business_targets is 'Strategische Perioden-Ziele (Nordstern, MRR, Meilensteine)';
comment on table weekly_reviews is 'Persistierte Wochen-Reviews mit Auto-Snapshot';
comment on table monthly_snapshots is 'Monatliche Steuerungs-Kennzahlen';
