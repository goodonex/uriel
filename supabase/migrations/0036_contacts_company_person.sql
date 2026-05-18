-- CRM UX: Firma/Person, Status, Herkunft, Follow-up-Typ, dynamische Listen

alter table contacts
  add column if not exists contact_type text not null default 'company',
  add column if not exists parent_company_id uuid references contacts(id) on delete set null,
  add column if not exists contact_status text not null default 'not_contacted',
  add column if not exists first_name text not null default '',
  add column if not exists last_name text not null default '',
  add column if not exists job_title text not null default '',
  add column if not exists address text not null default '',
  add column if not exists lead_source text not null default '',
  add column if not exists follow_up_type text not null default '';

alter table contact_lists
  add column if not exists list_type text not null default 'static',
  add column if not exists filter_json jsonb;

create index if not exists idx_contacts_parent_company on contacts(parent_company_id);
create index if not exists idx_contacts_contact_status on contacts(brand_id, contact_status);
create index if not exists idx_contacts_contact_type on contacts(brand_id, contact_type);
