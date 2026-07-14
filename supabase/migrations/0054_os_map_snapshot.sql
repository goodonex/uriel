-- 0054: OS-Map-Snapshot fürs Live-Cockpit.
-- Der Agentic-OS-Graph zieht seine Objekte (Skills/Memory/Apps/Routines) vom
-- lokalen Runner (http://127.0.0.1:4711). Von der HTTPS-Live-Domain aus ist der
-- Runner nicht erreichbar (Safari blockt HTTP→HTTPS als Mixed Content) → Graph
-- leer. Lösung: Sobald das Cockpit lokal geöffnet ist und den Runner erreicht,
-- spiegelt das Frontend die frische Map in diese Tabelle; die Live-Seite liest
-- den letzten Snapshot über HTTPS. Single-User-App → eine globale Zeile.
-- Idempotent, additiv.

create table if not exists os_map_snapshot (
  id text primary key default 'global',
  data jsonb not null,
  generated_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  constraint os_map_snapshot_singleton check (id = 'global')
);

alter table os_map_snapshot enable row level security;

-- Zugriff nur für eingeloggte Nutzer (Kevin). Kein anon-Zugriff.
drop policy if exists "os_map_snapshot_auth_all" on os_map_snapshot;
create policy "os_map_snapshot_auth_all" on os_map_snapshot
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);
