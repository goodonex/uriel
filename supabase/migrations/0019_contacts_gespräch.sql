-- Brand OS — Kontakt: Erstgespräch & Qualifikation (Sales)

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS bedarf text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS ansprechpartner text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS aktuelle_situation text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS hauptproblem text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS timeline text NOT NULL DEFAULT '';

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS budget text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS ist_entscheider boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS entscheider_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS einwaende text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS naechste_schritte text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS abschluss_wahrscheinlichkeit integer DEFAULT 0;
