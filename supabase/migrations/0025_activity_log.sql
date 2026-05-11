-- Brand OS — Activity Log (Notifications + Audit Trail pro Brand)

create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  summary text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists activity_log_brand_idx on activity_log (brand_id, created_at desc);
create index if not exists activity_log_unread_idx on activity_log (brand_id, read_at) where read_at is null;
create index if not exists activity_log_entity_idx on activity_log (entity_type, entity_id);

alter table activity_log enable row level security;

drop policy if exists "activity_log_via_brand" on activity_log;
create policy "activity_log_via_brand" on activity_log
  for all
  using (
    exists (select 1 from brands b where b.id = activity_log.brand_id and b.user_id = auth.uid())
  )
  with check (
    exists (select 1 from brands b where b.id = activity_log.brand_id and b.user_id = auth.uid())
  );

comment on table activity_log is 'Cross-Entity Aktivitäten pro Brand (Notifications + Audit).';
comment on column activity_log.entity_type is 'contact | task | project | positioning | icp | business_model | content_piece';
comment on column activity_log.action is 'created | updated | completed | stage_changed | note_added | reopened | archived';
