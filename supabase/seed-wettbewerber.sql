-- Seed: erster Wettbewerber-Eintrag (Real Agency). NICHT Teil der Migration —
-- von Hand einspielen, nachdem 0097_wettbewerber.sql angewendet ist.
-- Quelle: Vault → 03 Bereiche/Vertrieb & Outreach/Wettbewerber-Radar/Einträge/Real Agency.md
-- Nimmt die erste Brand des Besitzers; bei mehreren Brands die brand_id unten anpassen.

with b as (select id from brands order by created_at asc limit 1)
insert into wettbewerber
  (brand_id, name, domain, typ, zielgruppe, einstiegsangebot, kundengewinnung, instagram, linkedin, notizen, quelle, status)
select
  b.id,
  'Real Agency',
  'realagency.at',
  'agentur',
  'Bauträger, Makler, Investoren (eher Projektvertrieb als Einzelmakler)',
  'Kostenloser Ersttermin, 50 %-Neukunden-Gutschein. Keine Preise sichtbar.',
  false,
  '@realagency.official',
  'realagency-official',
  E'Sitz Wien 1010, office@realagency.at, +43 676 562 33 20.\n'
  'Angebot: Immobilienmarketing aus einer Hand (Drohne, Foto, Branding, 3D-Visualisierung, virtuelle Rundgänge, Wohnungsfinder, Grundrisse, Website, Kampagnen).\n'
  'Überschneidung: Branding + Website. Unterschied: produzieren Material und Visualisierungen, keine Kundengewinnung/Ads-Funnel sichtbar (unser Vorsprung).\n'
  'Zum Abgucken: Referenzwand mit Großnamen, niedrigschwelliger Einstieg, Wohnungsfinder als Produkt.\n'
  'Offen: Unterseiten, Portfolio-Qualität, Preise, Instagram-Follower, Webinare. Nur Startseite gelesen.\n'
  'Team: Nikolai Krinner, Nina Geiger, Nicolas Oberlik, Julia Debertol, Marco Pallaoro.',
  'Konkurrenz-Fund 2026-10-03',
  'neu'
from b
on conflict (brand_id, domain) do nothing;

insert into wettbewerber_referenz (brand_id, wettbewerber_id, kunde_domain, kunde_name, quelle, tiefe)
select w.brand_id, w.id, '', k.name, 'referenzseite', 0
from wettbewerber w,
  (values ('3SI Immogroup'), ('BUWOG'), ('CBRE'), ('Engel & Völkers'), ('Raiffeisen Immobilien'), ('Strabag'), ('Soravia')) as k(name)
where w.domain = 'realagency.at'
on conflict do nothing;
