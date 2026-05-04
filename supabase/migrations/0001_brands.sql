-- Brand OS — Phase 1 schema
-- Brands table per docs/data-model.md

create extension if not exists "pgcrypto";

create table if not exists brands (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,
  name        text not null,
  slug        text not null unique,
  color       text,
  created_at  timestamptz not null default now()
);

create index if not exists brands_user_id_idx on brands (user_id);

-- RLS will be enabled when auth lands in a later phase.
-- alter table brands enable row level security;
-- create policy "brands are visible to their owner"
--   on brands for select using (auth.uid() = user_id);
-- create policy "owner can insert brands"
--   on brands for insert with check (auth.uid() = user_id);
-- create policy "owner can update own brands"
--   on brands for update using (auth.uid() = user_id);
-- create policy "owner can delete own brands"
--   on brands for delete using (auth.uid() = user_id);
