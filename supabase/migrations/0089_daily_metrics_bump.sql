-- Zähler atomar erhöhen statt ganze Tageszeilen überschreiben (18.09.2026).
--
-- Anlass: Kevin hat am Handy 40 Vernetzungsanfragen getrackt; eine halbe Stunde
-- später schrieb der Laptop seine ganze Tageszeile (mit li_anfragen = 0 aus dem
-- alten Ladestand) und überschrieb die 40. Jedes Gerät hielt seine Kopie für die
-- Wahrheit. Ab jetzt schickt der Client nur noch das Delta, und die Datenbank
-- rechnet — zwei Geräte können sich nicht mehr gegenseitig löschen.
--
-- security invoker: Es gilt die bestehende RLS-Policy daily_metrics_owner_all.

create or replace function public.daily_metric_bump(
  p_brand uuid,
  p_datum date,
  p_field text,
  p_delta integer
)
returns daily_metrics
language plpgsql
security invoker
set search_path = public
as $$
declare
  ergebnis daily_metrics;
begin
  if auth.uid() is null then
    raise exception 'nicht angemeldet';
  end if;

  -- Nur echte Ganzzahl-Zählspalten; alles andere (id, datum, note, …) ist tabu.
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'daily_metrics'
      and column_name = p_field
      and data_type in ('integer', 'smallint', 'bigint')
  ) then
    raise exception 'unbekanntes Zählfeld: %', p_field;
  end if;

  execute format(
    'insert into daily_metrics (user_id, brand_id, datum, %1$I)
       values ($1, $2, $3, greatest(0, $4))
     on conflict (user_id, brand_id, datum)
       do update set %1$I = greatest(0, daily_metrics.%1$I + $4)
     returning *',
    p_field
  )
  into ergebnis
  using auth.uid(), p_brand, p_datum, p_delta;

  return ergebnis;
end;
$$;

grant execute on function public.daily_metric_bump(uuid, date, text, integer) to authenticated;
