-- Brand OS — Building: Assets, SOPs, Business Model (neben foundation_positioning)

create extension if not exists "pgcrypto";

create table if not exists assets (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  name text not null default '',
  type text not null check (type in ('website','instagram','linkedin','document')),
  url text not null default '',
  embed boolean not null default false,
  updated_at timestamptz not null default now()
);

create index if not exists assets_brand_idx on assets (brand_id);

create table if not exists sops (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  title text not null default '',
  content jsonb not null default '{}',
  category text not null default 'workflow',
  updated_at timestamptz not null default now()
);

create index if not exists sops_brand_idx on sops (brand_id);

create table if not exists foundation_business_models (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade unique,
  who text not null default '',
  what text not null default '',
  how text not null default '',
  for_whom text not null default '',
  revenue text not null default '',
  updated_at timestamptz not null default now()
);
