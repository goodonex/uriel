-- Öffentlicher Kunden-Fragebogen: schreibt per RPC in Foundation (SECURITY DEFINER, RLS bypass).

create or replace function public.submit_brand_onboarding(
  p_brand_id uuid,
  p_statement text,
  p_icp_notes text,
  p_tone text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  icp_id uuid;
  header text;
begin
  if not exists (select 1 from public.brands where id = p_brand_id) then
    raise exception 'invalid brand';
  end if;

  header := E'--- Onboarding ' || to_char(now() at time zone 'UTC', 'YYYY-MM-DD HH24:MI') || ' UTC ---';

  insert into public.foundation_positioning (brand_id, statement, tone_of_voice, updated_at)
  values (
    p_brand_id,
    trim(coalesce(p_statement, '')),
    coalesce(nullif(trim(p_tone), ''), ''),
    now()
  )
  on conflict (brand_id) do update set
    statement = case
      when coalesce(trim(excluded.statement), '') = '' then foundation_positioning.statement
      else trim(both E'\n' from foundation_positioning.statement
        || case when foundation_positioning.statement = '' then '' else E'\n\n' end
        || header || E'\n' || excluded.statement)
    end,
    tone_of_voice = case
      when coalesce(trim(excluded.tone_of_voice), '') = '' then foundation_positioning.tone_of_voice
      else excluded.tone_of_voice
    end,
    updated_at = now();

  select id into icp_id
  from public.foundation_icps
  where brand_id = p_brand_id
  order by priority asc
  limit 1;

  if icp_id is null then
    insert into public.foundation_icps (brand_id, name, notes, priority, updated_at)
    values (
      p_brand_id,
      'Onboarding',
      trim(coalesce(p_icp_notes, '')),
      1,
      now()
    );
  else
    update public.foundation_icps set
      notes = case
        when coalesce(trim(p_icp_notes), '') = '' then notes
        else trim(both E'\n' from notes
          || case when notes = '' then '' else E'\n\n' end
          || header || E'\n' || p_icp_notes)
      end,
      updated_at = now()
    where id = icp_id;
  end if;
end;
$$;

revoke all on function public.submit_brand_onboarding(uuid, text, text, text) from public;
grant execute on function public.submit_brand_onboarding(uuid, text, text, text) to anon, authenticated;
