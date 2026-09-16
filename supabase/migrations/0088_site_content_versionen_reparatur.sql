-- 0088: Reparatur an 0087 — das Zurücknehmen lief nicht.
--
-- Gefunden beim ersten echten Durchlauf am 16.09.2026, bevor ein Kunde es
-- gesehen hat:
--
--   1. `site_content_version_zurueck` brach mit "column q.wert does not exist"
--      ab. `jsonb_each_text` liefert die Spalten `key` und `value`; die
--      Funktion fragte nach `wert`. Gesichert wurde korrekt, zurückgeholt
--      werden konnte nichts — also genau der Teil, für den es die Versionen
--      überhaupt gibt.
--
--   2. Ein Live-Schalten ohne tatsächliche Änderung legte trotzdem einen Stand
--      an, sobald der aktuelle Stand vom letzten Abbild abwich. Die Liste
--      "Frühere Stände" hätte sich so mit Einträgen gefüllt, hinter denen keine
--      Veröffentlichung steht. Jetzt entsteht ein Stand nur, wenn danach
--      wirklich etwas anders draußen steht — beim Live-Schalten wie beim
--      Zurücknehmen.
--
-- Außerdem wird der eine Stand entfernt, den der Prüflauf hinterlassen hat
-- (erkennbar am Testwert). Sonst stünde in der Liste ein Eintrag, dessen
-- Wiederherstellen einen Testtext veröffentlichen würde.

-- ---------------------------------------------------------------------------
-- 1) Live schalten — Stand nur, wenn wirklich etwas veröffentlicht wird
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

  -- Nichts offen → nichts zu tun, und vor allem kein Stand ohne Anlass.
  if not exists (
    select 1
      from site_content
     where project_id = p_project
       and value_draft is not null
       and value_draft is distinct from value_published
  ) then
    return 0;
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
-- 2) Zurück auf einen früheren Stand — mit den richtigen Spaltennamen
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

  -- Würde das Zurücknehmen gar nichts ändern, bleibt alles, wie es ist —
  -- auch die Liste.
  if not exists (
    select 1
      from site_content sc
      join jsonb_each_text(stand) q on q.key = sc.field_key
     where sc.project_id = p_project
       and (sc.value_published is distinct from q.value or sc.value_draft is distinct from q.value)
  ) then
    return 0;
  end if;

  -- Auch ein Zurück ist rücknehmbar.
  perform public.site_content_stand_sichern(p_project, 'rueckname');

  perform set_config('cms.gepruefter_weg', '1', true);

  update site_content sc
     set value_published = q.value,
         value_draft = q.value,
         status = 'published',
         published_at = now(),
         updated_by = auth.uid()
    from jsonb_each_text(stand) q
   where sc.project_id = p_project
     and sc.field_key = q.key
     and (sc.value_published is distinct from q.value or sc.value_draft is distinct from q.value);

  get diagnostics anzahl = row_count;

  perform set_config('cms.gepruefter_weg', '0', true);
  return anzahl;
end;
$$;

revoke all on function public.site_content_version_zurueck(uuid, uuid) from public;
grant execute on function public.site_content_version_zurueck(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3) Den Stand aus dem Prüflauf vom 16.09. entfernen
--
-- Eng gefasst: nur das eigene Projekt, nur Stände mit genau dem Testwert.
-- ---------------------------------------------------------------------------

delete from site_content_versionen
 where project_id = 'ea5a2df6-f8d4-4eec-b8f0-3cbd4c047f8e'
   and werte ->> 'aktion.text' = 'VERSIONSTEST';
