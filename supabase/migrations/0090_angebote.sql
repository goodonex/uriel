-- 0090 — Das Angebot, das der Makler unterschreibt.
--
-- Blaupause: docs/wargames/angebot-unterschrift.md (20.09.2026).
--
-- Zwischen „der Makler sagt im Call zu" und „die Rechnung geht raus" stand
-- bisher nichts: kein Dokument, das er angenommen hat, kein Zeitpunkt, kein
-- Beleg. Diese Tabelle ist dieses Dazwischen.
--
-- **Warum kein Signatur-Produkt daneben.** Ein Dienstleistungsvertrag braucht
-- nach §§ 126b/127 BGB keine Schriftform — er braucht Textform und
-- Nachweisbarkeit: wer, wann, was genau, von wo. Das sind fünf Spalten. Ein
-- zweiter Dienst mit eigener Datenhaltung und eigenem Login wäre für dieselbe
-- Aussage die teurere Variante. Sobald ein Vertrag echte Schriftform verlangt
-- oder ein Kunde eine qualifizierte Signatur fordert, trägt diese Tabelle
-- nicht mehr — dann ein Produkt mit QES, nicht diese Spalten erweitert.
--
-- **Warum Titel, Beschreibung und Betrag in der Zeile stehen** statt als
-- Verweis auf `pakete.json`: Ein unterschriebenes Angebot muss in fünf Jahren
-- noch sagen können, was unterschrieben wurde. Ändert Kevin seine Preise, darf
-- sich das alte Angebot nicht mitverändern. Der Paket-Schlüssel bleibt
-- trotzdem stehen — für die Rechnung danach, die dasselbe Paket zieht.

create table if not exists angebote (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,

  -- Der Kontakt ist Pflicht (an ihm hängt die Rechnungsanschrift), der Lead
  -- nicht: Ein Angebot kann an jemanden gehen, der nie über LinkedIn kam.
  contact_id uuid not null references contacts(id) on delete cascade,
  lead_id uuid references leads(id) on delete set null,

  -- Das Geheimnis im Link. 32 Hex = 128 Bit; nicht ratbar. `gen_random_uuid`
  -- statt `gen_random_bytes`, damit die Migration keine Extension braucht.
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),

  -- Eingefroren beim Anlegen — siehe Kopf.
  paket text not null,
  titel text not null,
  beschreibung text not null default '',
  betrag numeric(10,2) not null,

  -- Der Retainer ist optional: nicht jedes Angebot hat einen, und wenn, dann
  -- genau einen. Er läuft monatlich weiter und ist deshalb keine Position im
  -- selben Betrag, sondern eine zweite Zahl daneben.
  retainer_paket text,
  retainer_betrag numeric(10,2),

  -- 'entwurf'   — angelegt, noch nicht verschickt
  -- 'versendet' — der Link ist raus; NUR aus diesem Zustand wird signiert
  -- 'signiert'  — Endstation, unveränderlich
  -- 'abgelehnt' — der Makler hat abgesagt
  -- 'abgelaufen'— über `gueltig_bis` hinaus, ohne Unterschrift
  status text not null default 'entwurf'
    check (status in ('entwurf', 'versendet', 'signiert', 'abgelehnt', 'abgelaufen')),

  gueltig_bis date not null default (current_date + 14),

  versendet_am timestamptz,

  -- Der Nachweis. `signiert_name` ist der getippte Name — die einfache
  -- elektronische Signatur; IP und User-Agent kommen aus den Headern der Edge
  -- Function, weil `inet_client_addr()` hinter dem Pooler die falsche Adresse
  -- liefert.
  signiert_am timestamptz,
  signiert_name text,
  signiert_ip text,
  signiert_ua text,

  notiz text not null default '',
  erstellt_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists angebote_contact_idx on angebote (contact_id, erstellt_at desc);
create index if not exists angebote_brand_idx on angebote (brand_id, status, erstellt_at desc);

-- Ein signiertes Angebot ist ein Beleg, kein Arbeitsstand: Wer den Betrag oder
-- den Namen danach ändern könnte, hätte keinen Beleg mehr. Die Regel steht in
-- der Datenbank und nicht nur in der Oberfläche, weil der Runner und die Edge
-- Function dieselbe Tabelle anfassen.
create or replace function public.angebot_signiert_ist_endstation()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'signiert' then
    if new.status is distinct from old.status
       or new.betrag is distinct from old.betrag
       or new.paket is distinct from old.paket
       or new.titel is distinct from old.titel
       or new.retainer_betrag is distinct from old.retainer_betrag
       or new.signiert_name is distinct from old.signiert_name
       or new.signiert_am is distinct from old.signiert_am then
      raise exception 'Ein signiertes Angebot ist unveraenderlich (%).', old.id;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists angebote_endstation on angebote;
create trigger angebote_endstation
  before update on angebote
  for each row execute function public.angebot_signiert_ist_endstation();

-- RLS: nur der Eigentümer der Brand, wie überall.
--
-- **Bewusst KEINE Policy für `anon`.** Der öffentliche Zugriff läuft nicht über
-- diese Tabelle, sondern über die Edge Function `angebot` mit Service-Role, die
-- genau die Zeile zum Token herausgibt. Das ist der Unterschied zwischen „das
-- Angebot ist über seinen Link erreichbar" und „alle Angebote sind erreichbar,
-- wenn man die Abfrage richtig stellt".
alter table angebote enable row level security;
drop policy if exists "angebote_via_brand" on angebote;
create policy "angebote_via_brand" on angebote
  for all
  using (
    exists (select 1 from brands b where b.id = angebote.brand_id and b.user_id = auth.uid())
  )
  with check (
    exists (select 1 from brands b where b.id = angebote.brand_id and b.user_id = auth.uid())
  );

-- Die zwei neuen Ereignisse. Die Liste wird VOLLSTÄNDIG neu gesetzt (ein
-- `check` ersetzt den alten komplett) — Stand 0081 plus die zwei hier.
alter table lead_ereignisse
  drop constraint if exists lead_ereignisse_typ_check;

alter table lead_ereignisse
  add constraint lead_ereignisse_typ_check check (typ in (
    'anfrage', 'angenommen', 'erstnachricht', 'followup', 'antwort_erhalten',
    'loom_zugesagt', 'loom_abgelehnt', 'loom_gesendet', 'loom_angesehen',
    'inmail', 'email', 'postkarte', 'anruf',
    'instagram', 'pdf',
    'uebersprungen',
    -- Neu (0090): das Angebot als eigener Vorgang. `angebot_signiert` ist der
    -- Moment, in dem der Lead zum Kunden wird — bis dahin stand dieser Übergang
    -- nirgends geschrieben.
    'angebot_gesendet', 'angebot_signiert',
    'wiedervorlage_gesetzt', 'disqualifiziert', 'reaktiviert', 'notiz'
  ));

comment on table angebote is
  'Das Angebot zwischen Zusage und Rechnung. Betrag/Titel sind beim Anlegen eingefroren; signiert = Endstation (Trigger). Oeffentlich nur ueber Edge Function `angebot` + Token, nie ueber RLS.';
