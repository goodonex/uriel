-- Brand OS — Portal lead notes for client CRM

alter table contacts
  add column if not exists portal_notes text default null;

comment on column contacts.portal_notes is 'Client-side notes per lead in portal CRM';

-- Clients may update portal_notes on their project leads (extends 0038 lead update policy)
drop policy if exists contacts_client_update_portal on contacts;

create policy contacts_client_update_portal on contacts
  for update
  using (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'client'
        and ur.project_id = contacts.deliver_project_id
    )
  )
  with check (
    exists (
      select 1 from user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'client'
        and ur.project_id = contacts.deliver_project_id
    )
  );
