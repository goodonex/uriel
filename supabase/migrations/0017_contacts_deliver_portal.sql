-- Contacts: Call Notes
-- Deliver: Portal-Felder & Kunden-E-Mail

alter table contacts
  add column if not exists call_notes text not null default '';

alter table deliver_projects
  add column if not exists client_email text not null default '',
  add column if not exists deliverables jsonb not null default '[]'::jsonb,
  add column if not exists booking_url text not null default '';

comment on column contacts.call_notes is 'Freitext: Gesprächsnotizen';
comment on column deliver_projects.client_email is 'Optional: Kunden-E-Mail für Dubletten-Check';
comment on column deliver_projects.deliverables is 'Array {title, status, updated_at} — Status: geplant | in_arbeit | fertig';
comment on column deliver_projects.booking_url is 'Calendly o. ä. für Kundenportal';
