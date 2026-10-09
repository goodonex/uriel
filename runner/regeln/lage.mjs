/**
 * runner/regeln/lage.mjs — wie groß ist der Lead, und was bekommt er (09.10.2026)?
 *
 * Kevin, 09.10.2026: *„Wir hatten jetzt einen, der hat irgendwie 30 Milliarden
 * Volumen, also ein Hardcore-Baller. Auch mit einer guten Seite, und da wurde
 * irgendwas zum Formular gesagt. Wenn wir so Hardcore-Baller haben, die müssen
 * natürlich anders angegangen werden. Es muss erkannt werden, wann wir eine
 * Analyse schicken, wann das Sinn macht, wann aber vielleicht ein Telefonat mehr
 * Sinn macht."* Robert Anzenberger (BA Real Estate Partners, „über 30 Milliarden
 * Transaktionsvolumen") bekam am 05.10. eine Postfach-Kritik plus
 * Analyse-Angebot und sagte ab: *„wir sind hier im Moment so zufrieden wie wir
 * aufgestellt sind."*
 *
 * Bis heute stand das nur als Regel 22 in der Stimme, also nur im
 * Antwort-Pfad und nur als Prompt. Hier entscheidet der Code, mit Beleg:
 *
 * - `gewichtAus` — ist das ein großer Player? Nur mit wörtlichem Beleg aus
 *   Seite, Headline, Erfahrung oder Recherche, nie geschätzt.
 * - `kanalFuerAnsatz` — Analyse, Frage oder Telefonat, je Ansatz. Die
 *   Satz-Wache (`textWache.mjs`) prüft danach jeden Text dagegen.
 *
 * Bewusst NICHT im Ordner `erstnachrichten/`: dessen Hash ist die Regel-Fassung.
 */

/** Volumen-Wörter, die bei Milliarden oder hohen Millionen den großen Player verraten. */
const VOLUMEN = /(transaktions|investitions|fonds|projekt|portfolio|platzierungs|verkaufs|vermittlungs|bau|anlage|immobilien)?volumen|assets under management|\baum\b|verwaltete[sn]? vermögen|verwaltetes kapital|anlagekapital|under management/i

const MRD = /(?:über|mehr als|rund|ca\.?|knapp|fast|insgesamt|>)?\s*(\d{1,3}(?:[.,]\d{1,2})?)\s*\+?\s*(mrd\.?|milliarden?|billion(?:s)?\b|bn\b)/i
const MIO = /(?:über|mehr als|rund|ca\.?|knapp|fast|insgesamt|>)?\s*(\d{1,3}(?:[.,]\d{3})*|\d+(?:[.,]\d+)?)\s*\+?\s*(mio\.?|millionen)\s*(€|euro|eur|chf|franken)?/i

/** Institutionelle Häuser, unabhängig vom Volumen. */
// Nur Selbstbeschreibungen: „wir vermitteln an institutionelle Investoren" sagt auch ein Makler mit fünf Leuten.
const INSTITUTIONELL = /kapitalverwaltungsgesellschaft|\bkvg\b|börsennotiert|boersennotiert|\bsdax\b|\bmdax\b|pensionskasse|versorgungswerk/i

const MITARBEITER = /(\d{2,3}(?:\.\d{3})?|\d{4,})\s*\+?\s*(mitarbeiter(innen)?|mitarbeitende|beschäftigte|kolleg(inn)?en|employees)/i
const STANDORTE = /(\d{1,3})\s*(standorte|niederlassungen|büros|offices|shops)/i

const zahl = (t) => Number(String(t).replace(/\.(?=\d{3})/g, '').replace(',', '.'))

/**
 * Großer Player oder nicht — mit Beleg.
 *
 * `gross` heißt: Ein einzelner Eigentümer, der direkt über die Seite anfragt,
 * ist für diese Firma kein Hebel. Schwellen, ab denen das gilt:
 * - Volumen ab einer Milliarde (oder ab 500 Mio. mit Volumen-Wort)
 * - institutionelles Haus (KVG, börsennotiert, Pensionskasse, Versorgungswerk)
 * - ab 100 Mitarbeitenden oder ab 8 Standorten
 * - die Recherche sagt `groesse: konzern` UND Rechtsform AG/SE
 *
 * @param {object} r — Recherche-Destillat (oder Teil davon)
 * @param {{ texte?: string[] }} extra — sichtbarer Seitentext, Headline, Erfahrung
 * @returns {{ gewicht: 'gross'|'normal', beleg: string }}
 */
export function gewichtAus(r = {}, extra = {}) {
  const quellen = [
    ...(Array.isArray(extra.texte) ? extra.texte : []),
    r.gewicht_beleg,
    r.taetigkeit,
    r.befund,
    r.gesamteindruck,
    r.firma,
    r.headline,
  ]
    .map((x) => String(x ?? ''))
    .filter(Boolean)
  // Ein früherer Lauf hat es schon belegt.
  if (r.gewicht === 'gross' && String(r.gewicht_beleg ?? '').trim()) return { gewicht: 'gross', beleg: String(r.gewicht_beleg).slice(0, 120) }

  /** Zahl und Volumen-Wort im selben Umfeld (nicht satzweise: „650 Mio. €" würde am Punkt zerfallen). */
  const umfeld = (text, m) => {
    const ab = Math.max(0, m.index - 60)
    const roh = text.slice(ab, m.index + m[0].length + 80).replace(/\s+/g, ' ').trim()
    return ab > 0 ? roh.replace(/^\S*\s/, '') : roh
  }
  const alle = (re, text) => [...text.matchAll(new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`))]
  for (const q of quellen) {
    const text = q.replace(/\s+/g, ' ')
    for (const m of alle(MRD, text)) {
      const u = umfeld(text, m)
      // „1 Mrd." nur mit Volumen-Wort (sonst kann es „1 Mrd. Menschen" sein); ab 2 Mrd. reicht die Zahl.
      if (zahl(m[1]) >= 1 && (VOLUMEN.test(u) || zahl(m[1]) >= 2)) return { gewicht: 'gross', beleg: u.slice(0, 120) }
    }
    for (const m of alle(MIO, text)) {
      const u = umfeld(text, m)
      if (zahl(m[1]) >= 500 && VOLUMEN.test(u)) return { gewicht: 'gross', beleg: u.slice(0, 120) }
    }
    const inst = text.match(INSTITUTIONELL)
    if (inst) return { gewicht: 'gross', beleg: umfeld(text, inst).slice(0, 120) }
    for (const m of alle(MITARBEITER, text)) if (zahl(m[1]) >= 100) return { gewicht: 'gross', beleg: umfeld(text, m).slice(0, 120) }
    for (const m of alle(STANDORTE, text)) if (zahl(m[1]) >= 8) return { gewicht: 'gross', beleg: umfeld(text, m).slice(0, 120) }
  }
  const rechtsform = String(r.profil?.rechtsform || r.rechtsform || (/\b(AG|SE)\b/.exec(String(r.firma ?? ''))?.[1] ?? ''))
  if (String(r.groesse ?? '') === 'konzern' && /^(AG|SE)$/.test(rechtsform)) return { gewicht: 'gross', beleg: `Konzern, ${rechtsform}` }
  return { gewicht: 'normal', beleg: '' }
}

/**
 * Welcher Kanal gehört zu welchem Ansatz? Die eine Tabelle, nach der Kevin
 * fragte: Analyse, Frage oder Telefonat.
 *
 * - `analyse` — wir können sichtbar besser bauen, und der Empfänger
 *   entscheidet selbst (Inhaber/GF einer normalen Firma).
 * - `frage` — erst den Pain finden: starke Seiten, Verwaltungen, Verbund,
 *   große Player, Nebenfirma, frisch gegründet, keine/offline Seite.
 * - `telefonat` — nur dort, wo eine Seite fehlt und der Lead bewusst über
 *   Portal/Dachmarke arbeitet; sonst erst nach einer Antwort mit Pain.
 */
export const KANAL = {
  analyse: 'analyse',
  'seite-ist-das-thema': 'analyse',
  projektentwickler: 'analyse',
  'grosser-player': 'frage',
  'starke-seite': 'frage',
  'starke-seite-funnel': 'frage',
  hausverwaltung: 'frage',
  verbund: 'frage',
  nebenfirma: 'frage',
  'frisch-ohne-seite': 'frage',
  'keine-seite': 'frage',
  'seite-offline': 'frage',
  'neue-seite': 'frage',
  'seite-im-umbau': 'frage',
  'nur-portal': 'telefonat',
}

/** @returns {'analyse'|'frage'|'telefonat'|''} */
export function kanalFuerAnsatz(ansatz) {
  return KANAL[String(ansatz ?? '')] ?? ''
}

/**
 * Die Lage eines Leads für die Satz-Wache und den Antwort-Agenten — alles, was
 * ein Text über diesen Lead NICHT behaupten darf, hängt daran.
 */
export function lageAus({ recherche = {}, ansatz = '', headline = '', texte = [] } = {}) {
  const r = recherche ?? {}
  const g = gewichtAus({ ...r, headline: r.headline ?? headline }, { texte })
  const stufe = String(r.website_stufe ?? r.profil?.website_stufe ?? '')
  const wow = String(r.wow_potenzial ?? r.profil?.wow_potenzial ?? '')
  /**
   * Ohne Ansatz (Antwort- und Nachfass-Pfad): Der Kanal folgt aus dem, was über
   * den Lead belegt ist. Nichts belegt → keine Einschränkung, der Agent urteilt.
   */
  const ohneAnsatz =
    g.gewicht === 'gross' || r.geschaeftsmodell === 'hausverwaltung' || String(r.verbund ?? '').trim() || stufe === 'stark' || wow === 'nein' ? 'frage' : ''
  const kanal = g.gewicht === 'gross' ? 'frage' : kanalFuerAnsatz(ansatz) || ohneAnsatz
  return {
    ansatz: String(ansatz ?? ''),
    kanal,
    gewicht: g.gewicht,
    gewicht_beleg: g.beleg,
    geschaeftsmodell: String(r.geschaeftsmodell ?? ''),
    website: String(r.website ?? ''),
    website_stufe: String(r.website_stufe ?? r.profil?.website_stufe ?? ''),
    zeitgemaess: String(r.zeitgemaess ?? ''),
    meta_ads_aktiv: String(r.meta_ads_aktiv ?? r.profil?.meta_ads_aktiv ?? 'unbekannt'),
    google_ads_aktiv: String(r.google_ads_aktiv ?? r.profil?.google_ads_aktiv ?? 'unbekannt'),
  }
}
