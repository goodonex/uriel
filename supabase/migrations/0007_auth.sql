-- Brand OS — Auth: Rollen pro User (Owner / Client)
-- Voraussetzung: Authentication → Email/Password im Dashboard aktiviert.

create table if not exists user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'client')),
  client_slug text references brands(slug) on delete set null
);

create index if not exists user_roles_role_idx on user_roles (role);

comment on table user_roles is 'App-Rolle: owner = Brand OS Workspace, client = Kundenportal';
