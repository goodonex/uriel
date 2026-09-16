# Ambient-Fläche — Uriels Schreibtisch

**Stand 10.09.2026 (zweite Fassung).** Übergabe für eine frische Session. Was
hier steht, muss man nicht im Code suchen; was hier nicht steht, steht als
Kommentar an der Regel.

## Was es ist

Ein Wallpaper-Dashboard: eine Menüleiste und vier Spalten über der
Quiraing-Szene, angezeigt von **Plash** (`sindresorhus.com/plash`) als
macOS-Desktop-Hintergrund.

- `/ambient` — die Fläche mit echten Daten (braucht Login)
- `/ambient?plash=1` — was Plash lädt (Wallpaper-Betrieb)
- `/dev/ambient-vorschau` — Optik ohne Login und ohne Datenbank prüfen

Links die **Menüleiste** (zugeklappt 52 px, öffnet beim Darüberfahren), dann
**Offen + Monatsziel** · **Bestand + Tageszähler** · **Monat** · **Tagesverlauf**.

Die Leiste trägt seit dem 11.09. nur noch, was man von hier aus wirklich
aufruft: Sales in Uriel; draußen Jophiel, LinkedIn, Sales Navigator und
Kalender; dazu zwei Werkzeuge — **Aktualisieren** (lädt die Fläche neu; ein Knopf,
der nur einen der fünf Datenwege nachzöge, wäre schlimmer als keiner) und
**Spalten gleich**.

## Dateien

| Datei | Rolle |
|---|---|
| `app/src/cockpit/pages/AmbientPage.tsx` | Hooks + Zusammenbau; `AmbientAnsicht` ist reine Darstellung |
| `app/src/cockpit/components/ambient/*.tsx` | Menüleiste, Lage, Bestand, Zähler, Monat, Verlauf |
| `app/src/cockpit/lib/ambient.ts` | Zeilen-Logik, Gruß, Datum, `AmbientTermin` (ohne React) |
| `app/src/cockpit/lib/ambientMenue.ts` | Menü-Einträge und das Öffnen als Fenster |
| `app/src/cockpit/lib/energie.ts` | Die Energiekurve (Stützpunkte, Pfad) |
| `app/src/cockpit/lib/useSpaltenBreiten.ts` | Ziehbare Trenner, merkt sich in `localStorage`; `zurueck` = Startaufteilung (Doppelklick auf einen Trenner), `gleich` = alle vier gleich breit (Knopf unten in der Menüleiste) |
| `app/src/cockpit/lib/icalParse.ts` | iCal inkl. `dauerMin` aus `DTEND`/`DURATION` |
| `app/src/hooks/useAmbientKennzahlen.ts` | Die drei Bestandszahlen aus den Runner-Spiegeln |
| `app/src/hooks/useAmbientOffen.ts` | Wartende Antworten und Follow-ups — über **dieselben** Posten-Funktionen wie der Sales-Flow |
| `app/src/cockpit/lib/tagesachse.ts` | Gestauchte Nacht, gedehnter Tag, Spurverteilung überlappender Termine |
| `app/src/styles/ambient.css` | Alles Visuelle |
| `app/public/ambient/horizont-desktop-exakt.jpg` | Die Szene |
| Route + Dev-Route | in `app/src/App.tsx` |

## Elf Regeln, die je einen Fehlschlag gekostet haben

1. **Offene Punkte kommen aus `useWidersprueche`, nicht aus `foundation_tasks`.**
   Die Aufgaben-Tabelle hat null offene Zeilen; Kevins offene Punkte entstehen als
   Widerspruch zwischen zwei Datenständen (`runner/widersprueche.mjs`). Die erste
   Fassung meldete „Nichts offen", während vier Befunde offen standen.
2. **Tagesziele stehen in `ui_settings` unter `TAGES_FLOW_ZIELE`**, nicht in
   `ZAEHL_FELDER`. Dort steht nur der Standardwert. Kevin hat `{"anfragen": 40}`
   gesetzt — ohne die Überschreibung stand „40/30" statt „40/40".
3. **Jede Spalte muss etwas können.** Eine Fassung war reine Anzeige; ein
   Wallpaper, das nur anzeigt, ist ein Poster.
4. **Klick-Regel:** Was *hier* passiert (abhaken, zählen, Spalten ziehen), bleibt
   in der Fläche. Was *woanders* passiert, ist ein **echter `<a target="_blank">`**
   — nie `window.open` allein, nie ein normaler Link. Ein Klick, der im selben
   Fenster navigiert, ersetzt das Wallpaper durch das Cockpit.
5. **Die Szene muss dieselbe Datei sein wie das gesetzte macOS-Wallpaper**
   (`uriel-wallpaper-macbook-3456x2234.png`, Seitenverhältnis 1,547). Andere
   Zuschnitte beschneiden bei `cover` anders und sitzen versetzt. Wallpaper
   gewechselt → diese Datei mitwechseln.
6. **`--amb-versatz`** wird im Wallpaper-Betrieb gemessen (Bildschirmhöhe minus
   Fensterhöhe). Plash legt seine Fläche unter der Menüleiste an; ohne den
   Versatz beginnt das Bild darunter ein zweites Mal — sichtbarer Bruch.
7. **Der Scrim steht oben auf null.** Jede Abdunklung dort macht den Streifen
   unter der Menüleiste dunkler als den echten Schreibtisch und erzeugt genau
   die Kante, die sie beheben soll. Kontrast für Kopf und Labels kommt aus
   `text-shadow`.
8. **Ein `+` gehört nur an Zeilen, die man wirklich tippt** (10.09., zweite
   Fassung). Erstnachrichten, Antworten und Follow-ups werden herauskopiert,
   nicht hochgezählt — sie tragen einen Pfeil, der die Liste in einem eigenen
   Fenster öffnet (`ARBEITSORT` in `AmbientPage.tsx`). Ein Zähler, den niemand
   drückt, ist eine Zahl, die lügt.
9. **Alles auf der Achse rechnet in Prozent, nichts in Pixeln.** Die Spalten
   sind ziehbar und die Fläche läuft auf verschiedenen Bildschirmen; eine
   Zeitachse mit gerechneten Pixelhöhen wäre nach jedem Zug neu falsch.
10. **Die Spalten tragen `overflow: hidden` — was darüber hinausragt, ist weg,
    auch für die Maus** (11.09.). Die Ziehgriffe saßen mit negativem `right`
    außerhalb ihrer Spalte und waren damit vollständig weggeschnitten: die
    Trenner ließen sich vom ersten Tag an nicht bewegen, ohne dass etwas kaputt
    aussah. Sie liegen jetzt als eigene Ebene im Raster, positioniert auf dem
    aufsummierten Spaltenanteil. Wer etwas absichtlich überstehen lässt (die
    Tageszahl), nimmt der Spalte das Clipping gezielt — `.amb-spalte-monat`.
11. **Ein `<svg>` mit viewBox braucht eine echte Höhe, nicht `top: 0; bottom: 0`**
    (11.09.). Der Browser rechnet die Höhe sonst aus dem Seitenverhältnis der
    viewBox: bei 60 px Breite und `0 0 100 1440` sind das 864 px, unabhängig
    davon, wie hoch die Achse ist. Die Energiekurve lief dadurch über den
    unteren Rand hinaus und stand gegenüber dem Stundenraster verschoben — an
    der 24-Uhr-Linie zeigte sie den Wert von etwa 21 Uhr. `height: 100%` zwingt
    sie auf dieselbe Skala wie Raster und Terminblöcke. Wer die Kurvenbreite
    ändert, ändert ohne diese Zeile stillschweigend die Zeitskala.

## Das Monatsziel (Spalte 1, unten)

Ist-Umsatz, Ziel und die Soll-Marke der Monatskurve — gebaut aus denselben
Bausteinen wie Cockpit und Assistent (`sumField(monthRows, 'umsatz')`,
`monthTargetFor`, `currentSoll`), damit die Fläche nie eine andere Zahl nennt
als die Seite, auf der Kevin sie korrigiert. Liegt der Ist-Wert unter dem Soll,
wird der Balken gedämpftes Gold — **nie Rot**.

Der Ort ist Absicht: am Fuß der ersten Spalte, gegenüber der Tageszahl am Fuß
der dritten. Zwei Anker unten statt einem, und die Befundliste darüber darf
kürzer werden, ohne dass die Spalte leer wirkt.

## Jophiel ist kein Uriel-Bereich

Der Menüeintrag zeigte auf `/projekte` — ein Klick auf „Jophiel" landete damit
in Uriels Kundenprojekten. Jophiel ist ein eigenes Projekt unter
`~/Kevin OS/02 Projekte/jophiel` mit eigenem Server; die Ports stehen in dessen
`config.json` (4100 API, **4101 UI**, 4102 Tunnel). Der Eintrag steht deshalb
bei den Orten draußen. Läuft Jophiel nicht, geht der Tab ins Leere — ehrlicher
als ein Link, der verlässlich am falschen Ort ankommt.

## Die Achse und die Energiekurve

**Zwei Ansichten, ein Umschalter** (`tagesachse.ts`). „24 h" zeigt den ganzen
Tag von 00 bis 24 Uhr, **vollkommen gleichmäßig** — jede Stunde gleich hoch,
auch die leeren der Nacht. „Detail" zeigt 06 bis 22 Uhr auf der ganzen Höhe:
rund die Hälfte mehr Platz je Stunde (6,25 statt 4,17 % pro Stunde). Das
Detail-Fenster dehnt sich auf Termine außerhalb — eine Ansicht, in der Termine
verschwinden, wäre keine. Die Wahl liegt in `ui_settings` (`ambientTagDetail`),
weil sie eine Lesegewohnheit ist und den nächsten Morgen überleben soll — anders
als der Tagesversatz.

**Eine verworfene Zwischenstufe, damit sie niemand wieder einbaut.** Der ganze
Tag hatte am 11.09. für ein paar Stunden eine *gestauchte Nacht*: 00–06 Uhr auf
7 % der Höhe, der Rest gedehnt. Das löste dasselbe Platzproblem, sah aber falsch
aus — sechs Stunden auf einem Daumenbreit, direkt daneben zwei Stunden auf dem
Dreifachen. Kevins Urteil: *„verändert diese vierundzwanzig Stunden nicht, du
sollst nur die Detailansicht dazupacken."* Eine Ansicht, die heimlich zwei
Maßstäbe mischt, ist schlechter als zwei Ansichten, die je einen ehrlich zeigen.

**Alles in dieser Spalte muss durch `achsenAnteil`** — Raster, Blöcke,
Jetzt-Marke *und* die Energiekurve. Rechnet eines davon mit einer eigenen
Formel, sitzt es gegenüber allen anderen verschoben. Und was sich am *Rand* der
Achse ausrichtet (Kurve, Hochs, Jetzt-Marke), richtet sich an der Achse aus,
nicht an einer zweiten Zahl daneben: in der Zwischenstufe hingen sie am Fenster
statt an der Achse, und die Energielinie brach dadurch bei 23 Uhr ab.

**Überlappende Termine liegen nebeneinander** (`verteileTermine`). Zwei Termine,
die sich zeitlich schneiden, teilen sich die Breite; wer sich mit niemandem
schneidet, behält die volle. Vorher verdeckte der spätere den Titel des früheren.

Scrollen und Aufklappen-beim-Darüberfahren waren die Alternativen und sind
verworfen: Auf einem Wallpaper ist der Blick die einzige Bedienung — was man
erst holen muss, ist nicht da; und Bewegung macht die Fläche unruhig.


Der Tagesverlauf ist seit der zweiten Fassung eine **maßstäbliche
24-Stunden-Achse**: jeder Termin sitzt an seiner Uhrzeit und ist so hoch, wie er
dauert — zwei Stunden doppelt so hoch wie eine. Die Länge kommt aus `DTEND` oder
`DURATION` der iCal (`dauerMin`); fehlt sie, wird eine Standardhöhe gezeichnet
und **nichts geschätzt**. Was über Mitternacht läuft, wird auf den Rest des
Starttags gekappt.

Über der Achse steht, **welcher Tag** gezeigt wird: gestern, heute, morgen. Der
Versatz gilt nur für diese Sitzung und wird nicht gespeichert — ein Wallpaper,
das am nächsten Morgen noch auf „gestern" steht, wäre eine Falle. Die
Jetzt-Marke erscheint nur am heutigen Tag; an einem anderen gäbe es keinen Ort,
an dem sie wahr wäre.

Links läuft die **Energiekurve** durch alle 24 Stunden. Sie ist der klassischen
Arbeits-/Leistungskurve nachgebildet (Kevins Vorlage): Anstieg nach dem
Aufstehen, **Hoch I** am späten Vormittag als höchster Punkt, ein Tal am frühen
Nachmittag, **Hoch II** am frühen Abend etwas niedriger, danach der lange Abfall
bis zum Minimum in den frühen Morgenstunden. Das Nachmittagstal fällt bewusst
nur auf Mittelmaß, nicht Richtung Nacht — der Nachmittag ist ein schwächerer
Teil des Tages, keine zweite Nacht.

**Die Stützpunkte hängen am Aufwachen, nicht an der Uhrzeit.** Kevin stellt die
Aufwachstunde (7, 8 oder 9) im Kopf der Spalte selbst ein; sie liegt in
`ui_settings` unter `ambientAufwachStunde`, weil das Aufstehen am Menschen hängt
und nicht am Bildschirm. Liefert eines Tages ein Tracker die echte Aufwachzeit,
wird sie an derselben Stelle eingesetzt und die ganze Kurve wandert mit.

## Die Zahlen am Tageszähler

Unter jeder Abarbeit-Zeile steht, wie viele warten — ohne sie ist eine „0"
zweideutig (nichts zu tun oder noch nicht angefangen?). Drei Quellen, eine
Bedeutung:

- **Erstnachrichten** aus dem Runner-Spiegel (`versandfertig`), billig.
- **Antworten und Follow-ups** aus `antwortPosten`/`followupPosten`, also
  buchstäblich denselben Funktionen wie der Sales-Flow. Eine eigene
  `count`-Abfrage wäre billiger gewesen und hätte eine **andere** Zahl ergeben:
  Off-ICP-Kontakte, laufende Kunden, zugesagte Looms und alles vor dem
  Akquise-Stichtag fallen im Flow heraus, und diese Regeln stehen im Code, nicht
  in der Datenbank. Zwei Wahrheiten für eine Zahl waren der
  78-Erstnachrichten-Fehler.

Der Preis: `useLinkedinThreads` lädt alle Spalten. Das passiert **einmal je
Aufbau** der Seite, nicht im Takt — wer frische Zahlen will, drückt
Aktualisieren. Bewusst **nicht** über `useTagesFlow`: der schreibt die
Tagesportion fest (Migration 0074), und ein Wallpaper, das um 00:01 lädt, würde
das Tages-Soll einfrieren, bevor der nächtliche Sync gelaufen ist. Die Fläche
liest, sie schreibt nicht.

Die Namen tragen auf der Fläche kein „· LinkedIn" mehr: hier ist alles
LinkedIn, und der Zusatz kostete die Breite, die die Zahl daneben braucht. Im
Cockpit steht Instagram daneben, dort bleibt er.

## Wenn zwei Zahlen sich zu widersprechen scheinen

Im Bestand stand „1.061 Einladungen", zwei Zentimeter daneben im Befund „brach
bei 30 von 1094 ab". Beide sind richtig: `gesamt` schreibt nur ein
**vollständiger** Lauf (`netzwerkUpsert.schreibeMeta`), die 1.094 sah der
abgebrochene Lauf auf der Seite. Nebeneinander sieht das nach Fehler aus, und
eine Fläche, deren Zahlen sich zu widersprechen scheinen, hat ihren Zweck
verfehlt. Die Bestandszahl sagt jetzt dazu „· Sync offen", solange ein
`letzterAbbruch` für diese Seite steht.

Der Wächter fasst außerdem seit dem 11.09. **alle abgebrochenen Seiten zu einer
Zeile** zusammen (`runner/widersprueche.mjs`): gleiche Ursache, gleicher
Handgriff, ein Klick behebt beide. Zwei Zeilen für einen Handgriff sind keine
doppelte Information, sondern halbe Aufmerksamkeit. Geprüft in
`scripts/verify-widersprueche.ts`.

## Weitere Fallstricke

- **Der Handgriff eines Befunds wird gekürzt** (`kurzerHandgriff`). Der Wächter
  schreibt vollständige Anweisungen mit Erläuterung in Klammern; im Cockpit ist
  das richtig, auf einem Wallpaper wird daraus eine Textwand, die niemand liest.
  Geschnitten wird am ersten Semikolon oder an der ersten Klammer — dort, wo der
  Wächter selbst vom Auftrag zur Erklärung wechselt.
- **Design-Tokens sind eingefroren** (`docs/phase2/DESIGN-TOKENS.md`): Salbei als
  einziger Akzent, gedämpftes Gold für Dringendes, **nie Rot**. Abweichen heißt
  stoppen und fragen.
- **Terminblöcke tragen dunklen Grund, keinen hellen Akzentschleier.** Rechts
  steht im Foto der Sonnendurchbruch; ein aufgehellter Block verschwindet dort.
- **Die offene Menüleiste braucht einen Grund, der wirklich deckt.** Erst stand
  gar keiner da (zwei Texte übereinander), dann ein weicher Verlauf über die
  volle Spaltenhöhe — der schnitt die Zeilen der Spalte „Offen" mitten im Wort
  an und sah über dem Foto nach Darstellungsfehler aus. Es ist jetzt ein
  deckendes Panel mit Rundung und Schatten, genau so hoch wie seine Einträge.
- **Die Riesenziffer sitzt am Fuß der Monatsspalte**, in der Größe der ersten
  Fassung. Ein Deckel an der Spaltenbreite (`cqw`) hat sie sichtbar kleiner
  gemacht als vorher; stattdessen clippt diese eine Spalte nicht, und die Ziffer
  ragt nach rechts hinaus — dorthin, wo die Verlaufsspalte über ihr liegt.
- **Lint:** `react-refresh/only-export-components` läuft als *error* — eine Datei
  mit Komponenten darf nichts anderes exportieren. Deshalb liegen Logik und
  Daten in `lib/`.
- **Lint:** `react-hooks/set-state-in-effect` ist ebenfalls *error*. Erster Lauf
  eines Ladevorgangs über `setTimeout(…, 0)`, nicht im Effekt-Rumpf.
- Die Fläche läuft **außerhalb** der Cockpit-Shell und bringt den
  `ActiveBrandProvider` selbst mit.

## Kalender

Der Kalender kommt bereits aus **Google** — `CALENDAR_ICAL_URL` in `runner/.env`
enthält vier geheime iCal-Adressen (Google Kalender → Einstellungen → den
einzelnen Kalender anklicken → „Kalender integrieren" → „Geheime Adresse im
iCal-Format"). Notion Calendar zeigt dieselben Google-Kalender an und hat keinen
eigenen Feed; wer in Notion verschiebt, verschiebt in Google, und die Fläche
zieht beim nächsten Lauf nach. Ein neuer Kalender ist eine Zeile mehr in dieser
Variable, kein Code.

## Prüfen

```bash
npm run cockpit                      # Dev-Server (Port 5173)
cd app && npx tsc -b && npx eslint src/cockpit/pages/AmbientPage.tsx src/cockpit/components/ambient/
```

Dann `http://localhost:5173/dev/ambient-vorschau` öffnen. In Plash wird die
Fläche erst im **Browsing Mode** bedienbar — das ist ein Zustand, den Kevin
einmal einschaltet, kein Moment.

## Offen

- **Belichtungskante an der Menüleiste.** Der Bildversatz ist behoben; ob ein
  Helligkeitsunterschied bleibt, ist ungeprüft. Falls ja: Kevin misst Leiste und
  Bereich darunter mit dem Digitalen Farbmesser, dann wird die Differenz
  gerechnet — **nicht schätzen**, drei Schätzversuche sind bereits gescheitert.
- **Echte Aufwachzeit statt der Auswahl 7/8/9.** Ein Health-Tracker oder
  Apple Health am Handy wäre die Quelle; die Kurve ist dafür schon vorbereitet —
  es wird eine Zahl eingesetzt, sonst nichts. Das ist eine neue Integration,
  kein Layout-Handgriff.
- **E-Mail-Feld.** Kevin hat danach gefragt. Uriel hat den Kunden-Posteingang
  (`useKundenPosteingang`), aber keine Anbindung an sein Gmail.
- **Dauerbetrieb.** Die Fläche lebt am Vite-Dev-Server. Ohne ihn ist das
  Wallpaper leer. Für echten Dauerbetrieb: Build + statisch ausliefern, beim
  Anmelden automatisch starten.
