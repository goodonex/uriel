alter table contacts add column if not exists referred_by_id uuid references contacts(id) on delete set null;
alter table contacts add column if not exists referral_source text;
create index if not exists contacts_referred_by_idx on contacts (referred_by_id) where referred_by_id is not null;
