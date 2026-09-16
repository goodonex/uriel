-- 0086: Speichern und Live-Schalten sind ab jetzt zwei verschiedene Dinge.
--
-- Ausgangslage nach 0084: Steht ein Projekt auf `cms_autopublish`, macht der
-- Client-Guard aus JEDEM gespeicherten Entwurf sofort den Live-Wert. Speichern
-- IST Veröffentlichen. Daraus folgten drei Probleme, die im Postmortem vom
-- 15.09.2026 alle oben standen:
--
--   * Es gibt keinen Ort für "fertig, aber noch nicht draußen". Die Oberfläche
--     musste die Entwürfe deshalb im Browser-Tab halten — Tab zu, Arbeit weg.
--   * Ein Kunde ohne Autopublish sah nach dem Abschicken wieder den ALTEN Text,
--     weil sein wartender Entwurf nirgends angezeigt wurde.
--   * Zwanzig geänderte Felder = zwanzig einzelne Schreibvorgänge vom Browser
--     aus. Klemmt der siebte, sind sechs Felder live und vierzehn nicht.
--
-- Diese Migration dreht das um. Der Entwurf ist ab jetzt ein echter Zustand in
-- der Datenbank, und der Schritt nach draußen ist eine eigene, ausdrückliche
-- Handlung:
--
--   'draft'     — der Kunde hat getippt. Gehört nur ihm, steht nirgends draußen.
--   'pending'   — er hat es eingereicht und wartet auf die Freigabe der Agentur.
--   'published' — Entwurf und Live-Wert sind identisch.
--
-- Drei Funktionen machen die Übergänge, jede für EIN Projekt und alles-oder-
-- nichts in einer Transaktion:
--
--   site_content_live_schalten(projekt)   draft → published (alle Felder)
--   site_content_einreichen(projekt)      draft → pending
--   site_content_verwerfen(projekt)       draft ← published (zurück auf Anfang)
--
-- Additiv: ein Statuswert mehr, eine Trigger-Neufassung, drei Funktionen.
-- Kein drop, kein Datenverlust, keine neue Tabelle. Die Einreichungs-Notiz des
-- Kunden läuft als `project_messages` mit Präfix über den bestehenden Sendeweg
-- (wie die Deliverable-Abnahme aus O11/D6) — es gibt bewusst keine zweite
-- Statuswahrheit und keine Warteschlange, die jemand pflegen müsste.

-- ---------------------------------------------------------------------------
-- 1) Der dritte Zustand
-- ---------------------------------------------------------------------------

alter table site_content drop constraint if exists site_content_status_check;
alter table site_content add constraint site_content_status_check
  check (status in ('published', 'pending', 'draft'));

comment on column site_content.status is
  'draft = Kunde hat getippt, nicht eingereicht · pending = wartet auf Freigabe der Agentur · published = Entwurf ist der Live-Wert.';

-- Bestandsdaten ehrlich machen: Wo Entwurf und Live-Wert auseinanderlaufen,
-- ohne dass jemand eingereicht hat, ist der Zustand 'draft'.
--
-- `value_draft is null` heißt NICHT "der Kunde hat den Text gelöscht", sondern
-- "dieses Feld hat noch nie jemand angefasst". Ein gelöschter Text ist der
-- leere String. Diese Unterscheidung trägt jede Bedingung in dieser Datei:
-- ohne sie würde ein Live-Schalten jedes unberührte Feld auf NULL setzen und
-- damit den Text von der Kundenseite nehmen.
update site_content
   set status = 'draft'
 where status = 'published'
   and value_draft is not null
   and value_draft is distinct from value_published;

-- ---------------------------------------------------------------------------
-- 2) Darf der Aufrufer an dieses Projekt?
--
-- Eine Stelle für beide Seiten: der Kunde über seine Portal-Zuordnung, Kevin
-- über die Marke, der das Projekt gehört. Die drei Funktionen unten fragen
-- ausschließlich hier — damit gibt es genau eine Zugriffsregel und nicht drei
-- Kopien davon, die auseinanderlaufen können.
-- ---------------------------------------------------------------------------

create or replace function public.site_content_zugriff(p_project uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    coalesce(public.client_portal_project_id() = p_project, false)
    or exists (
      select 1
      from deliver_projects dp
      join brands b on b.id = dp.owner_brand_id
      where dp.id = p_project
        and b.user_id = auth.uid()
    );
$$;

revoke all on function public.site_content_zugriff(uuid) from public;
grant execute on function public.site_content_zugriff(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3) Client-Guard, neu gefasst
--
-- Unverändert der Korrektheitskern: Ein Client darf NUR value_draft anfassen,
-- jede andere Spaltenänderung fliegt raus. Weg ist der Autopublish-Zweig —
-- ein gespeicherter Entwurf geht nirgendwo mehr von allein hin.
--
-- Neu ist das Schlupfloch am Anfang: Die drei geprüften Funktionen unten setzen
-- für die Dauer IHRER Transaktion eine Markierung und dürfen dann schreiben,
-- was ein Client direkt nicht darf (value_published, status, published_at). Der
-- Wert wird mit is_local = true gesetzt und stirbt mit der Transaktion; jede
-- Anfrage aus dem Browser läuft in ihrer eigenen. Ein Client kann die Markierung
-- nicht selbst setzen — set_config liegt in pg_catalog und wird über die
-- REST-Schnittstelle nicht angeboten.
--
-- Ein einmal eingereichter Stand bleibt 'pending', auch wenn der Kunde danach
-- weitertippt: Sein Wunsch ("schau bitte drauf") gilt weiter, und die Agentur
-- sieht ohnehin den aktuellen Entwurf, nicht eine eingefrorene Kopie.
-- ---------------------------------------------------------------------------

create or replace function public.site_content_client_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(current_setting('cms.gepruefter_weg', true), '') = '1' then
    return new;
  end if;

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

    new.status := case
      when new.value_draft is not distinct from new.value_published then 'published'
      when old.status = 'pending' then 'pending'
      else 'draft'
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists site_content_client_guard on site_content;
create trigger site_content_client_guard
  before update on site_content
  for each row execute function public.site_content_client_guard();

-- ---------------------------------------------------------------------------
-- 4) Live schalten
--
-- Ein Aufruf für das ganze Projekt statt N Schreibvorgänge aus dem Browser:
-- entweder stehen alle Änderungen draußen oder keine. Genau das war vorher der
-- Weg, auf dem eine halb aktualisierte Seite entstehen konnte, ohne dass es
-- jemandem auffiel.
--
-- Ein Client darf das nur, wenn sein Projekt auf `cms_autopublish` steht. Für
-- alle anderen ist dies der Weg, den die Agentur nach der Prüfung nimmt.
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

comment on function public.site_content_live_schalten(uuid) is
  'Alle offenen Entwürfe EINES Projekts veröffentlichen — alles oder nichts. Clients nur bei cms_autopublish.';

-- ---------------------------------------------------------------------------
-- 5) Einreichen ("schau bitte drauf")
--
-- Der Mittelweg, der bisher fehlte: Der Kunde ist fertig, will es aber nicht
-- allein verantworten. Kein neues Objekt, keine Kopie der Werte — nur ein
-- Zustandswechsel auf den Feldern, die er tatsächlich geändert hat. Was er dazu
-- sagen will, geht als gewöhnliche Projekt-Nachricht raus; dadurch bekommt die
-- Agentur auch ihre Benachrichtigung, ohne dass es dafür einen zweiten
-- Mechanismus braucht.
-- ---------------------------------------------------------------------------

create or replace function public.site_content_einreichen(p_project uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  anzahl integer;
begin
  if not public.site_content_zugriff(p_project) then
    raise exception 'Kein Zugriff auf dieses Projekt';
  end if;

  perform set_config('cms.gepruefter_weg', '1', true);

  update site_content
     set status = 'pending',
         draft_updated_at = now(),
         updated_by = auth.uid()
   where project_id = p_project
     and value_draft is not null
     and value_draft is distinct from value_published;

  get diagnostics anzahl = row_count;

  perform set_config('cms.gepruefter_weg', '0', true);
  return anzahl;
end;
$$;

revoke all on function public.site_content_einreichen(uuid) from public;
grant execute on function public.site_content_einreichen(uuid) to authenticated;

comment on function public.site_content_einreichen(uuid) is
  'Offene Entwürfe EINES Projekts zur Freigabe anmelden (draft → pending). Die Notiz des Kunden läuft als project_messages.';

-- ---------------------------------------------------------------------------
-- 6) Verwerfen
--
-- Zurück auf den Stand, der draußen steht. Vorher lag das allein in der
-- Oberfläche (ein Klick, alles weg, nichts in der Datenbank) — jetzt ist es ein
-- benannter Vorgang, den beide Seiten gleich auslösen.
-- ---------------------------------------------------------------------------

create or replace function public.site_content_verwerfen(p_project uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  anzahl integer;
begin
  if not public.site_content_zugriff(p_project) then
    raise exception 'Kein Zugriff auf dieses Projekt';
  end if;

  perform set_config('cms.gepruefter_weg', '1', true);

  update site_content
     set value_draft = value_published,
         status = 'published',
         draft_updated_at = now(),
         updated_by = auth.uid()
   where project_id = p_project
     and value_draft is not null
     and value_draft is distinct from value_published;

  get diagnostics anzahl = row_count;

  perform set_config('cms.gepruefter_weg', '0', true);
  return anzahl;
end;
$$;

revoke all on function public.site_content_verwerfen(uuid) from public;
grant execute on function public.site_content_verwerfen(uuid) to authenticated;

comment on function public.site_content_verwerfen(uuid) is
  'Alle offenen Entwürfe EINES Projekts auf den veröffentlichten Stand zurücksetzen.';
