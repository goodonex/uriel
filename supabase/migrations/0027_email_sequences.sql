-- Brand OS — Email-Sequenzen (Whiteboard-Builder + Cron-Worker)
-- Tabellen: email_sequences (Flow-Definition), email_sequence_enrollments (Lead in Sequenz)

-- =================================================================
-- 1. email_sequences (Whiteboard-Definition: Nodes + Edges)
-- =================================================================
create table if not exists email_sequences (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  name text not null,
  slug text not null,
  description text not null default '',
  /**
   * Nodes-Schema:
   * [
   *   { id, type: 'start' | 'wait' | 'email' | 'condition' | 'end',
   *     position: { x: number, y: number },
   *     config: {
   *       // wait
   *       delay_days?: number, delay_hours?: number,
   *       // email
   *       template_id?: uuid, subject?: string, body?: string,
   *       // condition
   *       check?: 'opened' | 'replied' | 'not_opened' | 'not_replied',
   *       within_days?: number
   *     },
   *     next?: string,        // ID des nächsten Nodes (default-Branch)
   *     next_no?: string      // Falls condition: ID des "Nein"-Branches
   *   }
   * ]
   */
  nodes jsonb not null default '[]'::jsonb,
  active boolean not null default false,
  from_email text not null default '',
  from_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, slug)
);

create index if not exists email_sequences_brand_idx on email_sequences (brand_id);
create index if not exists email_sequences_active_idx on email_sequences (brand_id, active);

alter table email_sequences enable row level security;
drop policy if exists "email_sequences_via_brand" on email_sequences;
create policy "email_sequences_via_brand" on email_sequences
  for all
  using (exists (select 1 from brands b where b.id = email_sequences.brand_id and b.user_id = auth.uid()))
  with check (exists (select 1 from brands b where b.id = email_sequences.brand_id and b.user_id = auth.uid()));

create or replace function set_email_sequences_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;
drop trigger if exists email_sequences_set_updated_at on email_sequences;
create trigger email_sequences_set_updated_at
before update on email_sequences
for each row execute function set_email_sequences_updated_at();

-- =================================================================
-- 2. email_sequence_enrollments (Lead in einer Sequenz)
-- =================================================================
do $$ begin
  if not exists (select 1 from pg_type where typname = 'sequence_enrollment_status') then
    create type sequence_enrollment_status as enum ('active','paused','completed','stopped','error');
  end if;
end $$;

create table if not exists email_sequence_enrollments (
  id uuid primary key default gen_random_uuid(),
  sequence_id uuid not null references email_sequences(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  brand_id uuid not null references brands(id) on delete cascade,
  status sequence_enrollment_status not null default 'active',
  current_node_id text not null default 'start',
  next_run_at timestamptz not null default now(),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  last_error text not null default '',
  /** Verlauf der besuchten Nodes für Audit + Branch-Auswertung */
  history jsonb not null default '[]'::jsonb,
  unique (sequence_id, contact_id)
);

create index if not exists enrollments_due_idx on email_sequence_enrollments (next_run_at) where status = 'active';
create index if not exists enrollments_contact_idx on email_sequence_enrollments (contact_id);
create index if not exists enrollments_brand_idx on email_sequence_enrollments (brand_id);

alter table email_sequence_enrollments enable row level security;
drop policy if exists "enrollments_via_brand" on email_sequence_enrollments;
create policy "enrollments_via_brand" on email_sequence_enrollments
  for all
  using (exists (select 1 from brands b where b.id = email_sequence_enrollments.brand_id and b.user_id = auth.uid()))
  with check (exists (select 1 from brands b where b.id = email_sequence_enrollments.brand_id and b.user_id = auth.uid()));

-- =================================================================
-- 3. sales_email_logs erweitert (Bezug zur Sequenz)
-- =================================================================
alter table sales_email_logs
  add column if not exists sequence_id uuid references email_sequences(id) on delete set null;
alter table sales_email_logs
  add column if not exists enrollment_id uuid references email_sequence_enrollments(id) on delete set null;
alter table sales_email_logs
  add column if not exists resend_id text not null default '';
alter table sales_email_logs
  add column if not exists from_email text not null default '';
alter table sales_email_logs
  add column if not exists from_name text not null default '';
alter table sales_email_logs
  add column if not exists to_email text not null default '';

create index if not exists email_logs_seq_idx on sales_email_logs (sequence_id);
create index if not exists email_logs_enroll_idx on sales_email_logs (enrollment_id);
create index if not exists email_logs_tracking_idx on sales_email_logs (tracking_id);
