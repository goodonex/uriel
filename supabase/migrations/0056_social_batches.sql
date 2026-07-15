-- 0056: Social-Content-Batches (Cockpit /content) — live + Archiv in einem.
-- Der wöchentliche Content-Batch (04_social/content-engine/weekly/<KW>/woche-<KW>.html,
-- self-contained: CSS inline, Bilder als Data-URI) wird vom lokal geöffneten Cockpit
-- (Runner erreichbar) hierher gespiegelt; die Live-Domain/das Handy liest ihn über
-- HTTPS. Zugleich das Archiv ("was haben wir wann generiert/gepostet"). Pro Brand +
-- Woche eine Zeile — brand_slug ist für spätere Kundennutzung schon vorgesehen.
-- Idempotent, additiv.

create table if not exists social_batches (
  id uuid primary key default gen_random_uuid(),
  brand_slug text not null default 'herrmann',
  week text not null,                       -- ISO-Woche, z.B. "2026-W29"
  title text not null default '',
  html text not null,                       -- self-contained Wochen-HTML
  posts_count int not null default 0,
  source_mtime double precision,            -- mtime der Quelldatei (Sync-Vergleich)
  generated_at timestamptz,
  posted boolean not null default false,    -- später: als "gepostet" markieren
  updated_at timestamptz not null default now(),
  updated_by uuid,
  unique (brand_slug, week)
);

create index if not exists social_batches_brand_week_idx
  on social_batches (brand_slug, week desc);

alter table social_batches enable row level security;

-- Zugriff nur für eingeloggte Nutzer (Kevin). Kundenportal-Lesezugriff käme später
-- als eigene, brand-scoped Policy.
drop policy if exists "social_batches_auth_all" on social_batches;
create policy "social_batches_auth_all" on social_batches
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);
