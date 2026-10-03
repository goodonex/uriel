-- 0097 — „Marktkarte" Phase 1: Wettbewerber und ihre Referenzkunden (03.10.2026).
--
-- Konkurrenz-Agenturen (und Makler mit starker Seite) als Mittelpunkt: Kevin wirft
-- einen Link ein, der Eintrag steht mit Status 'neu' im Reiter „Markt". Daran
-- hängen Referenzkunden (Footer-Credit, Referenzseite, Bewertungsportale), später
-- Beobachtungen (Instagram, Bewertungen, Rankings). Plan: docs/MARKTKARTE-PLAN.md.
--
-- Rein additiv, keine bestehende Tabelle wird angefasst. RLS wie bei
-- `entscheider_kandidaten` (0091): Zugriff nur über die eigene Brand.
-- NICHT eingespielt — das macht Kevin per `db push`.

create table if not exists wettbewerber (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,

  name text not null default '',
  -- Normalisiert: klein, ohne Protokoll, ohne www, ohne Pfad (z. B. realagency.at).
  domain text not null,
  typ text not null default 'agentur' check (typ in ('agentur', 'makler_starke_seite', 'sonstiges')),
  zielgruppe text not null default '',
  einstiegsangebot text not null default '',
  -- null = noch nicht geprüft, true/false = betreibt sichtbar Kundengewinnung/Ads-Funnel.
  kundengewinnung boolean,
  instagram text not null default '',
  linkedin text not null default '',
  notizen text not null default '',
  -- Wo gefunden (Link, Gespräch, Footer-Lauf …).
  quelle text not null default '',
  status text not null default 'neu' check (status in ('neu', 'geprueft', 'beobachten', 'verworfen')),

  created_at timestamptz not null default now()
);

create unique index if not exists wettbewerber_domain_uidx on wettbewerber (brand_id, domain);
create index if not exists wettbewerber_status_idx on wettbewerber (brand_id, status, created_at);

create table if not exists wettbewerber_referenz (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  wettbewerber_id uuid not null references wettbewerber(id) on delete cascade,

  kunde_domain text not null default '',
  kunde_name text not null default '',
  -- Verweis auf den Kontakt, falls der Kunde schon in Kevins Kontakten steht.
  contact_id uuid references contacts(id) on delete set null,
  quelle text not null default 'referenzseite'
    check (quelle in ('footer', 'referenzseite', 'trustpilot', 'google', 'linkedin')),
  -- Wie viele Schritte von der Agentur entfernt gefunden (0 = direkt, max. 2).
  tiefe smallint not null default 0 check (tiefe between 0 and 2),

  created_at timestamptz not null default now()
);

create index if not exists wettbewerber_referenz_wb_idx on wettbewerber_referenz (wettbewerber_id);
create unique index if not exists wettbewerber_referenz_uidx
  on wettbewerber_referenz (wettbewerber_id, kunde_domain, kunde_name);

-- Beobachtungen (Instagram, Bewertungen, Keyword-Rankings) — für Gabriel/SEO später.
create table if not exists wettbewerber_signal (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  wettbewerber_id uuid not null references wettbewerber(id) on delete cascade,

  typ text not null default 'sonstiges' check (typ in ('instagram', 'bewertung', 'ranking', 'sonstiges')),
  inhalt text not null default '',
  quelle_url text not null default '',

  created_at timestamptz not null default now()
);

create index if not exists wettbewerber_signal_wb_idx on wettbewerber_signal (wettbewerber_id, created_at);

alter table wettbewerber enable row level security;
drop policy if exists "wettbewerber_via_brand" on wettbewerber;
create policy "wettbewerber_via_brand" on wettbewerber
  for all
  using (exists (select 1 from brands b where b.id = wettbewerber.brand_id and b.user_id = auth.uid()))
  with check (exists (select 1 from brands b where b.id = wettbewerber.brand_id and b.user_id = auth.uid()));

alter table wettbewerber_referenz enable row level security;
drop policy if exists "wettbewerber_referenz_via_brand" on wettbewerber_referenz;
create policy "wettbewerber_referenz_via_brand" on wettbewerber_referenz
  for all
  using (exists (select 1 from brands b where b.id = wettbewerber_referenz.brand_id and b.user_id = auth.uid()))
  with check (exists (select 1 from brands b where b.id = wettbewerber_referenz.brand_id and b.user_id = auth.uid()));

alter table wettbewerber_signal enable row level security;
drop policy if exists "wettbewerber_signal_via_brand" on wettbewerber_signal;
create policy "wettbewerber_signal_via_brand" on wettbewerber_signal
  for all
  using (exists (select 1 from brands b where b.id = wettbewerber_signal.brand_id and b.user_id = auth.uid()))
  with check (exists (select 1 from brands b where b.id = wettbewerber_signal.brand_id and b.user_id = auth.uid()));
