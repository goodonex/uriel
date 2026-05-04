-- Brand OS — Promo: Kampagnen & Content-Pieces (App-Typen Phase 4)

create extension if not exists "pgcrypto";

create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  name text not null default '',
  goal text not null default '',
  start_at date not null default (now()::date),
  end_at date,
  content_piece_ids uuid[] not null default '{}',
  updated_at timestamptz not null default now()
);

create index if not exists campaigns_brand_idx on campaigns (brand_id);

create table if not exists content_pieces (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  title text not null default '',
  content jsonb not null default '{}',
  scheduled_at date not null default (now()::date),
  published_at timestamptz,
  campaign_id uuid references campaigns(id) on delete set null,
  tags jsonb not null default '{"icp_ids":[],"cluster_tags":[],"format":"post","channel":"linkedin","goal":"awareness"}',
  performance_manual jsonb not null default '{"impressions":null,"engagements":null,"leads":null,"notes":"","updated_at":null}',
  performance_api jsonb not null default '{"instagram_last_sync_at":null,"linkedin_last_sync_at":null,"instagram_metrics_json":null,"linkedin_metrics_json":null}',
  updated_at timestamptz not null default now()
);

create index if not exists content_pieces_brand_idx on content_pieces (brand_id);
create index if not exists content_pieces_scheduled_idx on content_pieces (brand_id, scheduled_at);
