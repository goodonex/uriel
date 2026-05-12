-- Brand OS — Ads (Builder + Tracking + Lead-Intake)

do $$ begin
  if not exists (select 1 from pg_type where typname = 'ad_platform') then
    create type ad_platform as enum ('linkedin','meta','google','tiktok','other');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'ad_status') then
    create type ad_status as enum ('draft','live','paused','ended');
  end if;
end $$;

create table if not exists ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  name text not null default '',
  platform ad_platform not null default 'meta',
  status ad_status not null default 'draft',
  hook text not null default '',
  body text not null default '',
  cta text not null default '',
  target_url text not null default '',
  tracking_url text not null default '',
  utm_source text not null default '',
  utm_medium text not null default '',
  utm_campaign text not null default '',
  utm_content text not null default '',
  budget_total numeric(12,2) not null default 0,
  budget_spent numeric(12,2) not null default 0,
  cost_per_lead numeric(12,2) not null default 0,
  start_date date,
  end_date date,
  clicks_count int not null default 0,
  leads_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ad_campaigns_brand_idx on ad_campaigns (brand_id);
create index if not exists ad_campaigns_status_idx on ad_campaigns (brand_id, status);
create unique index if not exists ad_campaigns_utm_idx on ad_campaigns (brand_id, utm_campaign) where utm_campaign <> '';

alter table ad_campaigns enable row level security;
drop policy if exists "ad_campaigns_via_brand" on ad_campaigns;
create policy "ad_campaigns_via_brand" on ad_campaigns
  for all
  using (exists (select 1 from brands b where b.id = ad_campaigns.brand_id and b.user_id = auth.uid()))
  with check (exists (select 1 from brands b where b.id = ad_campaigns.brand_id and b.user_id = auth.uid()));

create or replace function set_ad_campaigns_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;
drop trigger if exists ad_campaigns_set_updated_at on ad_campaigns;
create trigger ad_campaigns_set_updated_at
before update on ad_campaigns
for each row execute function set_ad_campaigns_updated_at();

-- ad_clicks: pro Tracking-Klick eine Zeile
create table if not exists ad_clicks (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references ad_campaigns(id) on delete cascade,
  brand_id uuid not null references brands(id) on delete cascade,
  clicked_at timestamptz not null default now(),
  referrer text not null default '',
  user_agent text not null default '',
  ip_hash text not null default '',
  utm_content text not null default ''
);

create index if not exists ad_clicks_campaign_idx on ad_clicks (campaign_id, clicked_at desc);
create index if not exists ad_clicks_brand_idx on ad_clicks (brand_id, clicked_at desc);

alter table ad_clicks enable row level security;
drop policy if exists "ad_clicks_via_brand" on ad_clicks;
create policy "ad_clicks_via_brand" on ad_clicks
  for all
  using (exists (select 1 from brands b where b.id = ad_clicks.brand_id and b.user_id = auth.uid()))
  with check (true);

-- contacts: ad_campaign_id-FK für CRM-Zuordnung
alter table contacts
  add column if not exists ad_campaign_id uuid references ad_campaigns(id) on delete set null;
create index if not exists contacts_ad_campaign_idx on contacts (ad_campaign_id);
