-- Kontakt-Listen: Favorit + Ausblenden

alter table contact_lists
  add column if not exists is_favorite boolean not null default false,
  add column if not exists is_hidden boolean not null default false;

create index if not exists contact_lists_brand_visible_idx
  on contact_lists (brand_id, is_hidden, is_favorite);
