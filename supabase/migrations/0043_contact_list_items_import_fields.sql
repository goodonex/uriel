-- Sales Listen: zusätzliche CSV-Importfelder für Mapping + Persistenz

alter table contact_list_items
  add column if not exists ansprechpartner text not null default '',
  add column if not exists standort text not null default '',
  add column if not exists aufhaenger_angriffsflaeche text not null default '',
  add column if not exists outcome text not null default '',
  add column if not exists prio text not null default '',
  add column if not exists im_crm boolean,
  add column if not exists g_ads text not null default '',
  add column if not exists keyword text not null default '',
  add column if not exists website text not null default '';
