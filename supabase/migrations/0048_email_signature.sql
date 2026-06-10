-- E-Mail-Signatur pro Brand (Sales + Promo Flows)
alter table brands
  add column if not exists email_signature text not null default '';

comment on column brands.email_signature is 'Signatur, wird an ausgehende Sales-Mails angehängt';
