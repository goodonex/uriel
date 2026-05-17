-- Brand Assistant — one conversation thread per brand

create table if not exists assistant_conversations (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  messages jsonb not null default '[]',
  updated_at timestamptz default now()
);

create unique index if not exists assistant_conversations_brand_idx on assistant_conversations(brand_id);

alter table assistant_conversations enable row level security;

drop policy if exists "owner" on assistant_conversations;
create policy "owner" on assistant_conversations
  for all
  using (brand_id in (select id from brands where user_id = auth.uid()))
  with check (brand_id in (select id from brands where user_id = auth.uid()));
