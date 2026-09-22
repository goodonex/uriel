-- 0091 — „Entscheider zuerst": die Anfrageliste für Geschäftsführer (22.09.2026).
--
-- Kevins Feedback zu den Erstnachrichten vom 22.09.: Angestellte bekamen die
-- Frage „Kümmerst du dich … oder liegt das bei der Geschäftsführung?", ohne
-- dass ihre Rolle geprüft war — peinlich, wenn es der GF selbst ist. Und wer
-- wirklich angestellt ist, ist der falsche erste Ansprechpartner: *„Wenn der
-- Geschäftsführer ja zum Loom sagt, muss ich mit ihr niemals reden."*
--
-- Deshalb legt die Lead-Recherche des Runners für jeden geprüften Angestellten
-- (Impressum nennt Namen, seiner ist nicht dabei) den GF aus dem Impressum hier
-- ab. Kevin sieht die Liste im Cockpit („Heute anfragen"), vernetzt sich von
-- Hand auf LinkedIn und klickt „angefragt" oder „verwerfen". Automatisch wird
-- nichts an LinkedIn geschickt.
--
-- Eigene Tabelle statt Zeilen in `leads`: Ein Kandidat ist noch kein Kontakt —
-- es gibt kein Profil, keinen Schlüssel aus dem Netzwerk, keine Historie. Erst
-- wenn er annimmt, macht der Netzwerk-Sync ihn zum Lead, wie jeden anderen.
--
-- `gf_key` ist der normalisierte Name (klein, ohne Akzente und Titel) und der
-- Dedup-Schlüssel: derselbe GF, der über zwei Mitarbeiter gefunden wird, steht
-- einmal da. Rein additiv, keine bestehende Tabelle wird angefasst.

create table if not exists entscheider_kandidaten (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,

  gf_name text not null,
  gf_key text not null,
  firma text not null default '',
  website text not null default '',

  -- Über wen der GF gefunden wurde: der Angestellte, dessen Erstnachricht
  -- zurückgestellt ist. Name zusätzlich als Text, weil nicht jeder Angestellte
  -- schon eine Zeile in `leads` hat.
  quelle_lead_id uuid references leads(id) on delete set null,
  quelle_name text not null default '',
  -- Ein Satz für Kevin, z. B. „Mira Beispiel (Maklerin) ist schon in deiner Liste".
  grund text not null default '',

  -- Bleibt leer, bis jemand das Profil kennt; das Cockpit zeigt bis dahin einen Suchlink.
  linkedin_url text,

  -- 'offen'      — steht auf „Heute anfragen"
  -- 'angefragt'  — Kevin hat die Vernetzungsanfrage von Hand geschickt
  -- 'verworfen'  — kommt nicht in Frage; der Angestellte darf dann normal angeschrieben werden
  status text not null default 'offen' check (status in ('offen', 'angefragt', 'verworfen')),
  status_at timestamptz,

  created_at timestamptz not null default now()
);

create unique index if not exists entscheider_kandidaten_gf_uidx
  on entscheider_kandidaten (brand_id, gf_key);
create index if not exists entscheider_kandidaten_status_idx
  on entscheider_kandidaten (brand_id, status, created_at);

alter table entscheider_kandidaten enable row level security;
drop policy if exists "entscheider_kandidaten_via_brand" on entscheider_kandidaten;
create policy "entscheider_kandidaten_via_brand" on entscheider_kandidaten
  for all
  using (
    exists (select 1 from brands b where b.id = entscheider_kandidaten.brand_id and b.user_id = auth.uid())
  )
  with check (
    exists (select 1 from brands b where b.id = entscheider_kandidaten.brand_id and b.user_id = auth.uid())
  );
