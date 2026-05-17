-- Lead quality + funnel attribution for CPGL economics

alter table contacts add column if not exists lead_quality text default 'unqualified';
-- lead_quality: 'unqualified' | 'good' | 'bad'

alter table contacts add column if not exists lead_value numeric(10,2);

alter table contacts add column if not exists source_funnel_id uuid references funnels(id) on delete set null;

create index if not exists idx_contacts_lead_quality on contacts(brand_id, lead_quality);
create index if not exists idx_contacts_source_funnel on contacts(source_funnel_id);
