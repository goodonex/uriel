-- ============================================================
-- 0049 — daily_metrics: tägliches Sales-KPI-Tracking je Kanal
-- REBUILD-PLAN §9. Manuell im Supabase-Dashboard ausführen.
-- ============================================================

create table if not exists daily_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  brand_id uuid not null references brands(id) on delete cascade,
  datum date not null,

  -- Input (täglich zählen, je Kanal getrennt)
  li_anfragen int not null default 0,
  inmails int not null default 0,
  ig_anfragen int not null default 0,
  coldmails int not null default 0,
  followups int not null default 0,
  looms int not null default 0,

  -- Ergebnis (nachlaufend) — Antworten je Kanal, sonst ist die
  -- Kanal-Antwortrate (DER Steuerungshebel) nicht berechenbar
  antworten_li int not null default 0,
  antworten_inmail int not null default 0,
  antworten_ig int not null default 0,
  antworten_cold int not null default 0,
  quali_termine int not null default 0,
  sales_calls int not null default 0,
  abschluesse int not null default 0,
  umsatz numeric not null default 0,

  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, brand_id, datum)
);

create index if not exists daily_metrics_user_brand_datum_idx
  on daily_metrics (user_id, brand_id, datum desc);

-- RLS (Muster aus 0009: Owner-only)
alter table daily_metrics enable row level security;

drop policy if exists "daily_metrics_owner_all" on daily_metrics;
create policy "daily_metrics_owner_all" on daily_metrics
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- updated_at automatisch pflegen
create or replace function set_daily_metrics_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists daily_metrics_updated_at on daily_metrics;
create trigger daily_metrics_updated_at
  before update on daily_metrics
  for each row execute function set_daily_metrics_updated_at();
