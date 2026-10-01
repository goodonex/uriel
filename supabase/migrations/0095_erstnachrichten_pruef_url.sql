-- 0095 — URL-Eingabe in der Stufe „Prüfen" (01.10.2026).
--
-- Kevin: In der Prüf-Stufe nur Google öffnen und „Text passt" oder
-- „Aussortieren" klicken genügt nicht. Findet er die richtige Website selbst,
-- soll er sie dort eintragen können, und der Mini recherchiert den Lead mit
-- genau dieser Adresse neu und schreibt den Text neu.
--
-- `pruef_url` ist der Auftrag an den Mini: gesetzt = „diesen Lead mit dieser
-- Adresse neu bearbeiten". Beim Ersetzen des Textes setzt der Runner die Spalte
-- wieder auf NULL (zusammen mit `geprueft_at`). Rein additiv.

alter table linkedin_erstnachrichten add column if not exists pruef_url text;

comment on column linkedin_erstnachrichten.pruef_url is
  'Von Kevin in der Stufe „Prüfen" eingetragene Website. Gesetzt = der Mini recherchiert den Lead neu und ersetzt den Text; danach wieder NULL.';
