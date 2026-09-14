-- 0084: Das Website-CMS aus 0052 wird benutzbar.
--
-- Ausgangslage: 0052 hat Tabelle, RLS, Client-Guard, Bucket und beide
-- Oberflächen gebaut — und dann lag es tot da (0 Zeilen). 0069 hat den
-- öffentlichen Lesepfad zugemacht, weil die View `site_content_published`
-- NICHT nach Projekt gezogen war: wer den anon-Key aus irgendeinem Bundle
-- hatte, las die Werte ALLER Projekte samt Projekt-UUIDs. 0069 hat dafür
-- ausdrücklich die Nachfolge benannt:
--
--   „Öffentlicher Zugriff braucht eine scoped Security-Definer-FUNKTION,
--    keine offene View."
--
-- Genau das ist diese Migration. Dazu zwei Schalter je Projekt, weil ein
-- CMS zwei verschiedene Fragen beantworten muss:
--
--   cms_public       — darf die Kundenwebsite die freigegebenen Werte lesen?
--   cms_autopublish  — geht die Änderung des Kunden ohne Kevins Freigabe live?
--
-- Getrennt, weil sie sich nicht bedingen: ein aktiver Kunde (Reichentrog)
-- bekommt cms_public = true und autopublish = false — er trägt ein, Kevin
-- gibt frei. Ein Alt-Kunde, der sich selbst versorgen soll (CoLective),
-- bekommt beides true — er trägt ein, es ist live, Kevin ist raus.
-- Default bleibt für beide `false`: kein bestehendes Projekt ändert
-- durch diese Migration sein Verhalten.
--
-- Additiv: zwei Spalten, zwei Constraint-Erweiterungen, eine Funktion,
-- eine Trigger-Neufassung. Kein drop, kein Datenverlust.

-- ---------------------------------------------------------------------------
-- 1) Die zwei Schalter
-- ---------------------------------------------------------------------------

alter table deliver_projects
  add column if not exists cms_public boolean not null default false,
  add column if not exists cms_autopublish boolean not null default false;

comment on column deliver_projects.cms_public is
  'true = site_content_public() gibt die freigegebenen Werte dieses Projekts an anon heraus. Ohne diesen Schalter liest keine Website etwas (0069).';

comment on column deliver_projects.cms_autopublish is
  'true = Kunden-Änderungen gehen sofort live (kein Freigabe-Schritt im Cockpit). Für Kunden, die sich selbst versorgen sollen.';

-- ---------------------------------------------------------------------------
-- 2) Mehr Feldtypen
--
-- 'boolean' ist der wichtigere der beiden: damit wird ein Aktions-Banner
-- oder ein Hinweis ein Schalter im Portal statt einer Nachricht an Kevin.
-- 'url' ist ein Text mit anderem Eingabefeld — Validierung macht die
-- Oberfläche, nicht die Datenbank (ein zu strenger Check hier würde nur
-- Speichern kaputtmachen, ohne etwas zu schützen).
-- ---------------------------------------------------------------------------

alter table site_content drop constraint if exists site_content_field_type_check;
alter table site_content add constraint site_content_field_type_check
  check (field_type in ('text', 'textarea', 'image', 'boolean', 'url'));

-- ---------------------------------------------------------------------------
-- 3) Client-Guard mit Autopublish
--
-- Unverändert: Clients dürfen NUR value_draft anfassen, jede andere
-- Spaltenänderung fliegt raus. Neu ist der Zweig darunter — hängt das
-- Projekt auf Autopublish, schreibt der Trigger value_published gleich mit.
--
-- Reihenfolge ist der Korrektheitskern: Die Verbotsprüfung läuft gegen die
-- Werte, die der Client geschickt hat (da ist value_published noch
-- unverändert). Erst DANACH setzt der Trigger value_published selbst. Ein
-- Client kann also über Autopublish keinen beliebigen Published-Wert
-- schreiben — nur exakt den Entwurf, den er auch ohne Autopublish hätte
-- speichern dürfen.
-- ---------------------------------------------------------------------------

create or replace function public.site_content_client_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sofort_live boolean;
begin
  if exists (
    select 1 from user_roles where user_id = auth.uid() and role = 'client'
  ) then
    if new.value_published is distinct from old.value_published
       or new.field_key   is distinct from old.field_key
       or new.field_type  is distinct from old.field_type
       or new.label       is distinct from old.label
       or new.section     is distinct from old.section
       or new.sort_order  is distinct from old.sort_order
       or new.project_id  is distinct from old.project_id
       or new.published_at is distinct from old.published_at then
      raise exception 'Kunden dürfen nur Entwürfe bearbeiten';
    end if;

    new.updated_by := auth.uid();
    new.draft_updated_at := now();

    select dp.cms_autopublish into sofort_live
    from deliver_projects dp
    where dp.id = new.project_id;

    if coalesce(sofort_live, false) then
      -- Ohne Freigabe-Schritt: der Entwurf IST der Live-Wert.
      new.value_published := new.value_draft;
      new.published_at := now();
      new.status := 'published';
    else
      new.status := case
        when new.value_draft is distinct from new.value_published then 'pending'
        else 'published'
      end;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists site_content_client_guard on site_content;
create trigger site_content_client_guard
  before update on site_content
  for each row execute function public.site_content_client_guard();

-- ---------------------------------------------------------------------------
-- 4) Der öffentliche Lesepfad — die Nachfolge der View aus 0069
--
-- Security Definer, aber eng geführt:
--   * genau EIN Projekt je Aufruf, als Parameter (keine Aufzählung),
--   * nur Projekte mit cms_public = true (ausdrückliche Freischaltung),
--   * nur field_key + value_published (keine Entwürfe, keine Labels,
--     keine Sections, keine Fremdprojekte).
--
-- Die Projekt-UUID steht danach im Quelltext der Kundenwebsite. Das ist
-- kein Geheimnis und war nie eines: sie schließt exakt die Texte auf, die
-- auf derselben Seite ohnehin für jeden sichtbar sind.
-- ---------------------------------------------------------------------------

create or replace function public.site_content_public(p_project uuid)
returns table (field_key text, value text)
language sql
security definer
stable
set search_path = public
as $$
  select sc.field_key, sc.value_published
  from site_content sc
  join deliver_projects dp on dp.id = sc.project_id
  where sc.project_id = p_project
    and dp.cms_public
    and sc.value_published is not null
    and sc.value_published <> '';
$$;

revoke all on function public.site_content_public(uuid) from public;
grant execute on function public.site_content_public(uuid) to anon, authenticated;

comment on function public.site_content_public(uuid) is
  'Freigegebene CMS-Werte EINES Projekts für dessen Website. Ersetzt die in 0069 stillgelegte View site_content_published: nach Projekt gezogen und nur, wenn deliver_projects.cms_public gesetzt ist.';
