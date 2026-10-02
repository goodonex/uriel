-- 0096 — Geschäftsführer finden + Protokoll der Prüf-Entscheidungen (02.10.2026).
--
-- Kevins Diktat vom 02.10.: Wer als Angestellter angenommen hat, ist nicht der
-- erste Ansprechpartner. Der Runner sucht den Geschäftsführer bei LinkedIn
-- heraus. Findet er ihn, steht er auf „Heute anfragen" (erster Kontakt).
-- Findet er ihn nicht, kommt er als eigener Prüfpunkt „Geschäftsführer suchen"
-- in Kevins Prüf-Liste, und Kevin schaut selbst. Antwortet der GF nach 14 Tagen
-- auf die Anfrage nicht, darf der Angestellte später doch angeschrieben werden.
--
-- Zweiter Teil: Kevin beantwortet diese Prüfpunkte anfangs selbst — „aber
-- schreib einen Log, dass man nach 30 Tagen daraus lernen kann". Deshalb ein
-- Protokoll: jede Entscheidung (von Kevin oder vom Agenten) mit Grund, damit
-- sich nach 30 Tagen zeigt, wo der Agent Kevins Urteil schon trifft.
--
-- Rein additiv: zwei Spalten mit Vorgabewert, eine neue Tabelle.

alter table entscheider_kandidaten
  add column if not exists suche_ergebnis text
    check (suche_ergebnis in ('gefunden', 'nicht_gefunden', 'unbekannt')),
  add column if not exists suche_at timestamptz;

comment on column entscheider_kandidaten.suche_ergebnis is
  'gefunden = LinkedIn-Profil per Suche gefunden (linkedin_url gesetzt) · nicht_gefunden = gesucht, nichts Sicheres · unbekannt = Name des GF selbst unbekannt (Impressum nennt keinen)';

create table if not exists pruef_protokoll (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  created_at timestamptz not null default now(),

  -- Was geprüft wurde: 'gf_suche' · 'erstnachricht_pruefen' · 'entscheider_status' · 'pruefer_urteil' · 'aussortiert' · 'freigabe'
  art text not null,
  -- Um wen es ging (Name als Text: nicht jeder hat schon einen Lead).
  name text not null,
  firma text not null default '',
  -- Wer hat entschieden: 'kevin' oder 'agent'.
  von text not null default 'agent' check (von in ('kevin', 'agent')),
  -- Das Ergebnis in einem Wort: z. B. 'gefunden', 'nicht_gefunden', 'angefragt', 'verworfen', 'geprueft', 'kein_ziel', 'unsicher', 'freigegeben'.
  entscheidung text not null,
  grund text not null default '',
  daten jsonb not null default '{}'::jsonb
);

create index if not exists pruef_protokoll_brand_zeit_idx on pruef_protokoll (brand_id, created_at desc);
create index if not exists pruef_protokoll_art_idx on pruef_protokoll (brand_id, art, entscheidung);

alter table pruef_protokoll enable row level security;
drop policy if exists "pruef_protokoll_via_brand" on pruef_protokoll;
create policy "pruef_protokoll_via_brand" on pruef_protokoll
  for all
  using (
    exists (select 1 from brands b where b.id = pruef_protokoll.brand_id and b.user_id = auth.uid())
  )
  with check (
    exists (select 1 from brands b where b.id = pruef_protokoll.brand_id and b.user_id = auth.uid())
  );
