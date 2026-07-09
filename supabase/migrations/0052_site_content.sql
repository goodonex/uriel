-- 0052: Website-CMS fürs Kundenportal (Plan: Kundenportal+CMS Phase 4).
-- Feste, von Kevin definierte Text-/Bild-Felder je Projekt. Kunde editiert NUR
-- value_draft (Trigger erzwingt das), Freigabe = Owner kopiert draft→published.
-- Kundenwebsites lesen ausschließlich die View site_content_published (anon).

create table if not exists site_content (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references deliver_projects(id) on delete cascade,
  field_key text not null,                          -- z.B. 'hero.title'
  section text not null default 'Allgemein',        -- Gruppierung im Editor
  label text not null,                              -- z.B. 'Überschrift Startseite'
  field_type text not null default 'text' check (field_type in ('text', 'textarea', 'image')),
  value_published text,
  value_draft text,
  status text not null default 'published' check (status in ('published', 'pending')),
  sort_order int not null default 0,
  updated_by uuid,
  draft_updated_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (project_id, field_key)
);

create index if not exists site_content_project_idx on site_content (project_id, section, sort_order);

alter table site_content enable row level security;

-- Owner: voller Zugriff auf Felder der eigenen Projekte
drop policy if exists "site_content_owner_all" on site_content;
create policy "site_content_owner_all" on site_content
  for all
  using (
    exists (
      select 1 from deliver_projects dp
      join brands b on b.id = dp.owner_brand_id
      where dp.id = site_content.project_id and b.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from deliver_projects dp
      join brands b on b.id = dp.owner_brand_id
      where dp.id = site_content.project_id and b.user_id = auth.uid()
    )
  );

-- Client: lesen + updaten nur im eigenen Projekt (Spalten-Schutz via Trigger)
drop policy if exists "site_content_client_select" on site_content;
create policy "site_content_client_select" on site_content
  for select
  using (
    public.client_portal_project_id() is not null
    and project_id = public.client_portal_project_id()
  );

drop policy if exists "site_content_client_update" on site_content;
create policy "site_content_client_update" on site_content
  for update
  using (
    public.client_portal_project_id() is not null
    and project_id = public.client_portal_project_id()
  )
  with check (
    public.client_portal_project_id() is not null
    and project_id = public.client_portal_project_id()
  );

-- Korrektheitskern: Clients dürfen NUR value_draft ändern; Status/Audit setzt
-- der Trigger. Jede andere Spaltenänderung durch einen Client → Exception.
create or replace function public.site_content_client_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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
    new.status := case
      when new.value_draft is distinct from new.value_published then 'pending'
      else 'published'
    end;
    new.updated_by := auth.uid();
    new.draft_updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists site_content_client_guard on site_content;
create trigger site_content_client_guard
  before update on site_content
  for each row execute function public.site_content_client_guard();

-- Öffentlicher Lesezugriff NUR auf Published-Werte über eine Definer-View —
-- die Basistabelle bleibt für anon unsichtbar (keine Drafts, keine Labels).
create or replace view public.site_content_published
with (security_invoker = off) as
  select project_id, field_key, value_published as value
  from site_content
  where value_published is not null;

revoke all on public.site_content_published from public;
grant select on public.site_content_published to anon, authenticated;

-- Bilder für Kundenwebsites: öffentlicher Bucket (Websites brauchen
-- unauthentifizierte URLs). Upload nur Owner + Projekt-Client.
insert into storage.buckets (id, name, public, file_size_limit)
values ('site-assets', 'site-assets', true, 10485760) -- 10 MB
on conflict (id) do nothing;

drop policy if exists "site_assets_owner_all" on storage.objects;
create policy "site_assets_owner_all" on storage.objects
  for all
  using (
    bucket_id = 'site-assets'
    and exists (
      select 1 from deliver_projects dp
      join brands b on b.id = dp.owner_brand_id
      where dp.id::text = (storage.foldername(name))[1] and b.user_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'site-assets'
    and exists (
      select 1 from deliver_projects dp
      join brands b on b.id = dp.owner_brand_id
      where dp.id::text = (storage.foldername(name))[1] and b.user_id = auth.uid()
    )
  );

drop policy if exists "site_assets_client_insert" on storage.objects;
create policy "site_assets_client_insert" on storage.objects
  for insert
  with check (
    bucket_id = 'site-assets'
    and public.client_portal_project_id() is not null
    and (storage.foldername(name))[1] = public.client_portal_project_id()::text
  );
