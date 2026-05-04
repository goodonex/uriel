-- Brand OS — Discovery Mode Dokumente & Feed

create extension if not exists "pgcrypto";

create table if not exists discovery_foundation (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade unique,
  market text not null default '',
  competitors text not null default '',
  niche text not null default '',
  analysis jsonb,
  analysis_run_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists discovery_feed_items (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  category text not null check (category in ('competitor','format','trend','icp_search')),
  title text not null default '',
  summary text not null default '',
  signal_strength text not null check (signal_strength in ('low','medium','high')),
  recorded_at timestamptz not null default now()
);

create index if not exists discovery_feed_brand_idx on discovery_feed_items (brand_id);

create table if not exists discovery_settings (
  brand_id uuid primary key references brands(id) on delete cascade,
  feed_interval_days int not null default 7 check (feed_interval_days in (1, 7, 14)),
  last_feed_generated_at timestamptz,
  updated_at timestamptz not null default now()
);
