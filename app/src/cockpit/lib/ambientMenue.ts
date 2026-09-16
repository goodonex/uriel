/**
 * Die Menüleiste der Ambient-Fläche (10.09.2026) — was drinsteht und wie es
 * aufgeht.
 *
 * Sie liegt hier als Daten und nicht in der Komponente, weil
 * `react-refresh/only-export-components` im Repo als *error* läuft: eine Datei
 * mit Komponenten darf nichts anderes exportieren. Nebeneffekt: Kevin ergänzt
 * einen Ort, indem er eine Zeile in einer Liste ergänzt.
 *
 * **Zwei Arten von Zielen, und der Unterschied ist der ganze Punkt.**
 *
 * - `fenster` öffnet ein eigenes, kleines Browserfenster. Das ist der Weg in
 *   Uriel hinein: Kevin muss an die Erstnachrichten und Antworten *heran* —
 *   lesen, kopieren, abhaken —, und dafür reicht keine Kachel auf einem
 *   Wallpaper. Ein Fenster steht neben dem Schreibtisch, statt ihn zu ersetzen.
 * - `tab` öffnet einen normalen Tab. Für alles Fremde (LinkedIn, Kalender):
 *   dort wird gearbeitet, nicht nachgesehen.
 *
 * Was NICHT geht, ist ein normaler Link auf dasselbe Fenster — der navigiert
 * die Plash-Fläche weg, und dann steht das Cockpit auf dem Schreibtisch statt
 * des Wallpapers. Das ist die Klick-Regel der Fläche, und sie gilt hier auch.
 */

export interface MenueZiel {
  id: string
  /** Ein bis zwei Zeichen — ein Wortbild, kein Logo. Marken-Logos in fremder
   *  Farbe würden die Leiste zum Icon-Dock machen; die Fläche trägt genau eine
   *  Akzentfarbe. */
  kuerzel: string
  label: string
  /** Pfad im Cockpit (`intern`) oder vollständige URL (`extern`). */
  url: string
  intern: boolean
  /** `fenster` = eigenes Browserfenster, `tab` = neuer Tab. */
  art: 'fenster' | 'tab'
}

/**
 * Uriels Bereiche — bewusst nur zwei (ausgedünnt am 11.09.2026).
 *
 * Vorher standen hier auch Erstnachrichten, Antworten, Follow-ups und das
 * Cockpit. Die drei Arbeitslisten haben ihren Weg längst am Tageszähler, wo
 * ihr Stand steht; sie ein zweites Mal in die Leiste zu schreiben, machte aus
 * einer Abkürzung ein Inhaltsverzeichnis. Das Cockpit ist die Startseite —
 * dorthin führt jeder andere Link ohnehin.
 *
 * Jophiel steht bewusst NICHT hier, sondern bei den Orten draußen: es ist ein
 * eigenes Projekt mit eigenem Server, keine Uriel-Seite. Uriel zeigt von
 * Jophiel nur die gebauten Seiten (`GebauteSeiten.tsx` unter `/sales`).
 */
export const MENUE_URIEL: readonly MenueZiel[] = [
  { id: 'sales', kuerzel: 'S', label: 'Sales', url: '/sales', intern: true, art: 'fenster' },
]

/**
 * **Jophiel ist keine Uriel-Seite** (Korrektur vom 11.09.2026).
 *
 * Der Eintrag zeigte auf `/projekte`, also in Uriels Kundenprojekte — Kevin
 * klickte „Jophiel" und landete in Uriel. Jophiel ist ein eigenes Projekt unter
 * `~/Kevin OS/02 Projekte/jophiel` mit eigener Oberfläche; die Ports stehen in
 * dessen `config.json` (4100 API, 4101 UI, 4102 Tunnel). Hier zählt 4101.
 *
 * Läuft Jophiels Server nicht, geht der Tab ins Leere — das ist ehrlicher als
 * ein Link, der verlässlich am falschen Ort ankommt.
 */
const JOPHIEL_UI = 'http://localhost:4101/'

/**
 * Die Orte außerhalb. LinkedIn und Sales Navigator sind getrennt, weil sie es
 * im Alltag sind — die Anfragen laufen über den Navigator, das Postfach über
 * LinkedIn selbst.
 *
 * **Ein Kalender, nicht zwei** (11.09.). Notion Calendar zeigt dieselben
 * Google-Kalender, die auch die Fläche liest; zwei Einträge, die am Ende
 * dieselben Termine öffnen, sind keine Auswahl, sondern eine Frage, die man
 * jedes Mal neu beantworten muss. Er heißt deshalb schlicht „Kalender".
 */
export const MENUE_DRAUSSEN: readonly MenueZiel[] = [
  { id: 'jophiel', kuerzel: 'J', label: 'Jophiel', url: JOPHIEL_UI, intern: false, art: 'tab' },
  { id: 'li', kuerzel: 'in', label: 'LinkedIn', url: 'https://www.linkedin.com/feed/', intern: false, art: 'tab' },
  { id: 'sn', kuerzel: 'SN', label: 'Sales Navigator', url: 'https://www.linkedin.com/sales/home', intern: false, art: 'tab' },
  { id: 'kal', kuerzel: 'K', label: 'Kalender', url: 'https://calendar.notion.so/', intern: false, art: 'tab' },
]

/** Maße des Arbeitsfensters — groß genug für eine Liste, klein genug daneben. */
const FENSTER_BREITE = 1180
const FENSTER_HOEHE = 900

/** Vollständige Adresse eines Ziels. */
export function zielUrl(ziel: MenueZiel, basis: string): string {
  return ziel.intern ? `${basis}${ziel.url}` : ziel.url
}

/**
 * Öffnet ein Ziel als eigenes Fenster — und sagt, ob es geklappt hat.
 *
 * **Warum das ein Rückgabewert ist und kein Nebeneffekt.** Jedes Element, das
 * hier hineinführt, ist ein echter `<a target="_blank">`. Gelingt das Fenster,
 * wird der Klick abgebrochen und das Fenster steht; gelingt es nicht, macht
 * der Link seine normale Arbeit und es wird ein Tab. So gibt es keinen Zustand,
 * in dem ein Klick auf der Fläche gar nichts tut — und vor allem keinen, in dem
 * die Fläche selbst wegnavigiert. Ein weggeklicktes Wallpaper ist der teuerste
 * Fehler, den diese Seite machen kann.
 *
 * Im **Wallpaper-Betrieb wird bewusst kein Fenster versucht.** Plash ist kein
 * Browser: was dort aus der Seite heraus geöffnet wird, landet im
 * Standardbrowser als Tab, und ein halb ausgeführter Fensteraufruf wäre nur ein
 * Weg, das unvorhersehbar zu machen. Dort gilt derselbe Weg wie für jeden
 * anderen Link der Fläche — `target="_blank"`, erprobt seit der ersten Fassung.
 *
 * Jedes Fenster bekommt einen **eigenen Namen** (`uriel-<id>`): gleicher Name
 * hieße, der zweite Klick lädt das erste Fenster um — Kevin hätte Antworten
 * *statt* Erstnachrichten offen statt daneben. Zweiter Klick auf dasselbe Ziel
 * holt genau dieses Fenster wieder nach vorne, statt ein drittes zu stapeln.
 */
export function oeffneAlsFenster(id: string, url: string, alsWallpaper: boolean): boolean {
  if (alsWallpaper) return false
  const links = Math.max(0, Math.round((window.screen.width - FENSTER_BREITE) / 2))
  const oben = Math.max(0, Math.round((window.screen.height - FENSTER_HOEHE) / 2))
  const fenster = window.open(
    url,
    `uriel-${id}`,
    `popup=yes,width=${FENSTER_BREITE},height=${FENSTER_HOEHE},left=${links},top=${oben}`,
  )
  if (!fenster) return false
  fenster.focus()
  return true
}
