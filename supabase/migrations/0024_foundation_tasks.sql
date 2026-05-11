-- Brand OS — Tasks pro Brand (gekoppelt an Sales-Pipeline / Deliver-Projekte)

create table if not exists foundation_tasks (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  project_id uuid references deliver_projects(id) on delete set null,
  title text not null default '',
  notes text not null default '',
  due_at timestamptz,
  status text not null default 'open',
  priority smallint not null default 2,
  source text not null default 'manual',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table foundation_tasks drop constraint if exists foundation_tasks_status_check;
alter table foundation_tasks add constraint foundation_tasks_status_check
  check (status in ('open','in_progress','done','cancelled'));

alter table foundation_tasks drop constraint if exists foundation_tasks_priority_check;
alter table foundation_tasks add constraint foundation_tasks_priority_check
  check (priority in (1, 2, 3));

alter table foundation_tasks drop constraint if exists foundation_tasks_source_check;
alter table foundation_tasks add constraint foundation_tasks_source_check
  check (source in ('manual','follow_up','system','onboarding'));

create index if not exists foundation_tasks_brand_idx on foundation_tasks (brand_id, status, due_at);
create index if not exists foundation_tasks_contact_idx on foundation_tasks (contact_id) where contact_id is not null;
create index if not exists foundation_tasks_project_idx on foundation_tasks (project_id) where project_id is not null;
create index if not exists foundation_tasks_due_idx on foundation_tasks (brand_id, due_at) where status in ('open','in_progress');

-- RLS
alter table foundation_tasks enable row level security;

drop policy if exists "foundation_tasks_via_brand" on foundation_tasks;
create policy "foundation_tasks_via_brand" on foundation_tasks
  for all
  using (
    exists (select 1 from brands b where b.id = foundation_tasks.brand_id and b.user_id = auth.uid())
  )
  with check (
    exists (select 1 from brands b where b.id = foundation_tasks.brand_id and b.user_id = auth.uid())
  );

-- Trigger: updated_at + auto-completed_at
create or replace function set_foundation_tasks_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if new.status = 'done' and old.status is distinct from 'done' then
    new.completed_at := now();
  end if;
  if new.status <> 'done' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists foundation_tasks_set_updated_at on foundation_tasks;
create trigger foundation_tasks_set_updated_at
before update on foundation_tasks
for each row execute function set_foundation_tasks_updated_at();

comment on table foundation_tasks is 'Tasks pro Brand; optional an Contact (Sales) oder DeliverProject gekoppelt.';
comment on column foundation_tasks.source is 'manual | follow_up | system | onboarding';
comment on column foundation_tasks.priority is '1 = hoch, 2 = normal, 3 = niedrig';
