-- Brand OS — Deliver: Messaging, Soft Delete, Portal Leads

-- 1) Soft delete + stage durations on deliver_projects
alter table deliver_projects
  add column if not exists deleted_at timestamptz default null;

alter table deliver_projects
  add column if not exists stage_durations jsonb not null default '{
    "onboarding": "1 Woche",
    "discover": "2 Wochen",
    "inner_world": "2 Wochen",
    "visual_world": "3 Wochen",
    "execute": "4 Wochen"
  }'::jsonb;

comment on column deliver_projects.deleted_at is 'Soft delete — never hard-delete deliver projects';
comment on column deliver_projects.stage_durations is 'Estimated duration labels per stage for client portal';

-- 2) Lead assignment + client-facing status on contacts
alter table contacts
  add column if not exists deliver_project_id uuid
    references deliver_projects(id) on delete set null;

alter table contacts
  add column if not exists portal_lead_status text
    default 'new';

alter table contacts
  drop constraint if exists contacts_portal_lead_status_check;

alter table contacts
  add constraint contacts_portal_lead_status_check
    check (portal_lead_status in ('new', 'contacted', 'qualified', 'closed', 'lost'));

create index if not exists contacts_deliver_project_idx
  on contacts (deliver_project_id)
  where deliver_project_id is not null;

-- 3) Project messages
create table if not exists project_messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references deliver_projects(id) on delete cascade,
  sender_role text not null check (sender_role in ('owner', 'client')),
  sender_name text,
  body text not null,
  read_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists project_messages_project_idx
  on project_messages (project_id, created_at desc)
  where deleted_at is null;

alter table project_messages enable row level security;

-- Owner can read/update all messages for projects they own
drop policy if exists "project_messages_owner_all" on project_messages;
drop policy if exists "project_messages_owner_select" on project_messages;
drop policy if exists "project_messages_owner_insert" on project_messages;
drop policy if exists "project_messages_owner_update" on project_messages;

create policy "project_messages_owner_select" on project_messages
  for select
  using (
    exists (
      select 1
      from deliver_projects dp
      join brands b on b.id = dp.owner_brand_id
      where dp.id = project_messages.project_id
        and b.user_id = auth.uid()
        and dp.deleted_at is null
    )
    and deleted_at is null
  );

create policy "project_messages_owner_insert" on project_messages
  for insert
  with check (
    exists (
      select 1
      from deliver_projects dp
      join brands b on b.id = dp.owner_brand_id
      where dp.id = project_messages.project_id
        and b.user_id = auth.uid()
        and dp.deleted_at is null
    )
    and sender_role = 'owner'
  );

create policy "project_messages_owner_update" on project_messages
  for update
  using (
    exists (
      select 1
      from deliver_projects dp
      join brands b on b.id = dp.owner_brand_id
      where dp.id = project_messages.project_id
        and b.user_id = auth.uid()
        and dp.deleted_at is null
    )
  )
  with check (
    exists (
      select 1
      from deliver_projects dp
      join brands b on b.id = dp.owner_brand_id
      where dp.id = project_messages.project_id
        and b.user_id = auth.uid()
        and dp.deleted_at is null
    )
  );

-- Client can read/write messages for their assigned project
drop policy if exists "project_messages_client_select" on project_messages;
create policy "project_messages_client_select" on project_messages
  for select
  using (
    project_id in (
      select ur.project_id
      from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'client'
        and ur.project_id is not null
    )
    and deleted_at is null
  );

drop policy if exists "project_messages_client_insert" on project_messages;
create policy "project_messages_client_insert" on project_messages
  for insert
  with check (
    project_id in (
      select ur.project_id
      from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'client'
        and ur.project_id is not null
    )
    and sender_role = 'client'
  );

drop policy if exists "project_messages_client_update" on project_messages;
create policy "project_messages_client_update" on project_messages
  for update
  using (
    project_id in (
      select ur.project_id
      from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'client'
        and ur.project_id is not null
    )
  )
  with check (
    project_id in (
      select ur.project_id
      from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'client'
        and ur.project_id is not null
    )
  );

-- 4) Update deliver_projects client read policy to exclude soft-deleted
drop policy if exists "deliver_projects_client_read_own" on deliver_projects;
create policy "deliver_projects_client_read_own" on deliver_projects
  for select using (
    deleted_at is null
    and id in (
      select ur.project_id
      from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'client'
        and ur.project_id is not null
    )
  );

-- 5) Client access to assigned leads (SECURITY DEFINER helper)
create or replace function public.client_portal_project_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select ur.project_id
  from user_roles ur
  where ur.user_id = auth.uid()
    and ur.role = 'client'
    and ur.project_id is not null
  limit 1;
$$;

revoke all on function public.client_portal_project_id() from public;
grant execute on function public.client_portal_project_id() to authenticated;

drop policy if exists "contacts_client_read_portal_leads" on contacts;
create policy "contacts_client_read_portal_leads" on contacts
  for select
  using (
    deliver_project_id = public.client_portal_project_id()
    and public.client_portal_project_id() is not null
  );

drop policy if exists "contacts_client_update_portal_lead_status" on contacts;
create policy "contacts_client_update_portal_lead_status" on contacts
  for update
  using (
    deliver_project_id = public.client_portal_project_id()
    and public.client_portal_project_id() is not null
  )
  with check (
    deliver_project_id = public.client_portal_project_id()
    and public.client_portal_project_id() is not null
  );
