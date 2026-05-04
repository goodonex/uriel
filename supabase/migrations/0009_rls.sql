-- Brand OS — Row Level Security (nach allen Schema-Migrationen bis inkl. deliver_projects aus 0008)
-- Voraussetzung: Tabellen existieren; Auth aktiv.

-- --- user_roles ---
alter table user_roles enable row level security;

drop policy if exists "user_roles_select_own" on user_roles;
create policy "user_roles_select_own" on user_roles
  for select using (auth.uid() = user_id);

drop policy if exists "user_roles_insert_own" on user_roles;
create policy "user_roles_insert_own" on user_roles
  for insert with check (auth.uid() = user_id);

drop policy if exists "user_roles_update_own" on user_roles;
create policy "user_roles_update_own" on user_roles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "user_roles_delete_own" on user_roles;
create policy "user_roles_delete_own" on user_roles
  for delete using (auth.uid() = user_id);

-- --- brands ---
alter table brands enable row level security;

drop policy if exists "brands_owner_all" on brands;
create policy "brands_owner_all" on brands
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- --- foundation_icps ---
alter table foundation_icps enable row level security;

drop policy if exists "foundation_icps_via_brand" on foundation_icps;
create policy "foundation_icps_via_brand" on foundation_icps
  for all
  using (
    exists (select 1 from brands b where b.id = foundation_icps.brand_id and b.user_id = auth.uid())
  )
  with check (
    exists (select 1 from brands b where b.id = foundation_icps.brand_id and b.user_id = auth.uid())
  );

-- --- foundation_word_bank ---
alter table foundation_word_bank enable row level security;

drop policy if exists "foundation_word_bank_via_brand" on foundation_word_bank;
create policy "foundation_word_bank_via_brand" on foundation_word_bank
  for all
  using (
    exists (select 1 from brands b where b.id = foundation_word_bank.brand_id and b.user_id = auth.uid())
  )
  with check (
    exists (select 1 from brands b where b.id = foundation_word_bank.brand_id and b.user_id = auth.uid())
  );

-- --- foundation_positioning ---
alter table foundation_positioning enable row level security;

drop policy if exists "foundation_positioning_via_brand" on foundation_positioning;
create policy "foundation_positioning_via_brand" on foundation_positioning
  for all
  using (
    exists (select 1 from brands b where b.id = foundation_positioning.brand_id and b.user_id = auth.uid())
  )
  with check (
    exists (select 1 from brands b where b.id = foundation_positioning.brand_id and b.user_id = auth.uid())
  );

-- --- foundation_business_models ---
alter table foundation_business_models enable row level security;

drop policy if exists "foundation_business_models_via_brand" on foundation_business_models;
create policy "foundation_business_models_via_brand" on foundation_business_models
  for all
  using (
    exists (select 1 from brands b where b.id = foundation_business_models.brand_id and b.user_id = auth.uid())
  )
  with check (
    exists (select 1 from brands b where b.id = foundation_business_models.brand_id and b.user_id = auth.uid())
  );

-- --- assets ---
alter table assets enable row level security;

drop policy if exists "assets_via_brand" on assets;
create policy "assets_via_brand" on assets
  for all
  using (
    exists (select 1 from brands b where b.id = assets.brand_id and b.user_id = auth.uid())
  )
  with check (
    exists (select 1 from brands b where b.id = assets.brand_id and b.user_id = auth.uid())
  );

-- --- sops ---
alter table sops enable row level security;

drop policy if exists "sops_via_brand" on sops;
create policy "sops_via_brand" on sops
  for all
  using (
    exists (select 1 from brands b where b.id = sops.brand_id and b.user_id = auth.uid())
  )
  with check (
    exists (select 1 from brands b where b.id = sops.brand_id and b.user_id = auth.uid())
  );

-- --- campaigns ---
alter table campaigns enable row level security;

drop policy if exists "campaigns_via_brand" on campaigns;
create policy "campaigns_via_brand" on campaigns
  for all
  using (
    exists (select 1 from brands b where b.id = campaigns.brand_id and b.user_id = auth.uid())
  )
  with check (
    exists (select 1 from brands b where b.id = campaigns.brand_id and b.user_id = auth.uid())
  );

-- --- content_pieces ---
alter table content_pieces enable row level security;

drop policy if exists "content_pieces_via_brand" on content_pieces;
create policy "content_pieces_via_brand" on content_pieces
  for all
  using (
    exists (select 1 from brands b where b.id = content_pieces.brand_id and b.user_id = auth.uid())
  )
  with check (
    exists (select 1 from brands b where b.id = content_pieces.brand_id and b.user_id = auth.uid())
  );

-- --- contacts ---
alter table contacts enable row level security;

drop policy if exists "contacts_via_brand" on contacts;
create policy "contacts_via_brand" on contacts
  for all
  using (
    exists (select 1 from brands b where b.id = contacts.brand_id and b.user_id = auth.uid())
  )
  with check (
    exists (select 1 from brands b where b.id = contacts.brand_id and b.user_id = auth.uid())
  );

-- --- discovery_foundation ---
alter table discovery_foundation enable row level security;

drop policy if exists "discovery_foundation_via_brand" on discovery_foundation;
create policy "discovery_foundation_via_brand" on discovery_foundation
  for all
  using (
    exists (select 1 from brands b where b.id = discovery_foundation.brand_id and b.user_id = auth.uid())
  )
  with check (
    exists (select 1 from brands b where b.id = discovery_foundation.brand_id and b.user_id = auth.uid())
  );

-- --- discovery_feed_items ---
alter table discovery_feed_items enable row level security;

drop policy if exists "discovery_feed_via_brand" on discovery_feed_items;
create policy "discovery_feed_via_brand" on discovery_feed_items
  for all
  using (
    exists (select 1 from brands b where b.id = discovery_feed_items.brand_id and b.user_id = auth.uid())
  )
  with check (
    exists (select 1 from brands b where b.id = discovery_feed_items.brand_id and b.user_id = auth.uid())
  );

-- --- discovery_settings ---
alter table discovery_settings enable row level security;

drop policy if exists "discovery_settings_via_brand" on discovery_settings;
create policy "discovery_settings_via_brand" on discovery_settings
  for all
  using (
    exists (select 1 from brands b where b.id = discovery_settings.brand_id and b.user_id = auth.uid())
  )
  with check (
    exists (select 1 from brands b where b.id = discovery_settings.brand_id and b.user_id = auth.uid())
  );

-- --- deliver_projects (Migration 0008) ---
alter table deliver_projects enable row level security;

drop policy if exists "deliver_projects_via_brand" on deliver_projects;
create policy "deliver_projects_via_brand" on deliver_projects
  for all
  using (
    exists (select 1 from brands b where b.id = deliver_projects.owner_brand_id and b.user_id = auth.uid())
  )
  with check (
    exists (select 1 from brands b where b.id = deliver_projects.owner_brand_id and b.user_id = auth.uid())
  );
