-- Contact-Listen (Sales Import)

create extension if not exists "pgcrypto";

create table if not exists contact_lists (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz default now()
);

create index if not exists contact_lists_brand_idx on contact_lists (brand_id);

create table if not exists contact_list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references contact_lists(id) on delete cascade,
  name text,
  email text,
  phone text,
  company text,
  linkedin_url text,
  notes text,
  status text not null default 'offen',
  called_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists contact_list_items_list_idx on contact_list_items (list_id);

alter table contact_lists enable row level security;

drop policy if exists contact_lists_owner on contact_lists;
create policy contact_lists_owner on contact_lists
  for all
  using (
    exists (select 1 from brands b where b.id = contact_lists.brand_id and b.user_id = auth.uid())
  )
  with check (
    exists (select 1 from brands b where b.id = contact_lists.brand_id and b.user_id = auth.uid())
  );

alter table contact_list_items enable row level security;

drop policy if exists contact_list_items_owner on contact_list_items;
create policy contact_list_items_owner on contact_list_items
  for all
  using (
    exists (
      select 1 from contact_lists cl
      join brands b on b.id = cl.brand_id
      where cl.id = contact_list_items.list_id and b.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from contact_lists cl
      join brands b on b.id = cl.brand_id
      where cl.id = contact_list_items.list_id and b.user_id = auth.uid()
    )
  );
