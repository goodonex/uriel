-- Brand OS — Recruiting (Stellenanzeigen pro Brand, mit Format + UTM)

do $$ begin
  if not exists (select 1 from pg_type where typname = 'recruiting_job_status') then
    create type recruiting_job_status as enum ('draft','active','paused','closed');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'recruiting_job_format') then
    create type recruiting_job_format as enum ('linkedin_organic','linkedin_ad','culturefit','other');
  end if;
end $$;

create table if not exists recruiting_jobs (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  title text not null default '',
  description text not null default '',
  requirements text not null default '',
  benefits text not null default '',
  format recruiting_job_format not null default 'culturefit',
  status recruiting_job_status not null default 'draft',
  external_url text not null default '',
  utm_campaign text not null default '',
  utm_source text not null default '',
  utm_medium text not null default '',
  views_count int not null default 0,
  applications_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists recruiting_jobs_brand_idx on recruiting_jobs (brand_id);
create index if not exists recruiting_jobs_status_idx on recruiting_jobs (brand_id, status);

alter table recruiting_jobs enable row level security;
drop policy if exists "recruiting_jobs_via_brand" on recruiting_jobs;
create policy "recruiting_jobs_via_brand" on recruiting_jobs
  for all
  using (exists (select 1 from brands b where b.id = recruiting_jobs.brand_id and b.user_id = auth.uid()))
  with check (exists (select 1 from brands b where b.id = recruiting_jobs.brand_id and b.user_id = auth.uid()));

create or replace function set_recruiting_jobs_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;
drop trigger if exists recruiting_jobs_set_updated_at on recruiting_jobs;
create trigger recruiting_jobs_set_updated_at
before update on recruiting_jobs
for each row execute function set_recruiting_jobs_updated_at();
