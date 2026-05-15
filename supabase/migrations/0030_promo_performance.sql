-- Promo performance metrics (manual entry; API sync later)

create table if not exists promo_performance (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid references brands(id) on delete cascade,
  piece_id uuid references content_pieces(id) on delete set null,
  label text,
  impressions integer default 0,
  clicks integer default 0,
  leads integer default 0,
  spend numeric(10,2) default 0,
  date date not null default current_date,
  created_at timestamptz default now()
);

create index if not exists promo_performance_brand_date_idx on promo_performance (brand_id, date);

alter table promo_performance enable row level security;

create policy "owner" on promo_performance
  for all
  using (brand_id in (select id from brands where user_id = auth.uid()))
  with check (brand_id in (select id from brands where user_id = auth.uid()));
