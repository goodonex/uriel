create table opportunities (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references contacts(id) on delete cascade,
  product text not null check (product in ('herrmann', 'wertavio', 'culturefit')),
  stage text not null default 'erstkontakt' check (stage in ('erstkontakt', 'gespraech', 'pitch', 'deal', 'pause', 'verloren')),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index on opportunities(contact_id);
create index on opportunities(product);
create index on opportunities(stage);
