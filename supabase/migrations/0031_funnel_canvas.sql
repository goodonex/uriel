-- Brand OS — Promo Funnel Canvas (Whiteboard: Funnels, Nodes, Edges)

create table if not exists funnels (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  name text not null default 'Neuer Funnel',
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists funnels_brand_idx on funnels (brand_id);

create table if not exists funnel_nodes (
  id uuid primary key default gen_random_uuid(),
  funnel_id uuid not null references funnels(id) on delete cascade,
  type text not null,
  label text not null,
  position_x integer not null default 0,
  position_y integer not null default 0,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists funnel_nodes_funnel_idx on funnel_nodes (funnel_id);

create table if not exists funnel_edges (
  id uuid primary key default gen_random_uuid(),
  funnel_id uuid not null references funnels(id) on delete cascade,
  source_node_id uuid not null references funnel_nodes(id) on delete cascade,
  target_node_id uuid not null references funnel_nodes(id) on delete cascade,
  label text,
  variant text,
  created_at timestamptz not null default now()
);

create index if not exists funnel_edges_funnel_idx on funnel_edges (funnel_id);
create index if not exists funnel_edges_source_idx on funnel_edges (source_node_id);
create index if not exists funnel_edges_target_idx on funnel_edges (target_node_id);

alter table funnels enable row level security;
alter table funnel_nodes enable row level security;
alter table funnel_edges enable row level security;

drop policy if exists "funnels_via_brand" on funnels;
create policy "funnels_via_brand" on funnels
  for all
  using (exists (select 1 from brands b where b.id = funnels.brand_id and b.user_id = auth.uid()))
  with check (exists (select 1 from brands b where b.id = funnels.brand_id and b.user_id = auth.uid()));

drop policy if exists "funnel_nodes_via_funnel" on funnel_nodes;
create policy "funnel_nodes_via_funnel" on funnel_nodes
  for all
  using (
    exists (
      select 1 from funnels f
      join brands b on b.id = f.brand_id
      where f.id = funnel_nodes.funnel_id and b.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from funnels f
      join brands b on b.id = f.brand_id
      where f.id = funnel_nodes.funnel_id and b.user_id = auth.uid()
    )
  );

drop policy if exists "funnel_edges_via_funnel" on funnel_edges;
create policy "funnel_edges_via_funnel" on funnel_edges
  for all
  using (
    exists (
      select 1 from funnels f
      join brands b on b.id = f.brand_id
      where f.id = funnel_edges.funnel_id and b.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from funnels f
      join brands b on b.id = f.brand_id
      where f.id = funnel_edges.funnel_id and b.user_id = auth.uid()
    )
  );

create or replace function set_funnels_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

drop trigger if exists funnels_set_updated_at on funnels;
create trigger funnels_set_updated_at
before update on funnels
for each row execute function set_funnels_updated_at();
