-- CRM Activity System (Close-inspired) — neue Einträge; sales_call_logs bleibt legacy read-only

create table if not exists activity_entries (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  activity_type text not null,
  performed_by uuid references auth.users(id) on delete set null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table activity_entries drop constraint if exists activity_entries_activity_type_check;
alter table activity_entries add constraint activity_entries_activity_type_check
  check (activity_type in (
    'presetting', 'setting', 'closing', 'terminierung',
    'unqualified', 'noshow', 'followup', 'formular', 'notiz'
  ));

create index if not exists activity_entries_contact_idx
  on activity_entries (contact_id, created_at desc);

create index if not exists activity_entries_brand_idx
  on activity_entries (brand_id, created_at desc);

alter table activity_entries enable row level security;

drop policy if exists "activity_entries_via_brand" on activity_entries;
create policy "activity_entries_via_brand" on activity_entries
  for all
  using (
    exists (select 1 from brands b where b.id = activity_entries.brand_id and b.user_id = auth.uid())
  )
  with check (
    exists (select 1 from brands b where b.id = activity_entries.brand_id and b.user_id = auth.uid())
  );

comment on table activity_entries is 'Typisierte Sales-Aktivitäten pro Lead (Presetting, Setting, Closing, …)';

-- sales_email_templates: Nutzungs-Tracking
alter table sales_email_templates
  add column if not exists last_used_at timestamptz,
  add column if not exists use_count int not null default 0;

-- Standard-Templates pro Brand (idempotent via unique name would need constraint — seed on first access in app)
