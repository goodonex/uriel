-- Brand OS — Deliver Modus (Projektliste; UI nutzt vorerst localStorage)
-- Später: Sync mit dieser Tabelle.

create extension if not exists "pgcrypto";

create table if not exists deliver_projects (
  id uuid primary key default gen_random_uuid(),
  owner_brand_id uuid not null references brands(id) on delete cascade,
  name text not null default '',
  client_contact_id uuid references contacts(id) on delete set null,
  status text not null default 'active' check (status in ('active','completed')),
  internal_notes text not null default '',
  client_area_notes text not null default '',
  updated_at timestamptz not null default now()
);

create index if not exists deliver_projects_brand_idx on deliver_projects (owner_brand_id);
