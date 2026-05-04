-- Brand OS — Sales: Kontakte / Pipeline

create extension if not exists "pgcrypto";

create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  name text not null default '',
  email text not null default '',
  source_content_piece_id uuid references content_pieces(id) on delete set null,
  source_campaign_id uuid references campaigns(id) on delete set null,
  pipeline_stage text not null default 'first_contact'
    check (pipeline_stage in ('first_contact','conversation','proposal','deal','paused')),
  last_contact_at timestamptz,
  next_follow_up_at timestamptz,
  notes text not null default '',
  updated_at timestamptz not null default now()
);

create index if not exists contacts_brand_idx on contacts (brand_id);
