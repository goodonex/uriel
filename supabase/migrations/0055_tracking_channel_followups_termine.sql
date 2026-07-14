-- 0055: Follow-ups je Kanal + Termine mit Kanal-Herkunft (daily_metrics).
-- Kevins finaler Akquise-Tag:
--   LinkedIn : Vernetzung · Erstnachricht · InMail · Follow-up · (± Loom)
--   Instagram: Follow · Erstnachricht · Follow-up · (± Loom)
--   Telefon  : Cold Call · Follow-up Call
-- Cold-Mail fällt bewusst raus (Spalten coldmails/antworten_cold bleiben für
-- Altdaten unangetastet, werden aber nicht mehr befüllt/angezeigt).
--
-- Button 1 „Gemacht" (Input) bekommt pro Kanal eine eigene Follow-up-Zahl,
-- statt der bisherigen einen Sammel-Spalte `followups`.
-- Button 2 „Gebracht" (Ergebnis) erfasst Termine MIT Herkunft — nur so ist
-- ablesbar, welcher Kanal die Termine liefert (Attribution). Ersetzt fachlich
-- die herkunftslose Sammel-Spalte `termine_vereinbart`.
--
-- Idempotent, additiv — bestehende Spalten/Daten bleiben erhalten.
alter table daily_metrics
  -- Follow-ups je Kanal (Input)
  add column if not exists li_followups int not null default 0,
  add column if not exists ig_followups int not null default 0,
  add column if not exists call_followups int not null default 0,   -- Follow-up Call (Telefon)
  -- Termine mit Kanal-Herkunft (Ergebnis)
  add column if not exists termine_li int not null default 0,
  add column if not exists termine_ig int not null default 0,
  add column if not exists termine_call int not null default 0;
