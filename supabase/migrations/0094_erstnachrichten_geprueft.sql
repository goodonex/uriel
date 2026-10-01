-- 0094 — „Geprüft"-Haken an den Erstnachrichten (01.10.2026).
--
-- Kevin am 01.10.: Manche Erstnachrichten tragen einen PRÜFEN-Hinweis (Seite
-- nicht gefunden, Zuordnung unklar, Rolle fraglich, Seite im Umbau), stehen
-- aber trotzdem in der Erstnachrichten-Liste und gehen dort nicht blind raus.
-- Beispiel Angeline Dhillon: sellavie.ch ist nur eine Coming-Soon-Seite, der
-- Text sagte „keine Website gefunden".
--
-- Neue erste Stufe im Sales-Dashboard („Prüfen", vor den Vernetzungsanfragen):
-- Kevin sieht dort genau diese Fälle, schaut selbst nach und setzt den Haken.
-- Erst danach erscheint der Text bei den Erstnachrichten.
--
-- Der Hinweis selbst bleibt im Textfeld `firma` ("… · PRÜFEN: …"), so wie ihn
-- der Runner schreibt. Der Spiegel schickt diese Spalte nie mit, ein
-- `merge-duplicates` lässt sie deshalb unberührt. Rein additiv.

alter table linkedin_erstnachrichten add column if not exists geprueft_at timestamptz;

comment on column linkedin_erstnachrichten.geprueft_at is
  'Wann Kevin den PRÜFEN-Hinweis der Zeile selbst abgehakt hat. NULL = noch nicht geprüft; ungeprüfte Fälle stehen nicht in der Erstnachrichten-Stufe.';
