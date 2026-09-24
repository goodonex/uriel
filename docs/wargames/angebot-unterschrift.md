# Wargame — Das Angebot, das der Makler unterschreibt

> **STATUS: BLAUPAUSE.** Durchgespielt am 20.09.2026, danach in derselben
> Sitzung ausgeführt. Züge, die beim Bauen anders liefen, sind unten unter
> „Was die Realität korrigiert hat" nachgetragen.

**Repo:** `~/Kevin OS/02 Projekte/uriel` · **Branch:** `main`
**Nicht pushen** — Livegang ist Kevins Wort.

---

## Der eine Satz

Zwischen „der Makler sagt im Call zu" und „die Rechnung geht raus" steht heute
nichts: kein Dokument, das er angenommen hat, kein Zeitpunkt, kein Beleg. Diese
Runde schließt die Lücke mit dem kleinsten Ding, das sie schließt — ein Angebot
am Lead, ein Link, den der Makler öffnet, ein getippter Name als Unterschrift,
und danach steht der Lead auf Kunde und die Rechnung ist einen Klick entfernt.

## Warum kein DocuSeal

Geprüft und verworfen. DocuSeal (oder jedes andere Signatur-Produkt) wäre ein
zweiter Dienst mit eigener Datenhaltung, eigenem Login und laufenden Kosten —
für einen Dienstleistungsvertrag, der nach §§ 126b/127 BGB **keine Schriftform
braucht**. Was er braucht, ist Textform plus Nachweisbarkeit: wer, wann, was
genau, von wo. Das sind fünf Spalten, kein Produkt. Portal, PDF-Weg über den
Runner und Lead-Status existieren bereits — die Lücke ist ein Formular und eine
Tabelle, nicht eine Integration.

**Trigger für die Gegenrichtung:** Sobald Kevin einen Vertrag braucht, der
Schriftform verlangt (Arbeitsvertrag, Bürgschaft, Kündigung eines Mietvertrags)
oder ein Kunde ausdrücklich eine qualifizierte elektronische Signatur fordert,
trägt dieser Bau nicht mehr — dann ein Produkt mit QES-Anbindung, nicht dieser
Code erweitert.

---

## AUFTRAG AN DEN EXECUTOR — vor dem ersten Edit lesen

**Reihenfolge:** Z0 → Z8, keine Sprünge. Z1 (Migration) vor allem anderen, sonst
werden Typen gegen eine Tabelle geschrieben, die es nicht gibt.

**Nach JEDEM Zug:**
```bash
cd "$HOME/Kevin OS/02 Projekte/uriel" && npm run build
```
```bash
cd "$HOME/Kevin OS/02 Projekte/uriel" && for f in scripts/verify-*.ts; do npx tsx "$f" >/dev/null 2>&1 || echo "ROT $f"; done
```
Erwartung: Build grün, keine `ROT`-Zeile.

**Migrationen ausschließlich über `db push`, nie im SQL-Editor.** Das ist die
Lehre aus der zerlegten Historie (Backlog L2) und gilt hier unverändert.

---

## Z0 — Baseline

**Aktion:** `git status --short`, Build, alle `verify-*.ts`.
**Erwartete Beobachtung:** Arbeitsbaum sauber oder nur bekannte Änderungen;
Build grün; keine roten Skripte.
**Wahrscheinlichster Fehler:** Ein Skript ist schon vorher rot.
**Signal:** `ROT scripts/verify-xyz.ts` ohne dass diese Runde es angefasst hat.
**Gegenzug:** Notieren und weiterarbeiten — aber am Ende nicht als „grün"
melden, sondern die Vorbelastung nennen.

---

## Z1 — Migration `0090_angebote.sql`

**Aktion:** Tabelle `angebote` anlegen:

| Spalte | Typ | Warum |
|---|---|---|
| `id` | uuid pk | |
| `brand_id` | uuid not null | wie überall, RLS hängt daran |
| `contact_id` | uuid → contacts | der Lead, an dem das Angebot hängt |
| `lead_id` | uuid null → leads | der LinkedIn-Lead, falls es einen gibt |
| `token` | text unique not null | das Geheimnis im Link, 32 Hex |
| `paket` | text not null | Schlüssel aus `pakete.json` |
| `titel` / `beschreibung` | text | eingefroren beim Erstellen |
| `betrag` | numeric not null | eingefroren |
| `retainer_paket` | text null | `retainer-1000` / `retainer-2000` |
| `retainer_betrag` | numeric null | |
| `status` | text | `entwurf`·`versendet`·`signiert`·`abgelehnt`·`abgelaufen` |
| `gueltig_bis` | date | |
| `signiert_am` | timestamptz null | |
| `signiert_name` | text null | der getippte Name |
| `signiert_ip` / `signiert_ua` | text null | der Nachweis |

Dazu: `lead_ereignisse_typ_check` um `angebot_gesendet` und `angebot_signiert`
erweitern — **die vollständige Liste aus `0081` abschreiben und ergänzen**, nicht
nur die zwei neuen nennen; ein `check` ersetzt den alten komplett.

**Warum Preis und Titel in der Zeile stehen und nicht als Verweis auf
`pakete.json`:** Ein unterschriebenes Angebot muss in fünf Jahren noch sagen,
was unterschrieben wurde. Ändert Kevin seine Preise, darf das alte Angebot sich
nicht mitverändern.

**Erwartete Beobachtung:** `supabase db push` meldet die Migration als
angewendet; `select * from angebote limit 1` läuft (leer).
**Wahrscheinlichster Fehler:** `gen_random_bytes` fehlt, weil pgcrypto in dieser
Datenbank nicht aktiv ist.
**Signal:** `function gen_random_bytes(integer) does not exist`.
**Gegenzug:** Token-Default auf `replace(gen_random_uuid()::text, '-', '')` —
dieselbe Zufallsstärke, keine Extension nötig.
**Trigger:** Meldet `db push` eine Lücke in der Migrationshistorie → **stoppen
und melden**, nicht im SQL-Editor nachhelfen. Das ist genau der Fehler, der die
Historie schon einmal zerlegt hat.

---

## Z2 — RLS

**Aktion:** Owner darf alles auf seiner Brand. `anon` bekommt **keine** Policy —
der öffentliche Zugriff läuft nicht über die Tabelle, sondern über die Edge
Function mit Service-Role (Z4). Das ist der Unterschied zwischen „das Angebot
ist über seinen Link erreichbar" und „alle Angebote sind erreichbar, wenn man
die Abfrage richtig stellt".

**Erwartete Beobachtung:** Ein anonymer `select` auf `angebote` liefert null
Zeilen, kein Fehler.
**Wahrscheinlichster Fehler:** Eine großzügige `using (true)`-Policy rutscht mit
rein, weil sie aus einer anderen Tabelle kopiert wurde.
**Gegenzug:** Vor dem Weitergehen `select` als anon testen. Kommt eine Zeile
zurück, ist die Policy falsch.

---

## Z3 — Typen + API-Schicht

**Aktion:** `Angebot`, `AngebotStatus` in `types/db.ts`; `lib/angebotApi.ts` mit
`erstelleAngebot`, `ladeAngebote`, `angebotUrl`, `markiereVersendet`.
**Erwartete Beobachtung:** `npx tsc -b` grün.
**Wahrscheinlichster Fehler:** Der Paket-Katalog liegt hinter dem Runner
(`rechnungApi.ladePakete`), also hinter `127.0.0.1` — im Cockpit auf dem Handy
gibt es ihn nicht.
**Signal:** Leere Paketliste, Auswahl bleibt leer.
**Gegenzug:** Dieselbe Behandlung wie im `RechnungPanel` — Panel zeigt den
Hinweis „Pakete kommen vom Runner", statt leer dazustehen. **Nie direkt auf
`127.0.0.1`**, immer über `runnerBridge`.

---

## Z4 — Edge Function `angebot` (verify_jwt = false)

**Aktion:** Eine Function, zwei Aktionen, Muster von `lead-intake`:
- `GET ?token=…` → die nicht-geheimen Felder des Angebots
- `POST {token, name, bestaetigt}` → signieren

Beim Signieren in EINER Transaktion: `angebote` auf `signiert` (nur wenn vorher
`versendet` — sonst 409), `contacts.pipeline_stage = 'deal'`,
`leads.lead_status = 'kunde'`, ein `lead_ereignisse`-Eintrag `angebot_signiert`.

**IP und User-Agent** aus den Headern (`x-forwarded-for`, `user-agent`) — genau
dafür ist es eine Function und keine Datenbank-Funktion: `inet_client_addr()`
liefert hinter dem Pooler die falsche Adresse.

**Erwartete Beobachtung:** `curl` mit gültigem Token liefert das Angebot; mit
falschem Token `404` und **keinen Hinweis darauf, ob es das Angebot gibt**.
**Wahrscheinlichster Fehler:** Zweimal signiert (Doppelklick, Reload).
**Signal:** Zweiter Aufruf, Status steht schon auf `signiert`.
**Gegenzug:** Der Statuswechsel ist die Bedingung des Updates
(`where status = 'versendet'`). Greift er nicht, antwortet die Function
freundlich mit dem bestehenden Signaturdatum statt mit einem Fehler — der
Makler hat nichts falsch gemacht.
**Zweite Ordnung:** Der Lead steht nach dem Signieren auf `kunde` und fällt
damit aus dem Arbeitsvorrat. Fällt er in der Tagesliste auf, ist das richtig.
Fällt er aus dem Funnel-Ring heraus, ist das ebenfalls richtig — er landet in
der Phase „Kunde". **Prüfen, nicht annehmen.**
**Trigger:** Läuft das Signieren durch, aber der Lead bleibt aktiv → der
`leads`-Teil des Updates ist am Lead-Verweis gescheitert (Lead ohne `lead_id`).
Dann ist der Angebots-Datensatz die Wahrheit, und der Statuswechsel gehört
nachgezogen, statt das Signieren zurückzudrehen.

---

## Z5 — Öffentliche Seite `/angebot/:token`

**Aktion:** Route **vor** der `OwnerWorkspaceShell`, neben `/leads/:brandSlug`.
Eine Seite in Welt 2 (Navy × Gold, wie das Portal), die das Angebot liest,
Leistung und Preis nennt, und unten: Namensfeld, Bestätigungshäkchen, Knopf.

**Erwartete Beobachtung:** Der Link öffnet ohne Login, auch im privaten Fenster.
**Wahrscheinlichster Fehler:** Die Route landet versehentlich hinter dem
Auth-Gate und leitet auf `/login`.
**Signal:** Der Link im privaten Fenster zeigt die Anmeldung.
**Gegenzug:** Route-Position prüfen — sie muss auf derselben Ebene stehen wie
`/book/:brandSlug/:linkSlug`.
**Zweite Ordnung — Handy:** Der Makler öffnet das auf dem Telefon, aus LinkedIn
heraus, im In-App-Browser. Das heißt: echte Handy-Breite testen, Knopf über
44 px, keine Abhängigkeit von Hover, und die Seite muss ohne die Cockpit-Fonts
lesbar bleiben, falls sie nicht laden.

---

## Z6 — Das Panel am Lead

**Aktion:** `AngebotPanel` im Lead-Detail, direkt über dem `RechnungPanel`:
Paket wählen, Retainer wählen (oder keiner), Gültigkeit, Knopf „Angebot
anlegen" → zeigt den Link zum Kopieren. Bestehende Angebote mit Status darunter.

**Erwartete Beobachtung:** Nach dem Anlegen steht der Link da und lässt sich
kopieren; ein zweiter Klick legt kein zweites Angebot an, ohne dass man es will.
**Wahrscheinlichster Fehler:** Kevin legt zwei Angebote an und schickt das
falsche.
**Gegenzug:** Ein offenes Angebot (`entwurf`/`versendet`) je Lead wird oben
angezeigt; der Anlegen-Knopf fragt zurück, wenn schon eines offen ist —
dieselbe Haltung wie die Dublettensperre bei der Rechnung: zurückfragen, nicht
blocken.

---

## Z7 — Der Anschluss an die Rechnung

**Aktion:** Ist ein Angebot signiert, trägt das `RechnungPanel` dessen Paket und
Betrag als Vorbelegung — keine zweite Eingabe derselben Zahl.
**Erwartete Beobachtung:** Rechnungs-Panel öffnet mit vorausgewähltem Paket.
**Wahrscheinlichster Fehler:** Die Vorbelegung überschreibt eine Eingabe, die
Kevin gerade von Hand gemacht hat.
**Gegenzug:** Nur vorbelegen, wenn das Feld noch unberührt ist.
**Nicht in dieser Runde:** die wiederkehrende Retainer-Rechnung. Das ist der
nächste Bau und braucht einen Zeitgeber, keinen Knopf.

---

## Z8 — Prüfung

**Aktion:** `scripts/verify-angebot.ts` — reine Funktionen: Statusübergänge
(nur `versendet` → `signiert`, alles andere lehnt ab), Betrag friert ein,
Gültigkeit läuft ab.
**Erwartete Beobachtung:** grün.
**Abbruchbedingung:** Lässt sich ein Übergang nicht als reine Funktion prüfen,
weil die Logik nur in der Edge Function lebt — dann gehört sie in eine
gemeinsame Datei, nicht in ein Skript, das die Function nachbaut. **Zwei Wege
zu derselben Regel sind der Fehler, den dieses Projekt schon zweimal bezahlt hat.**

---

## Abbruchbedingungen (ganzer Plan)

1. `supabase db push` meldet eine Historien-Lücke → **stopp**, melden.
2. Ein anonymer `select` auf `angebote` liefert Zeilen → **stopp**, RLS ist offen.
3. Der öffentliche Link verlangt einen Login und die Route steht richtig →
   **stopp**, hier stimmt etwas Grundsätzliches nicht.
4. Das Signieren wechselt den Lead-Status nicht → **nicht improvisieren**,
   sondern den Angebots-Datensatz als Wahrheit nehmen und melden.

## RECON NEEDED

- `{{supabase_db_push}}` — ob die Migration in Kevins Datenbank durchläuft, ist
  von hier aus nicht prüfbar. Der Bau liefert die Datei; das Anwenden ist
  Kevins Zug, wie jeder Livegang.
- `{{brand_id}}` — die aktive Brand kommt im Cockpit aus `useActiveBrand`;
  außerhalb davon muss sie am Angebot hängen, sonst findet die Function sie nicht.

## Red-Team

**Angriff 1 — Token raten.** 32 Hex sind 128 Bit; nicht ratbar. *Hält.*
**Angriff 2 — fremdes Angebot über die Function lesen.** Die Function liefert
nur die Zeile zum Token und gibt bei Fehltreffern dieselbe Antwort wie bei
abgelaufenen. *Hält.*
**Angriff 3 — signieren, ohne der Makler zu sein.** Wer den Link hat, kann
unterschreiben. *Durchgekommen.* **Patch:** Das ist bei jedem Signatur-Link so,
auch bei DocuSeal ohne Zusatz-Authentifizierung — aber es gehört festgehalten:
Die Seite notiert IP und Zeitpunkt, und der Link geht ausschließlich an die
E-Mail-Adresse oder das Profil des Maklers, nie in eine Gruppe. Wenn Kevin mehr
braucht, ist der nächste Schritt ein Code per E-Mail, kein anderes Produkt.
**Angriff 4 — Preis in der Adresszeile manipulieren.** Der Betrag kommt aus der
Zeile, nie aus der Anfrage. *Hält.*

---

## Was die Realität korrigiert hat (Bau am 20.09.2026)

1. **Es gibt keine Verbindung von `contacts` zu `leads`.** Die Blaupause ging
   davon aus, dass am Lead-Detail beides bekannt ist. Ist es nicht: `/sales/:contactId`
   arbeitet auf `contacts`, und `leads.id` steht dort nirgends. Folge: `lead_id`
   am Angebot bleibt vorerst leer, der Statuswechsel beim Signieren trifft den
   Kontakt (`pipeline_stage = 'deal'`), nicht den LinkedIn-Lead. Der Weg dorthin
   ist offen und im Code als solcher markiert — er gehört in eine eigene Runde,
   weil er die Verheiratung der beiden Welten braucht, nicht ein weiteres Feld.
   **Nachgezogen am 24.09.2026:** Die Unterschrift sucht den Lead jetzt selbst
   (`supabase/functions/angebot/leadZuordnung.ts`) — zuerst über den
   Gesprächsverlauf, der Kontakt und Lead schon verbindet, bei Firmen auch über
   ihre Ansprechpartner, notfalls über den eindeutigen Namen. Gefundene Leads
   werden „Kunde" und bekommen das Ereignis `angebot_signiert`.
2. **Zwei Design-Tokens im Nachbar-Panel gab es nie.** `RechnungPanel` stylte
   seine Felder mit `--ck-surface-2` und `--ck-line`; beide stehen in keiner
   CSS-Datei, die Felder hatten dadurch weder Fläche noch Rahmen. Mitrepariert,
   weil das Angebots-Panel direkt daneben steht und zwei Bausätze sonst
   nebeneinander sichtbar gewesen wären.
3. **Die Seite musste in zwei Teile.** Erst als Darstellung (`AngebotAnsicht`)
   und Beschaffung (`AngebotPublicPage`) getrennt waren, ließ sich die Seite
   ohne echtes Token ansehen — jetzt unter `/dev/angebot-vorschau` mit allen
   fünf Zuständen.
4. **Der gesperrte Knopf war unlesbar.** Dunkle Schrift auf abgeblendetem Gold.
   Der gesperrte Zustand trägt jetzt Text in der Tertiärfarbe auf fast leerer
   Fläche.
5. **Drei Prüfskripte waren schon vor dieser Runde rot**
   (`verify-auftrag-agent`, `verify-breakpoint`, `verify-ladezustand`). Nicht
   von dieser Runde verursacht, nicht von ihr repariert.
