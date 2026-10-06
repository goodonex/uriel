-- 0098: Anfragen an Kevin — eingegangene Vernetzungsanfragen (06.10.2026).
--
-- **Der Anlass.** Kevin am 06.10.: *„Ich will noch einen Reiter für wenn einer
-- meiner Zielgruppe mich anfragt. Wir haben dafür noch nichts, was einen Text
-- vorbereitet."* Der Netzwerk-Sync (0070) liest nur Kevins GESENDETE
-- Einladungen und seine Kontakte. Wer Kevin von sich aus anfragt, tauchte erst
-- nach der Annahme auf — und bekam dann die kalte Erstnachricht, als hätte
-- Kevin ihn angeschrieben.
--
-- **Zwei Teile, beide rein additiv.**
--
-- 1. `linkedin_anfragen` — eine Zeile je Person, die Kevin angefragt hat:
--    Notiz der Anfrage, Zielgruppen-Urteil, vorbereiteter Text und Kevins
--    Haken. Eigene Tabelle statt Spalten in `linkedin_netzwerk`, weil das eine
--    Arbeitsliste ist (Text, Status, Begründung), das andere eine Tatsache
--    über Kevins Netzwerk.
--
-- 2. `linkedin_netzwerk.richtung` — wer Kevin angefragt hat, behält das nach
--    der Annahme. Daran hängt die Regel „keine zweite, kalte Erstnachricht"
--    (`angenommenOhneErstnachricht` in `funnelStufen.ts`). Gesetzt wird sie
--    von zwei Triggern, nicht vom Runner: Der Kontakt-Sync legt die
--    Netzwerk-Zeile erst an, wenn Kevin angenommen hat — Tage nach der
--    Anfrage, in einem anderen Lauf. Ein Trigger vergisst das nicht.
--
-- Angenommen oder abgelehnt wird auf LinkedIn ausschließlich von Kevin selbst.
-- Nichts hier und nichts im Runner klickt dort.

create table if not exists linkedin_anfragen (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  -- Derselbe Schlüssel wie in `linkedin_netzwerk` (linkedin.com/in/<hier>).
  profil_key text not null,
  name text not null,
  headline text not null default '',
  profile_url text not null default '',
  -- Die persönliche Notiz der Anfrage, falls die Person eine geschrieben hat.
  notiz text not null default '',
  -- „Max Muster und 71 weitere gemeinsame Kontakte" — Kontext für Kevin.
  gemeinsame text not null default '',
  -- LinkedIn zeigt auf der Eingangsliste kein Datum. Das hier ist der Tag, an
  -- dem der Runner die Anfrage zuerst gesehen hat — höchstens einen Lauf zu spät.
  eingegangen_at timestamptz not null default now(),
  zuletzt_gesehen_at timestamptz not null default now(),
  -- Ein VOLLSTÄNDIGER Lauf fand die Anfrage nicht mehr: Kevin hat auf
  -- LinkedIn angenommen oder ignoriert (welches von beiden, sagt die
  -- Kontaktliste). Nur ein vollständiger Lauf darf das setzen.
  nicht_mehr_da_at timestamptz,
  -- Zielgruppen-Urteil aus `icpRegeln.json` (dieselbe Regel wie überall).
  icp_urteil text not null default 'unklar' check (icp_urteil in ('kern', 'rand', 'unklar', 'off')),
  icp_grund text,
  -- Kein Text, mit Begründung: Off-ICP oder vom Schreiber als kein Ziel erkannt
  -- (Coach, Recruiter, jemand, der Kevin etwas verkaufen will).
  ausgeblendet_grund text,
  firma text not null default '',
  website text not null default '',
  entwurf text,
  entwurf_at timestamptz,
  -- Wie oft der Schreib-Lauf es versucht hat — Deckel gegen Dauerkosten.
  entwurf_versuche integer not null default 0,
  -- Das Destillat der Website-Recherche (wie bei den Erstnachrichten), ohne Rohdaten.
  recherche jsonb,
  -- offen = wartet auf Kevin · gesendet = angenommen und Text raus · verworfen = Kevin will nicht
  status text not null default 'offen' check (status in ('offen', 'gesendet', 'verworfen')),
  status_at timestamptz,
  created_at timestamptz not null default now(),
  unique (brand_id, profil_key)
);

create index if not exists linkedin_anfragen_status_idx
  on linkedin_anfragen (brand_id, status, eingegangen_at);

alter table linkedin_anfragen enable row level security;

drop policy if exists "linkedin_anfragen_via_brand" on linkedin_anfragen;
create policy "linkedin_anfragen_via_brand" on linkedin_anfragen
  for all
  using (
    exists (select 1 from brands b where b.id = linkedin_anfragen.brand_id and b.user_id = auth.uid())
  )
  with check (
    exists (select 1 from brands b where b.id = linkedin_anfragen.brand_id and b.user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Die Richtung im Netzwerk
-- ---------------------------------------------------------------------------

alter table linkedin_netzwerk
  add column if not exists richtung text not null default 'ausgehend';

alter table linkedin_netzwerk
  drop constraint if exists linkedin_netzwerk_richtung_check;
alter table linkedin_netzwerk
  add constraint linkedin_netzwerk_richtung_check check (richtung in ('ausgehend', 'eingehend'));

comment on column linkedin_netzwerk.richtung is
  'eingehend = die Person hat Kevin angefragt (linkedin_anfragen). Sie bekommt keine kalte Erstnachricht.';

-- Neue Anfrage → eine schon bestehende Netzwerk-Zeile erbt die Richtung.
create or replace function linkedin_anfragen_richtung() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update linkedin_netzwerk
     set richtung = 'eingehend'
   where brand_id = new.brand_id
     and profil_key = new.profil_key
     and richtung <> 'eingehend';
  return new;
end;
$$;

drop trigger if exists linkedin_anfragen_richtung_trg on linkedin_anfragen;
create trigger linkedin_anfragen_richtung_trg
  after insert on linkedin_anfragen
  for each row execute function linkedin_anfragen_richtung();

-- Neue Netzwerk-Zeile (Kevin hat angenommen, der Kontakt-Sync legt sie an)
-- → Richtung aus der Anfrage. BEFORE INSERT greift auch beim Upsert; trifft
-- der Upsert eine bestehende Zeile, hat der Trigger oben sie schon gesetzt.
create or replace function linkedin_netzwerk_richtung() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from linkedin_anfragen a
     where a.brand_id = new.brand_id and a.profil_key = new.profil_key
  ) then
    new.richtung := 'eingehend';
  end if;
  return new;
end;
$$;

drop trigger if exists linkedin_netzwerk_richtung_trg on linkedin_netzwerk;
create trigger linkedin_netzwerk_richtung_trg
  before insert on linkedin_netzwerk
  for each row execute function linkedin_netzwerk_richtung();
