-- 0092 — Lead-Profil und Klasse A/B/C (22.09.2026).
--
-- Kevin will je Lead auf einen Blick wissen: wirklich GF? Wie ist die Seite?
-- Meta-Anzeigen? Google-Anzeigen? Rechtsform, seit wann am Markt, wie groß das
-- Team? Und daraus eine Klasse, die die Reihenfolge im Follow-up steuert
-- (Vorgabe vom 17.09.):
--   A — zahlt schon für Anzeigen, solide Firma, aber schwache Seite (Wunschkunde)
--   B — solide Firma ohne Anzeigen, oder Anzeigen + ordentliche Seite
--   C — Einzelkämpfer, neu oder unklar
--
-- Befüllt von der Lead-Recherche des Runners (runner/linkedin/leadProfil.mjs),
-- keine zweite Recherche. Am Lead, nicht in einer eigenen Tabelle: Ein Lead hat
-- genau ein aktuelles Profil, und das Cockpit liest die Klasse neben dem Namen
-- — ein Join je Zeile wäre Aufwand ohne Gewinn. Der Verlauf früherer Profile
-- ist bewusst nicht gespeichert; `profil_at` sagt, wie alt der Stand ist.
--
-- `profil` ist jsonb, weil die Felder noch wachsen werden (Bilanzen, sobald es
-- einen erlaubten Weg gibt). Die Form steht in `baueProfil`.
--
-- Rein additiv: drei nullable Spalten, keine bestehende Zeile ändert sich.

alter table leads add column if not exists profil jsonb;
alter table leads add column if not exists klasse text check (klasse in ('A', 'B', 'C'));
alter table leads add column if not exists klasse_grund text not null default '';
alter table leads add column if not exists profil_at timestamptz;

create index if not exists leads_klasse_idx on leads (brand_id, klasse) where klasse is not null;
