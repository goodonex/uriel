-- 0051: Datei-Sharing fürs Kundenportal (Plan: Kundenportal+CMS Phase 3).
-- Privater Bucket `project-files`, Pfad-Konvention: <project_id>/<dateiname>.
-- Owner: voll (über Brand-Besitz). Client: lesen + hochladen nur im eigenen
-- Projekt-Prefix (Helper client_portal_project_id aus 0038), kein Delete.

insert into storage.buckets (id, name, public, file_size_limit)
values ('project-files', 'project-files', false, 52428800) -- 50 MB
on conflict (id) do nothing;

-- Owner: alle Operationen auf Dateien der eigenen Projekte
drop policy if exists "project_files_owner_all" on storage.objects;
create policy "project_files_owner_all" on storage.objects
  for all
  using (
    bucket_id = 'project-files'
    and exists (
      select 1
      from deliver_projects dp
      join brands b on b.id = dp.owner_brand_id
      where dp.id::text = (storage.foldername(storage.objects.name))[1]
        and b.user_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'project-files'
    and exists (
      select 1
      from deliver_projects dp
      join brands b on b.id = dp.owner_brand_id
      where dp.id::text = (storage.foldername(storage.objects.name))[1]
        and b.user_id = auth.uid()
    )
  );

-- Client: lesen im eigenen Projekt
drop policy if exists "project_files_client_select" on storage.objects;
create policy "project_files_client_select" on storage.objects
  for select
  using (
    bucket_id = 'project-files'
    and public.client_portal_project_id() is not null
    and (storage.foldername(storage.objects.name))[1] = public.client_portal_project_id()::text
  );

-- Client: hochladen ins eigene Projekt (kein Update/Delete)
drop policy if exists "project_files_client_insert" on storage.objects;
create policy "project_files_client_insert" on storage.objects
  for insert
  with check (
    bucket_id = 'project-files'
    and public.client_portal_project_id() is not null
    and (storage.foldername(storage.objects.name))[1] = public.client_portal_project_id()::text
  );
