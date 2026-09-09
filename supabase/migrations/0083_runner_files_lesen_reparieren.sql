-- 0083 — Die Lese-Erlaubnis für `runner-files` wieder herstellen (09.09.2026)
--
-- **Der Befund.** Kevins Frage war „wieso sind die Vorschaubilder nicht
-- anzeigbar" — und die ganze Kette dahinter war in Ordnung: Runner läuft,
-- Jophiel erreichbar, Spiegel aktuell, alle zwölf `shotKey` zeigen auf
-- tatsächlich vorhandene Objekte im Bucket. Gemessen mit einer echten Sitzung
-- auf Kevins Konto:
--
--   | Zugriff auf runner-files      | sieht |
--   |------------------------------|-------|
--   | Kevin (angemeldet, 5 brands) |     0 |
--   | service_role                 |     4 |
--
--   createSignedUrls für die 12 Vorschaubilder: 0 von 12 erfolgreich,
--   jedes mit „Either the object does not exist or you do not have access".
--
-- Es fehlt also die SELECT-Erlaubnis auf `storage.objects` für diesen Bucket.
-- Bei aktivem RLS und ohne passende Policy verweigert Postgres stillschweigend
-- — und die Oberfläche kann das nicht von „Datei gibt es nicht" unterscheiden.
--
-- **Was dadurch alles unsichtbar war, nicht nur die Vorschaubilder:** Der
-- Bucket trägt den kompletten Datei-Spiegel des Runners — Loom-Skripte,
-- Follow-up-PDFs, Wochen-Galerien, Ad-Creatives. Gegengeprüft an
-- `sales/Follow-up-Analyse-Muster-.pdf` und zwei weiteren: ebenfalls 0 von 3.
-- Genau dafür war der Spiegel gebaut worden (0063, „Handy vollwertig").
--
-- **Warum die Policy aus 0063 nicht greift, ist von außen nicht feststellbar**
-- — `pg_policies` liegt in einem Schema, das PostgREST nicht ausliefert. Ob sie
-- fehlt oder fehlerhaft ist, macht für die Reparatur keinen Unterschied:
-- `drop ... if exists` gefolgt von `create` stellt beide Fälle richtig.
--
-- **Unverändert bleibt die Grenze:** Lesen darf, wer eine eigene Brand besitzt.
-- Portal-Kunden haben keine `brands`-Zeile und kommen an keine Datei. Und
-- geschrieben wird weiterhin ausschließlich vom Runner mit service_role, das
-- umgeht RLS — deshalb gibt es hier bewusst KEINE insert/update/delete-Policy.

-- Der Bucket selbst: privat, 25 MB (= FILE_MAX_BYTES im Runner). Idempotent,
-- falls 0063 nie durchgelaufen ist.
insert into storage.buckets (id, name, public, file_size_limit)
values ('runner-files', 'runner-files', false, 26214400)
on conflict (id) do update set public = false, file_size_limit = 26214400;

drop policy if exists "runner_files_owner_read" on storage.objects;

create policy "runner_files_owner_read" on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'runner-files'
    and exists (select 1 from public.brands b where b.user_id = auth.uid())
  );

-- Zwei Präzisierungen gegenüber 0063, beide als Verdachtsmomente notiert:
--
-- 1. `to authenticated` — ohne Rollen-Angabe gilt eine Policy für `public`,
--    also auch für die anonyme Rolle. Das ist nicht falsch (die
--    `brands`-Bedingung schließt sie ohnehin aus), aber es macht die Absicht
--    lesbar und verhindert, dass die Policy für `anon` ausgewertet wird.
--
-- 2. `public.brands` statt `brands` — ohne Schema entscheidet der
--    `search_path` des ausführenden Kontexts, und der ist bei
--    Storage-Zugriffen nicht derselbe wie im SQL-Editor. Zeigt er nicht auf
--    `public`, findet der Subquery die Tabelle nicht, die Bedingung wird nie
--    wahr — und der Zugriff scheitert genau so still, wie er es tat.
--
-- Nachprüfen lässt sich der Erfolg ohne Dashboard mit
-- `npx tsx scripts/verify-runner-files-zugriff.ts` — das Skript meldet sich
-- als Kevin an und versucht zu signieren, was die Oberfläche anzeigen will.
