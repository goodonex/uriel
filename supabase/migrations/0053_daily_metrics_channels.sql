-- 0053: Neue Kanäle & Termin-Ergebnis im Tracking (daily_metrics).
-- Kevins realer Akquise-Tag: LinkedIn (Vernetzung/Nachrichten/InMail/Looms),
-- Instagram (Follows/Nachrichten), Sonstiges (Cold Calls/Cold-Mail/Follow-ups).
-- Ergebnis-Seite unterscheidet geführte Calls (quali_termine, sales_calls)
-- von heute NEU vereinbarten Terminen (termine_vereinbart).
-- Idempotent, additiv — bestehende Spalten/Daten bleiben unangetastet.
alter table daily_metrics
  add column if not exists li_nachrichten int not null default 0,
  add column if not exists ig_nachrichten int not null default 0,
  add column if not exists cold_calls int not null default 0,
  add column if not exists termine_vereinbart int not null default 0;
