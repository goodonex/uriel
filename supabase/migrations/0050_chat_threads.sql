-- ============================================================
-- 0050 — Chat-Blase: mehrere Threads, optional an CRM-Kontakt gebunden
-- (assistant_conversations bleibt als Legacy: 1 Thread/Brand)
-- Manuell im Supabase-Dashboard ausführen.
-- ============================================================

create table if not exists chat_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  brand_id uuid not null references brands(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  title text not null default 'Neuer Chat',
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chat_threads_user_brand_idx
  on chat_threads (user_id, brand_id, updated_at desc);

create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references chat_threads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_thread_idx
  on chat_messages (thread_id, created_at asc);

-- RLS: Owner-only (Muster 0009)
alter table chat_threads enable row level security;
drop policy if exists "chat_threads_owner_all" on chat_threads;
create policy "chat_threads_owner_all" on chat_threads
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table chat_messages enable row level security;
drop policy if exists "chat_messages_owner_all" on chat_messages;
create policy "chat_messages_owner_all" on chat_messages
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- updated_at des Threads bei neuer Nachricht anheben
create or replace function touch_chat_thread()
returns trigger language plpgsql as $$
begin
  update chat_threads set updated_at = now() where id = new.thread_id;
  return new;
end $$;

drop trigger if exists chat_messages_touch_thread on chat_messages;
create trigger chat_messages_touch_thread
  after insert on chat_messages
  for each row execute function touch_chat_thread();
