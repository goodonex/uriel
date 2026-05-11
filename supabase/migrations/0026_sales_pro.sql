-- Brand OS — Sales-Pro: Multi-Pipeline, Email-Layer, Goals, Smart-Views,
-- Meeting-Links, Win/Loss + Tags/Pipeline-FK an contacts.

-- =================================================================
-- 1. sales_pipelines (multi-pipeline pro Brand)
-- =================================================================
create table if not exists sales_pipelines (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  name text not null,
  slug text not null,
  /** JSON-Array von { key, label, accent, won?, lost? } */
  stages jsonb not null default '[]'::jsonb,
  is_default boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, slug)
);

create index if not exists sales_pipelines_brand_idx on sales_pipelines (brand_id, sort_order);

alter table sales_pipelines enable row level security;
drop policy if exists "sales_pipelines_via_brand" on sales_pipelines;
create policy "sales_pipelines_via_brand" on sales_pipelines
  for all
  using (exists (select 1 from brands b where b.id = sales_pipelines.brand_id and b.user_id = auth.uid()))
  with check (exists (select 1 from brands b where b.id = sales_pipelines.brand_id and b.user_id = auth.uid()));

create or replace function set_sales_pipelines_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;
drop trigger if exists sales_pipelines_set_updated_at on sales_pipelines;
create trigger sales_pipelines_set_updated_at
before update on sales_pipelines
for each row execute function set_sales_pipelines_updated_at();

-- =================================================================
-- 2. contacts: pipeline_id + tags[] + stage_changed_at + lost_reason
-- =================================================================
alter table contacts
  add column if not exists pipeline_id uuid references sales_pipelines(id) on delete set null;
alter table contacts
  add column if not exists tags text[] not null default '{}'::text[];
alter table contacts
  add column if not exists stage_changed_at timestamptz;
alter table contacts
  add column if not exists won_at timestamptz;
alter table contacts
  add column if not exists lost_at timestamptz;
alter table contacts
  add column if not exists lost_reason text not null default '';

create index if not exists contacts_pipeline_idx on contacts (pipeline_id);
create index if not exists contacts_tags_idx on contacts using gin (tags);

-- Trigger: stage_changed_at automatisch bei Stage-Wechsel
create or replace function set_contacts_stage_changed_at()
returns trigger language plpgsql as $$
begin
  if (tg_op = 'INSERT') then
    new.stage_changed_at := coalesce(new.stage_changed_at, now());
  elsif (new.pipeline_stage is distinct from old.pipeline_stage) then
    new.stage_changed_at := now();
  end if;
  return new;
end;
$$;
drop trigger if exists contacts_set_stage_changed_at on contacts;
create trigger contacts_set_stage_changed_at
before insert or update on contacts
for each row execute function set_contacts_stage_changed_at();

-- =================================================================
-- 3. sales_email_templates
-- =================================================================
create table if not exists sales_email_templates (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  name text not null,
  subject text not null default '',
  body text not null default '',
  /** Optional: an welche Stage gebunden */
  stage text,
  /** Variablen-Hints, z.B. ['name','company','ansprechpartner'] */
  variables text[] not null default '{}'::text[],
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sales_email_templates_brand_idx on sales_email_templates (brand_id, sort_order);

alter table sales_email_templates enable row level security;
drop policy if exists "sales_email_templates_via_brand" on sales_email_templates;
create policy "sales_email_templates_via_brand" on sales_email_templates
  for all
  using (exists (select 1 from brands b where b.id = sales_email_templates.brand_id and b.user_id = auth.uid()))
  with check (exists (select 1 from brands b where b.id = sales_email_templates.brand_id and b.user_id = auth.uid()));

create or replace function set_sales_email_templates_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;
drop trigger if exists sales_email_templates_set_updated_at on sales_email_templates;
create trigger sales_email_templates_set_updated_at
before update on sales_email_templates
for each row execute function set_sales_email_templates_updated_at();

-- =================================================================
-- 4. sales_email_logs (manuelles Log pro Mail)
-- =================================================================
create table if not exists sales_email_logs (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  template_id uuid references sales_email_templates(id) on delete set null,
  direction text not null default 'outbound',
  subject text not null default '',
  body_preview text not null default '',
  sent_at timestamptz not null default now(),
  opened_at timestamptz,
  replied_at timestamptz,
  bounced_at timestamptz,
  /** Eindeutige Pixel-ID, falls Tracking aktiv */
  tracking_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table sales_email_logs drop constraint if exists sales_email_logs_direction_check;
alter table sales_email_logs add constraint sales_email_logs_direction_check
  check (direction in ('outbound','inbound'));

create index if not exists sales_email_logs_brand_idx on sales_email_logs (brand_id, sent_at desc);
create index if not exists sales_email_logs_contact_idx on sales_email_logs (contact_id, sent_at desc);
create index if not exists sales_email_logs_tracking_idx on sales_email_logs (tracking_id) where tracking_id is not null;

alter table sales_email_logs enable row level security;
drop policy if exists "sales_email_logs_via_brand" on sales_email_logs;
create policy "sales_email_logs_via_brand" on sales_email_logs
  for all
  using (exists (select 1 from brands b where b.id = sales_email_logs.brand_id and b.user_id = auth.uid()))
  with check (exists (select 1 from brands b where b.id = sales_email_logs.brand_id and b.user_id = auth.uid()));

create or replace function set_sales_email_logs_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;
drop trigger if exists sales_email_logs_set_updated_at on sales_email_logs;
create trigger sales_email_logs_set_updated_at
before update on sales_email_logs
for each row execute function set_sales_email_logs_updated_at();

-- =================================================================
-- 5. sales_call_logs (Quick-Log für Anrufe via tel:)
-- =================================================================
create table if not exists sales_call_logs (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  outcome text not null default 'no_pickup',
  duration_seconds int,
  notes text not null default '',
  called_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table sales_call_logs drop constraint if exists sales_call_logs_outcome_check;
alter table sales_call_logs add constraint sales_call_logs_outcome_check
  check (outcome in ('connected','no_pickup','voicemail','wrong_number','callback_requested'));

create index if not exists sales_call_logs_contact_idx on sales_call_logs (contact_id, called_at desc);
create index if not exists sales_call_logs_brand_idx on sales_call_logs (brand_id, called_at desc);

alter table sales_call_logs enable row level security;
drop policy if exists "sales_call_logs_via_brand" on sales_call_logs;
create policy "sales_call_logs_via_brand" on sales_call_logs
  for all
  using (exists (select 1 from brands b where b.id = sales_call_logs.brand_id and b.user_id = auth.uid()))
  with check (exists (select 1 from brands b where b.id = sales_call_logs.brand_id and b.user_id = auth.uid()));

-- =================================================================
-- 6. sales_goals (Wochen-Ziele pro Brand)
-- =================================================================
create table if not exists sales_goals (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  period text not null default 'week',
  /** ISO date für den Start der Periode, Mo 00:00. */
  period_start date not null,
  calls_target int not null default 0,
  mails_target int not null default 0,
  meetings_target int not null default 0,
  deals_target int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, period, period_start)
);

alter table sales_goals drop constraint if exists sales_goals_period_check;
alter table sales_goals add constraint sales_goals_period_check
  check (period in ('week','month'));

create index if not exists sales_goals_brand_idx on sales_goals (brand_id, period_start desc);

alter table sales_goals enable row level security;
drop policy if exists "sales_goals_via_brand" on sales_goals;
create policy "sales_goals_via_brand" on sales_goals
  for all
  using (exists (select 1 from brands b where b.id = sales_goals.brand_id and b.user_id = auth.uid()))
  with check (exists (select 1 from brands b where b.id = sales_goals.brand_id and b.user_id = auth.uid()));

create or replace function set_sales_goals_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;
drop trigger if exists sales_goals_set_updated_at on sales_goals;
create trigger sales_goals_set_updated_at
before update on sales_goals
for each row execute function set_sales_goals_updated_at();

-- =================================================================
-- 7. sales_views (Smart-Views / saved filter combos)
-- =================================================================
create table if not exists sales_views (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  name text not null,
  /** JSON-Filterdefinition (stage, potential, follow, tags, search, ...) */
  filter jsonb not null default '{}'::jsonb,
  is_pinned boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sales_views_brand_idx on sales_views (brand_id, sort_order);

alter table sales_views enable row level security;
drop policy if exists "sales_views_via_brand" on sales_views;
create policy "sales_views_via_brand" on sales_views
  for all
  using (exists (select 1 from brands b where b.id = sales_views.brand_id and b.user_id = auth.uid()))
  with check (exists (select 1 from brands b where b.id = sales_views.brand_id and b.user_id = auth.uid()));

create or replace function set_sales_views_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;
drop trigger if exists sales_views_set_updated_at on sales_views;
create trigger sales_views_set_updated_at
before update on sales_views
for each row execute function set_sales_views_updated_at();

-- =================================================================
-- 8. sales_meeting_links (öffentliche Buchungslinks)
-- =================================================================
create table if not exists sales_meeting_links (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  slug text not null,
  title text not null default 'Erstgespräch',
  description text not null default '',
  duration_minutes int not null default 30,
  /** JSON: { mon: [{from:'09:00',to:'12:00'}], ... } */
  availability jsonb not null default '{}'::jsonb,
  buffer_minutes int not null default 15,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, slug)
);

create index if not exists sales_meeting_links_brand_idx on sales_meeting_links (brand_id);

alter table sales_meeting_links enable row level security;
drop policy if exists "sales_meeting_links_via_brand" on sales_meeting_links;
create policy "sales_meeting_links_via_brand" on sales_meeting_links
  for all
  using (exists (select 1 from brands b where b.id = sales_meeting_links.brand_id and b.user_id = auth.uid()))
  with check (exists (select 1 from brands b where b.id = sales_meeting_links.brand_id and b.user_id = auth.uid()));

-- Public-Read für anonymes Lead-Capture (slug-basiert)
drop policy if exists "sales_meeting_links_public_read" on sales_meeting_links;
create policy "sales_meeting_links_public_read" on sales_meeting_links
  for select
  to anon, authenticated
  using (is_active = true);

create or replace function set_sales_meeting_links_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;
drop trigger if exists sales_meeting_links_set_updated_at on sales_meeting_links;
create trigger sales_meeting_links_set_updated_at
before update on sales_meeting_links
for each row execute function set_sales_meeting_links_updated_at();

-- =================================================================
-- 9. sales_bookings (gebuchte Termine via Public-Link)
-- =================================================================
create table if not exists sales_bookings (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  meeting_link_id uuid references sales_meeting_links(id) on delete set null,
  contact_id uuid references contacts(id) on delete set null,
  name text not null default '',
  email text not null default '',
  phone text not null default '',
  message text not null default '',
  /** Beginn des Termins */
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'confirmed',
  cancelled_at timestamptz,
  created_at timestamptz not null default now()
);

alter table sales_bookings drop constraint if exists sales_bookings_status_check;
alter table sales_bookings add constraint sales_bookings_status_check
  check (status in ('confirmed','cancelled','no_show','done'));

create index if not exists sales_bookings_brand_idx on sales_bookings (brand_id, starts_at desc);
create index if not exists sales_bookings_contact_idx on sales_bookings (contact_id) where contact_id is not null;
create index if not exists sales_bookings_link_idx on sales_bookings (meeting_link_id);

alter table sales_bookings enable row level security;
drop policy if exists "sales_bookings_via_brand" on sales_bookings;
create policy "sales_bookings_via_brand" on sales_bookings
  for all
  using (exists (select 1 from brands b where b.id = sales_bookings.brand_id and b.user_id = auth.uid()))
  with check (exists (select 1 from brands b where b.id = sales_bookings.brand_id and b.user_id = auth.uid()));

-- Public-Insert für anonyme Buchungen
drop policy if exists "sales_bookings_public_insert" on sales_bookings;
create policy "sales_bookings_public_insert" on sales_bookings
  for insert
  to anon, authenticated
  with check (true);

comment on table sales_pipelines is 'Multi-Pipeline Konfiguration pro Brand';
comment on table sales_email_templates is 'Wiederverwendbare Mail-Templates pro Brand';
comment on table sales_email_logs is 'Manuelles + Tracking-Log gesendeter E-Mails';
comment on table sales_call_logs is 'Quick-Log für telefonische Outreach';
comment on table sales_goals is 'Wochen-/Monats-Sales-Targets pro Brand';
comment on table sales_views is 'Gespeicherte Filterkombinationen für die Pipeline';
comment on table sales_meeting_links is 'Öffentliche Buchungslinks (Calendly-like)';
comment on table sales_bookings is 'Termine, die über sales_meeting_links gebucht wurden';
