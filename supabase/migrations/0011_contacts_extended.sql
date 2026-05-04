-- Brand OS — Kontakt-Profil + Aktivitäts-Log (Sales Vollmaske)

alter table contacts
  add column if not exists phone text not null default '',
  add column if not exists website text not null default '',
  add column if not exists instagram text not null default '',
  add column if not exists linkedin text not null default '',
  add column if not exists company text not null default '',
  add column if not exists activity_log jsonb not null default '[]'::jsonb;

comment on column contacts.activity_log is 'Array von {id, text, at} — CRM-Aktivität';
