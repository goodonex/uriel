/**
 * Das Lesen der Netzwerk-Seiten — reine Funktionen (12.08.2026).
 *
 * **Warum DOM und nicht Voyager.** Der Postfach-Sync replayt eine GraphQL-Query,
 * weil die Messaging-Seite eine hat. Die beiden Netzwerk-Seiten haben keine:
 * am 12.08. gemessen — beim Nachladen (Scrollen im `main`-Container kommen
 * zuverlässig 10 Einträge dazu) feuert **kein einziger** Netzwerk-Request.
 * LinkedIn rendert die Liste aus einem Store, den die Seite schon hält. Es gibt
 * also nichts zu replayen; der DOM IST die Schnittstelle.
 *
 * Diese Datei enthält alles, was sich ohne Browser prüfen lässt —
 * `npx tsx scripts/verify-netzwerk-parse.ts`. Die Browser-Mechanik liegt
 * daneben in `netzwerk.mjs`.
 */

/**
 * Der öffentliche Profil-Identifier aus einer LinkedIn-URL.
 *
 * Er ist der Schlüssel dieser Tabelle: Namen sind mehrdeutig („Michael Müller"),
 * URNs unterscheiden sich je Oberfläche, aber `/in/<key>` ist über Postfach,
 * Einladungsliste und Kontaktliste hinweg derselbe.
 */
export function profilKeyAus(url) {
  const s = String(url ?? '')
  const m = s.match(/\/in\/([^/?#]+)/i)
  if (!m) return null
  const key = decodeURIComponent(m[1]).trim().toLowerCase()
  return key === '' ? null : key
}

const MONATE = {
  januar: 0, februar: 1, märz: 2, maerz: 2, april: 3, mai: 4, juni: 5,
  juli: 6, august: 7, september: 8, oktober: 9, november: 10, dezember: 11,
}

/**
 * „Am 10. August 2026 vernetzt" → Date. Die Kontaktliste liefert echte Daten,
 * kein „vor 3 Wochen" — deshalb ist `angenommen_at` belastbar.
 */
export function vernetztDatum(text) {
  const m = String(text ?? '').match(/(\d{1,2})\.\s*([A-Za-zÄÖÜäöüß]+)\s*(\d{4})/)
  if (!m) return null
  const monat = MONATE[m[2].toLowerCase()]
  if (monat === undefined) return null
  const d = new Date(Number(m[3]), monat, Number(m[1]), 12, 0, 0)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * „Vor 53 Minuten gesendet" / „Vor 3 Wochen gesendet" → Date.
 *
 * Die Einladungsliste kennt nur relative Angaben. Das ist ungenau und wird
 * ehrlich so behandelt: bei „vor 2 Monaten" ist der Tag geschätzt, das Alter in
 * Wochen stimmt. Für die Reihenfolge der InMail-Welle („wer wartet am
 * längsten") reicht das vollkommen.
 */
export function gesendetDatum(text, jetzt = new Date()) {
  const s = String(text ?? '').toLowerCase()
  const m = s.match(/(\d+)\s*(minute|minuten|stunde|stunden|tag|tagen|woche|wochen|monat|monaten|jahr|jahren)/)
  if (!m) return null
  const n = Number(m[1])
  const MS = { minute: 60_000, stunde: 3_600_000, tag: 86_400_000, woche: 604_800_000, monat: 2_592_000_000, jahr: 31_536_000_000 }
  const einheit = m[2].replace(/n$/, '').replace(/e$/, '')
  const faktor =
    MS[einheit] ?? MS[m[2].replace(/(n|en)$/, '')] ?? MS[m[2].slice(0, 6)] ?? null
  if (!faktor) return null
  return new Date(jetzt.getTime() - n * faktor)
}

/** Zeilen, die keine Person beschreiben, sondern die Seite selbst. */
const RAUSCHEN =
  /^(einladungen verwalten|eingegangen|gesendet|personen \(|sortieren nach|neu hinzugefügt|mit filtern suchen|\d+ kontakte|zurückziehen|vernetzen|nachricht|folgen|mehr)/i

/**
 * Der Name aus dem alt-Text des Profilbilds — und die Genitiv-Falle darin.
 *
 * LinkedIn schreibt „Josef Seibolds Profilbild". Das End-s wegzuschneiden ist
 * meistens richtig — bei „Karen Dierks Profilbild" aber falsch, denn da gehört
 * es zum Namen. Aus dem alt-Text allein ist das nicht zu entscheiden.
 *
 * Der Profil-Schlüssel entscheidet es: `karen-dierks-32195` enthält „dierks",
 * `josef-seibold-728710112` enthält „seibold" ohne s. Steht das s im
 * Schlüssel, bleibt es im Namen.
 */
export function nameAusProfilbild(altText, profilKey) {
  const ohneSuffix = String(altText ?? '').replace(/\s*Profilbild$/i, '').trim()
  if (!ohneSuffix) return ''
  if (!/s$/i.test(ohneSuffix)) return ohneSuffix

  const mitS = ohneSuffix
  const ohneS = ohneSuffix.slice(0, -1)
  const schluessel = String(profilKey ?? '').toLowerCase()
  const letztesWort = mitS.split(/\s+/).pop()?.toLowerCase() ?? ''
  // Taucht das Wort MIT s im Schlüssel auf, ist es Teil des Namens.
  if (letztesWort && schluessel.includes(letztesWort)) return mitS
  return ohneS
}

/**
 * Aus dem Text einer Personen-Karte wird ein Eintrag.
 *
 * Die Karte liefert ihre Zeilen in fester Folge: Name, Headline, Zeitangabe
 * (danach Knöpfe). Headline kann `--` sein, wenn die Person keine hat — dann
 * bleibt sie leer statt „--" zu speichern.
 *
 * `nameAusBild` ist der Rückfall: das Profilbild trägt „Vorname Nachnames
 * Profilbild" im alt-Text. Er greift, wenn die erste Zeile Rauschen war.
 */
export function karteZuEintrag({ zeilen, href, nameAusBild }, jetzt = new Date()) {
  const profilKey = profilKeyAus(href)
  if (!profilKey) return null

  const echte = (zeilen ?? []).map((z) => String(z).trim()).filter((z) => z && !RAUSCHEN.test(z))

  const IST_ZEIT = /gesendet|vernetzt/i
  // Name und Headline dürfen NIE aus der Zeitzeile kommen. Ohne diese Trennung
  // hiess ein Eintrag, dessen Namenszeile fehlte, prompt „Vor 3 Wochen
  // gesendet" — am 12.08. genau so gemessen.
  const inhalt = echte.filter((z) => !IST_ZEIT.test(z) && !/^--$/.test(z))

  /**
   * LinkedIn hängt an manche Namenszeilen einen unsichtbaren
   * Barrierefreiheits-Text — im DOM steht dann wörtlich
   * „Noah Weber Aktueller Entitätsverlauf" in EINEM Element. Fünf solcher
   * Namen lagen am 01.09. im Bestand, und weil der Namensabgleich sie nicht
   * mit ihren Threads verheiraten konnte, galten fünf längst Angeschriebene
   * als „wartet auf Erstnachricht" (Audit K6). Der Suffix wird deshalb an der
   * Quelle entfernt, nicht in jedem Abnehmer einzeln.
   */
  const roherName = inhalt[0] || nameAusProfilbild(nameAusBild, profilKey)
  const name = roherName ? roherName.replace(/\s*Aktueller Entitätsverlauf\s*$/i, '').trim() : roherName
  if (!name) return null

  const headline = inhalt[1] ?? ''

  const zeitZeile = echte.find((z) => IST_ZEIT.test(z)) ?? ''
  const vernetzt = vernetztDatum(zeitZeile)
  const gesendet = vernetzt ? null : gesendetDatum(zeitZeile, jetzt)

  return {
    profilKey,
    name,
    headline,
    profileUrl: `https://www.linkedin.com/in/${profilKey}/`,
    eingeladenAt: gesendet ? gesendet.toISOString() : null,
    angenommenAt: vernetzt ? vernetzt.toISOString() : null,
  }
}

/**
 * Eine Karte der EINGEGANGENEN Einladungen (06.10.2026).
 *
 * Am 06.10. an Kevins echter Seite gemessen, drei Karten, zwei Sorten:
 *
 *   „Deniz Bilgic möchte Kontakt mit Ihnen aufnehmen" · Headline ·
 *   „Özgür O. und 71 weitere gemeinsame Kontakte" · Ignorieren · Annehmen
 *
 *   „Giovanni Barone" · „hat Sie eingeladen, Lebensraum Schweiz AG zu folgen"
 *
 * Die zweite Sorte ist keine Vernetzungsanfrage, sondern eine Einladung, einer
 * Firmenseite zu folgen — sie verlinkt trotzdem ein Profil (`/in/…`). Ohne
 * Filter stünde Giovanni Barone mit „Lebensraum Schweiz AG" als Headline in
 * Kevins Anfragen-Liste. Sie kommt als `{ folgen: true }` zurück: Der Leser
 * zählt sie für die Vollständigkeit mit („Alle (3)" zählt sie auch), legt sie
 * aber nicht ab.
 *
 * **Kein Datum.** Die Eingangsliste zeigt keins; steht doch eine Zeitzeile da
 * („Vor 2 Tagen"), wird sie gelesen, sonst bleibt `eingegangenAt` null und die
 * Datenbank nimmt den ersten Sichttag.
 *
 * **Die Notiz** ist alles, was nach Name, Headline und der Zeile mit den
 * gemeinsamen Kontakten übrig bleibt. Gekürzte Notizen stehen per CSS
 * abgeschnitten, aber vollständig im DOM — geklickt wird nie, auch nicht auf
 * „mehr".
 */
const ANFRAGE_SATZ = /\s*möchte (?:mit Ihnen in )?Kontakt(?: mit Ihnen)? (?:aufnehmen|treten)\.?\s*$/i
const FOLGEN_SATZ = /hat Sie eingeladen,.*(folgen|abonnieren)|eingeladen.*zu folgen|invited you to follow/i
const GEMEINSAME = /gemeinsame[rn]? Kontakt|gemeinsamer Kontakt|mutual connection/i
const KNOPF = /^(ignorieren|annehmen|antworten|mehr anzeigen|weniger anzeigen|…\s*mehr|mehr|nachricht senden|alle anzeigen)$/i
const ZEIT_EINGANG = /^(vor\s+\d+|heute|gestern|\d+\s*(min|std|tag|wo|mon))/i
/**
 * Rauschen der Eingangsseite — bewusst enger als `RAUSCHEN`: Dort fliegt jede
 * Zeile raus, die mit „mehr", „folgen" oder „Nachricht" ANFÄNGT. Bei einer
 * Notiz („Mehr Eigentümer wären schön …") wäre das der halbe Text.
 */
const RAUSCHEN_ANFRAGE = /^(einladungen verwalten|eingegangen|gesendet|alle \(\d|gemeinsame kontakte \(\d|personen \(\d|sortieren nach|mit filtern suchen)/i

export function anfrageKarteZuEintrag({ zeilen, href, nameAusBild }, jetzt = new Date()) {
  const profilKey = profilKeyAus(href)
  if (!profilKey) return null
  const roh = (zeilen ?? []).map((z) => String(z).trim()).filter(Boolean)
  // Nur echte Einladungen tragen „Annehmen". Ohne diese Bedingung würde jeder
  // andere Profil-Link der Seite (Vorschläge „Personen, die Sie kennen
  // könnten", Kevins eigenes Profil) zur Anfrage.
  if (!roh.some((z) => /^(annehmen|accept)$/i.test(z))) return null
  if (roh.some((z) => FOLGEN_SATZ.test(z))) return { folgen: true, profilKey }

  const echte = roh.filter((z) => !RAUSCHEN_ANFRAGE.test(z) && !KNOPF.test(z) && !/^--$/.test(z))
  const zeitZeile = echte.find((z) => ZEIT_EINGANG.test(z)) ?? ''
  const gemeinsame = echte.find((z) => GEMEINSAME.test(z)) ?? ''
  const inhalt = echte.filter((z) => z !== zeitZeile && z !== gemeinsame)

  const ersteZeile = inhalt[0] ?? ''
  const roherName = ANFRAGE_SATZ.test(ersteZeile)
    ? ersteZeile.replace(ANFRAGE_SATZ, '')
    : ersteZeile || nameAusProfilbild(nameAusBild, profilKey)
  const name = String(roherName ?? '').replace(/\s*Aktueller Entitätsverlauf\s*$/i, '').trim()
  if (!name) return null
  // Steht der Satz „möchte Kontakt aufnehmen" als eigene Zeile, ist er Rauschen.
  const rest = inhalt.slice(1).filter((z) => !ANFRAGE_SATZ.test(` ${z}`) && !/^möchte\b/i.test(z))
  const headline = rest[0] ?? ''
  const notiz = rest
    .slice(1)
    .join('\n')
    .replace(/\s*(?:…|\.\.\.)\s*mehr(?: anzeigen)?$/i, '')
    .trim()
  const eingegangen = zeitZeile ? gesendetDatum(zeitZeile, jetzt) : null

  return {
    profilKey,
    name,
    headline,
    notiz,
    gemeinsame,
    profileUrl: `https://www.linkedin.com/in/${profilKey}/`,
    eingegangenAt: eingegangen ? eingegangen.toISOString() : null,
  }
}

/**
 * Die Gesamtzahl der Eingangsliste: „Alle (3)". Eigene Funktion statt eines
 * dritten Zweigs in `gesamtzahlAus` — dort würde das Muster auch auf der
 * Gesendet-Seite greifen, falls LinkedIn die Filterleiste dorthin übernimmt,
 * und die Vollständigkeit der InMail-Liste hängt an genau dieser Zahl.
 * „0" ist eine gültige Antwort (niemand hat angefragt), `null` heißt: nicht gelesen.
 */
export function anfragenGesamtAus(text) {
  const s = String(text ?? '')
  const m = s.match(/Alle\s*\(([\d.]+)\)/i)
  if (m) return Number(m[1].replace(/\./g, ''))
  if (/keine (ausstehenden |offenen )?einladungen|no pending invitations/i.test(s)) return 0
  return null
}

/** Vollständig bei der Eingangsliste: auch null von null ist vollständig — gezählt werden alle Karten, Folge-Einladungen inklusive. */
export function anfragenVollstaendig(karten, gesamt) {
  if (gesamt === 0) return karten === 0
  return istVollstaendig(karten, gesamt)
}

/**
 * Die Gesamtzahl, die die Seite selbst nennt („Personen (882)", „642 Kontakte").
 *
 * Sie ist das Abbruchkriterium des Blätterns UND die Gegenprobe: erntet der
 * Sync deutlich weniger, war der Lauf unvollständig und darf keine
 * Abwesenheits-Schlüsse tragen.
 */
export function gesamtzahlAus(text) {
  const s = String(text ?? '')
  // Der Tausenderpunkt (27.08.). Die Einladungsseite schreibt "Personen (1.052)",
  // und `\d+` matcht daran nicht - die Zahl blieb null, der Lauf galt als
  // abgebrochen, und der Waechter meldete Kevin taeglich einen Abbruch, den es
  // nicht gab. Der Kontakte-Zweig darunter behandelte den Punkt seit jeher; nur
  // dieser hier nicht. Unter tausend Einladungen faellt so ein halber Fix nicht auf.
  const a = s.match(/Personen\s*\(([\d.]+)\)/i)
  if (a) return Number(a[1].replace(/\./g, ''))
  const b = s.match(/([\d.]+)\s*Kontakte/i)
  if (b) return Number(b[1].replace(/\./g, ''))
  return null
}

/**
 * Wann gilt ein Lauf als vollständig?
 *
 * Nur dann darf er entscheiden, wer NICHT mehr da ist (D4 der Blaupause) — und
 * damit die InMail-Kandidaten bestimmen. Die Schwelle ist bewusst knapp unter
 * 100 %: LinkedIn zählt gelegentlich eine Handvoll Einträge mit, die es nicht
 * ausliefert (gesperrte Profile), und daran darf ein sonst sauberer Lauf nicht
 * scheitern.
 */
export const VOLLSTAENDIG_AB_ANTEIL = 0.97

export function istVollstaendig(geerntet, gesamt) {
  if (!Number.isFinite(gesamt) || gesamt <= 0) return false
  return geerntet >= Math.floor(gesamt * VOLLSTAENDIG_AB_ANTEIL)
}
