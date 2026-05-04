-- Brand OS — Phase 2 foundation schema
-- Per docs/data-model.md (foundation_icps, foundation_word_bank, foundation_positioning)

create extension if not exists "pgcrypto";

create table if not exists foundation_icps (
  id             uuid primary key default gen_random_uuid(),
  brand_id       uuid not null references brands(id) on delete cascade,
  name           text not null default '',
  age_range      text not null default '',
  location       text not null default '',
  pain_points    text[] not null default '{}',
  word_clusters  text[] not null default '{}',
  priority       int not null default 1 check (priority between 1 and 3),
  notes          text not null default '',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists foundation_icps_brand_idx on foundation_icps (brand_id);
create index if not exists foundation_icps_priority_idx on foundation_icps (brand_id, priority);

create table if not exists foundation_word_bank (
  id          uuid primary key default gen_random_uuid(),
  brand_id    uuid not null references brands(id) on delete cascade,
  word        text not null,
  type        text not null check (type in ('yes', 'no')),
  cluster     text not null default 'Allgemein',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (brand_id, word, type)
);

create index if not exists foundation_word_bank_brand_idx on foundation_word_bank (brand_id);
create index if not exists foundation_word_bank_cluster_idx on foundation_word_bank (brand_id, cluster);

create table if not exists foundation_positioning (
  id             uuid primary key default gen_random_uuid(),
  brand_id       uuid not null references brands(id) on delete cascade unique,
  statement      text not null default '',
  tone_of_voice  text not null default '',
  business_model jsonb,
  updated_at     timestamptz not null default now()
);

-- RLS policies omitted until auth lands (see 0001_brands.sql).
