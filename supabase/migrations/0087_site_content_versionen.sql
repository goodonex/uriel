-- 0087: Frühere Stände der Seite — und ein Weg zurück.
--
-- Der letzte offene Punkt aus dem Postmortem vom 15.09.2026: Nach dem
-- Live-Schalten war der alte Wert weg. Ein Tippfehler im Preis, eine
-- Überschrift, die beim zweiten Lesen nicht mehr trägt — dafür gab es kein
-- Zurück, weder für den Kunden noch für die Agentur. Der einzige Rettungsweg
-- war, den Originaltext aus dem Website-Projekt herauszusuchen.
--
-- Das ist der Punkt, an dem "der Kunde schaltet selbst live" von mutig zu
-- vertretbar wird: Wer einen Fehler in einer Minute selbst zurücknehmen kann,
-- ruft nicht an.
--
-- ── Was hier NICHT gebaut wird ────────────────────────────────────────────
-- Keine Feld-Historie. Kein "wer hat wann welches Wort geändert". Das wäre ein
-- zweites System mit eigener Oberfläche, und niemand würde es benutzen: Ein
-- Kunde denkt nicht in Feldern, er denkt in "meiner Seite". Deshalb ist eine
-- Version genau eine Sache — der vollständige Stand der Seite zu einem
-- Zeitpunkt, als ein Abbild in einer Spalte. Zurückgehen heißt: dieser Stand
-- gilt wieder, ganz, für alle Felder zusammen.
--
-- Ein Abbild entsteht IMMER VOR einer Veröffentlichung und hält damit den
-- Stand fest, der bis dahin draußen stand. Die Liste im Portal liest sich
-- deshalb als "so sah die Seite vor dieser Änderung aus" — und das ist genau
-- die Frage, die jemand stellt, der etwas zurücknehmen will.
--
-- Auch das Zurückgehen sichert vorher — ein Zurück ist also selbst wieder
-- rücknehmbar. Ohne das wäre der Knopf gefährlicher als das Problem.

-- ---------------------------------------------------------------------------
-- 1) Die Abbilder
-- ---------------------------------------------------------------------------

create table if not exists site_content_versionen (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references deliver_projects(id) on delete cascade,
  erstellt_am timestamptz not null default now(),
  erstellt_von uuid,
  -- Warum es dieses Abbild gibt. Trägt die Beschriftung in der Liste.
  anlass text not null default 'live' check (anlass in ('live', 'freigabe', 'rueckname')),
  -- { field_key: value_published } über ALLE Felder des Projekts.
  werte jsonb not null,
  notiz text
);

create index if not exists site_content_versionen_projekt_idx
  on site_content_versionen (project_id, erstellt_am desc);

comment on table site_content_versionen is
  'Vollständige Abbilder der veröffentlichten Website-Inhalte je Projekt, jeweils VOR einer Veröffentlichung angelegt. Grundlage für "Stand wiederherstellen".';

alter table site_content_versionen enable row level security;

-- Owner: alles an den eigenen Projekten.
drop policy if exists "site_content_versionen_owner_all" on site_content_versionen;
create policy "site_content_versionen_owner_all" on site_content_versionen
  for all
  using (
    exists (
      select 1 from deliver_projects dp
      join brands b on b.id = dp.owner_brand_id
      where dp.id = site_content_versionen.project_id and b.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from deliver_projects dp
      join brands b on b.id = dp.owner_brand_id
      where dp.id = site_content_versionen.project_id and b.user_id = auth.uid()
    )
  );

-- Client: nur LESEN, und nur im eigenen Projekt. Geschrieben wird
-- ausschließlich über die Funktionen unten — ein Abbild ist ein Nebenprodukt
-- des Veröffentlichens, nichts, was jemand von Hand anlegt oder löscht.
drop policy if exists "site_content_versionen_client_select" on site_content_versionen;
create policy "site_content_versionen_client_select" on site_content_versionen
  for select
  using (
    public.client_portal_project_id() is not null
    and project_id = public.client_portal_project_id()
  );

-- ---------------------------------------------------------------------------
-- 2) Abbild anlegen
--
-- Nicht von außen aufrufbar: kein grant. Aufgerufen wird es nur aus den
-- Funktionen darunter, und die laufen als Eigentümer — die dürfen das ohnehin.
--
-- Zwei Sparmaßnahmen, damit die Liste brauchbar bleibt:
--   * Ein Abbild, das dem letzten gleicht, wird nicht angelegt. Sonst füllte
--     jedes Live-Schalten ohne echte Änderung die Liste mit Zwillingen.
--   * Mehr als 30 Stände je Projekt braucht niemand; ältere fallen weg.
-- ---------------------------------------------------------------------------

create or replace function public.site_content_stand_sichern(
  p_project uuid,
  p_anlass text default 'live',
  p_notiz text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  stand jsonb;
  letzter jsonb;
  neue uuid;
begin
  select jsonb_object_agg(field_key, value_published)
    into stand
    from site_content
   where project_id = p_project;

  -- Projekt ohne Felder: es gibt nichts zu sichern.
  if stand is null then
    return null;
  end if;

  select werte into letzter
    from site_content_versionen
   where project_id = p_project
   order by erstellt_am desc
   limit 1;

  if letzter is not null and letzter = stand then
    return null;
  end if;

  insert into site_content_versionen (project_id, erstellt_von, anlass, werte, notiz)
  values (p_project, auth.uid(), p_anlass, stand, p_notiz)
  returning id into neue;

  delete from site_content_versionen
   where project_id = p_project
     and id not in (
       select id
         from site_content_versionen
        where project_id = p_project
        order by erstellt_am desc
        limit 30
     );

  return neue;
end;
$$;

revoke all on function public.site_content_stand_sichern(uuid, text, text) from public;

-- ---------------------------------------------------------------------------
-- 3) Live schalten, jetzt mit Abbild davor
--
-- Sonst unverändert gegenüber 0086. Das Abbild entsteht INNERHALB derselben
-- Transaktion: entweder gibt es den Stand und die Veröffentlichung, oder
-- keines von beidem. Ein veröffentlichter Stand ohne Rückweg kann damit nicht
-- entstehen.
-- ---------------------------------------------------------------------------

create or replace function public.site_content_live_schalten(p_project uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  anzahl integer;
  ist_client boolean;
  schaltet_selbst boolean;
begin
  if not public.site_content_zugriff(p_project) then
    raise exception 'Kein Zugriff auf dieses Projekt';
  end if;

  ist_client := exists (
    select 1 from user_roles where user_id = auth.uid() and role = 'client'
  );

  if ist_client then
    select coalesce(dp.cms_autopublish, false)
      into schaltet_selbst
      from deliver_projects dp
     where dp.id = p_project;

    if not schaltet_selbst then
      raise exception 'Für dieses Projekt gibt die Agentur frei';
    end if;
  end if;

  -- Erst den Stand festhalten, der bis jetzt draußen stand.
  perform public.site_content_stand_sichern(
    p_project,
    case when ist_client then 'live' else 'freigabe' end
  );

  perform set_config('cms.gepruefter_weg', '1', true);

  update site_content
     set value_published = value_draft,
         published_at = now(),
         status = 'published',
         updated_by = auth.uid()
   where project_id = p_project
     and value_draft is not null
     and value_draft is distinct from value_published;

  get diagnostics anzahl = row_count;

  perform set_config('cms.gepruefter_weg', '0', true);
  return anzahl;
end;
$$;

revoke all on function public.site_content_live_schalten(uuid) from public;
grant execute on function public.site_content_live_schalten(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4) Zurück auf einen früheren Stand
--
-- Setzt Live-Wert UND Entwurf auf das Abbild: Nach dem Zurückgehen soll die
-- Oberfläche nicht behaupten, es lägen noch Änderungen an — der Stand ist
-- wiederhergestellt, fertig.
--
-- Felder, die es damals noch nicht gab, bleiben unangetastet. Sie zu leeren
-- wäre die schlechtere Wahl: Ein Abschnitt, der später auf die Seite kam,
-- verschwände dann ohne Zusammenhang zum Anliegen des Kunden.
--
-- Wer zurückdarf, entscheidet dieselbe Regel wie beim Live-Schalten — wer
-- veröffentlichen darf, darf auch zurücknehmen. Alles andere wäre absurd: Der
-- Fehler, den er selbst rausgeschickt hat, wäre dann nur von uns behebbar.
-- ---------------------------------------------------------------------------

create or replace function public.site_content_version_zurueck(p_project uuid, p_version uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  anzahl integer;
  ist_client boolean;
  schaltet_selbst boolean;
  stand jsonb;
begin
  if not public.site_content_zugriff(p_project) then
    raise exception 'Kein Zugriff auf dieses Projekt';
  end if;

  ist_client := exists (
    select 1 from user_roles where user_id = auth.uid() and role = 'client'
  );

  if ist_client then
    select coalesce(dp.cms_autopublish, false)
      into schaltet_selbst
      from deliver_projects dp
     where dp.id = p_project;

    if not schaltet_selbst then
      raise exception 'Für dieses Projekt gibt die Agentur frei';
    end if;
  end if;

  select werte into stand
    from site_content_versionen
   where id = p_version
     and project_id = p_project;

  if stand is null then
    raise exception 'Diesen Stand gibt es nicht';
  end if;

  -- Auch ein Zurück ist rücknehmbar.
  perform public.site_content_stand_sichern(p_project, 'rueckname');

  perform set_config('cms.gepruefter_weg', '1', true);

  update site_content sc
     set value_published = q.wert,
         value_draft = q.wert,
         status = 'published',
         published_at = now(),
         updated_by = auth.uid()
    from (select key, value from jsonb_each_text(stand)) q
   where sc.project_id = p_project
     and sc.field_key = q.key
     and (sc.value_published is distinct from q.wert or sc.value_draft is distinct from q.wert);

  get diagnostics anzahl = row_count;

  perform set_config('cms.gepruefter_weg', '0', true);
  return anzahl;
end;
$$;

revoke all on function public.site_content_version_zurueck(uuid, uuid) from public;
grant execute on function public.site_content_version_zurueck(uuid, uuid) to authenticated;

comment on function public.site_content_version_zurueck(uuid, uuid) is
  'Einen früheren Stand EINES Projekts wiederherstellen (Live-Wert und Entwurf). Sichert vorher den aktuellen Stand — das Zurück ist selbst rücknehmbar.';

-- ---------------------------------------------------------------------------
-- 5) Der erste Stand
--
-- Projekte, die es schon gibt, bekommen ihr Ausgangs-Abbild sofort. Ohne das
-- wäre die erste Veröffentlichung nach dieser Migration die einzige, für die
-- es keinen Rückweg gibt — und genau die käme vom ersten echten Kunden.
-- ---------------------------------------------------------------------------

do $$
declare
  p record;
begin
  for p in
    select distinct project_id from site_content
  loop
    perform public.site_content_stand_sichern(p.project_id, 'live', 'Stand bei Einführung der Versionen');
  end loop;
end;
$$;
