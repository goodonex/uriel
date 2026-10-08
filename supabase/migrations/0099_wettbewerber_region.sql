-- 0099 — Marktkarte: Region (DACH / USA) und feinere Typen (08.10.2026).
--
-- Kevin will neben dem DACH-Markt auch die USA beobachten, weil dort Trends
-- früher auftauchen. Jeder Wettbewerber bekommt eine Region; bestehende
-- Einträge sind DACH. Dazu drei Typen, die der Meta-Sweep vom 03.10. schon
-- unterscheidet (Lead-Verkäufer, Software, Coach) und die in den USA den
-- Großteil der Anbieter ausmachen.
--
-- Rein additiv. NICHT eingespielt — das macht Kevin per `db push`.

alter table wettbewerber
  add column if not exists region text not null default 'dach';

alter table wettbewerber drop constraint if exists wettbewerber_region_check;
alter table wettbewerber
  add constraint wettbewerber_region_check check (region in ('dach', 'usa'));

alter table wettbewerber drop constraint if exists wettbewerber_typ_check;
alter table wettbewerber
  add constraint wettbewerber_typ_check
  check (typ in ('agentur', 'makler_starke_seite', 'lead_verkaeufer', 'software', 'coach', 'sonstiges'));

create index if not exists wettbewerber_region_idx on wettbewerber (brand_id, region, created_at);
