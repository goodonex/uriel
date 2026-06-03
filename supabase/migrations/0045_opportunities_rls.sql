-- RLS für opportunities (Zugriff über Kontakt → Brand)

alter table opportunities enable row level security;

drop policy if exists opportunities_via_contact on opportunities;

create policy opportunities_via_contact on opportunities
  for all
  using (
    exists (
      select 1
      from contacts c
      join brands b on b.id = c.brand_id
      where c.id = opportunities.contact_id
        and b.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from contacts c
      join brands b on b.id = c.brand_id
      where c.id = opportunities.contact_id
        and b.user_id = auth.uid()
    )
  );
