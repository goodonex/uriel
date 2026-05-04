-- Brand OS — Client-Zugriff: Projekt pro Portal-User, RLS Leserechte

alter table user_roles
  add column if not exists client_slug text;

-- Optional: weiterhin Marken-Slug für Deep-Links / Reporting (kann NULL bleiben)
-- project_id verknüpft Client-Login mit genau einem Deliver-Projekt.
alter table user_roles
  add column if not exists project_id uuid references deliver_projects(id) on delete set null;

create index if not exists user_roles_project_id_idx on user_roles (project_id)
  where project_id is not null;

comment on column user_roles.project_id is 'Für role=client: Deliver-Projekt, das im Kundenportal sichtbar ist';

-- Client darf eigenes Projekt lesen (zusätzlich zu Owner-Policies aus 0009 — OR-Verhältnis).
drop policy if exists "deliver_projects_client_read_own" on deliver_projects;
create policy "deliver_projects_client_read_own" on deliver_projects
  for select using (
    id in (
      select ur.project_id
      from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'client'
        and ur.project_id is not null
    )
  );

-- Brand-Name/Logo-Kontext für Portal: nur die Brand des verknüpften Projekts.
drop policy if exists "brands_client_read_via_project" on brands;
create policy "brands_client_read_via_project" on brands
  for select using (
    exists (
      select 1
      from user_roles ur
      join deliver_projects dp on dp.id = ur.project_id
      where ur.user_id = auth.uid()
        and ur.role = 'client'
        and dp.owner_brand_id = brands.id
    )
  );
