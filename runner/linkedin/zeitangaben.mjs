/**
 * runner/linkedin/zeitangaben.mjs — Datum und Terminvorschläge für die
 * Antwort-Entwürfe (06.10.2026).
 *
 * Anlass: Der Entwurf für Marco Stadelmann entstand Montag 20:10 und bot
 * „Morgen um 10 Uhr" an. Kevin las ihn Dienstag 12:40 — „morgen" war da
 * Mittwoch, 10 Uhr war vorbei. Der Agent kannte weder das Datum noch Kevins
 * Zeitfenster und schrieb relativ.
 *
 * Seitdem bekommt jeder Lauf:
 * - das heutige Datum mit Wochentag (Europe/Berlin),
 * - zwei fertige Terminvorschläge als Platzhalter `[[Mittwoch, 7.10.2026, nachmittags]]`.
 *   Das Cockpit macht daraus beim Anzeigen „morgen Nachmittag" — gerechnet ab
 *   dem Moment, in dem Kevin den Text liest, nicht ab der Nacht
 *   (`app/src/cockpit/lib/entwurfZeitangaben.ts`).
 *
 * Kevins Fenster stehen an EINER Stelle: `ui_settings.anrufFenster`, sonst
 * `ANRUF_FENSTER_STANDARD`. Werktage zählen ab heute, Wochenenden fallen raus.
 * `scripts/verify-entwurf-zeitangaben.ts` prüft, dass das Cockpit jeden
 * Platzhalter von hier lesen kann.
 */

const TAG_MS = 24 * 60 * 60 * 1000
const WOCHENTAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']

/**
 * Kevins Standard für Telefonat-Angebote: nächster Werktag nachmittags, der
 * Werktag danach ganztägig („morgen Nachmittag oder übermorgen").
 * Überschreibbar ohne Code über `ui_settings` (setting_key `anrufFenster`),
 * z. B. `[{"werktage":1,"fenster":"vormittags"},{"werktage":2,"fenster":"um 14 Uhr"}]`.
 * `fenster`: vormittags | nachmittags | ganztägig | „um 14 Uhr" | „ab 15 Uhr".
 */
export const ANRUF_FENSTER_STANDARD = [
  { werktage: 1, fenster: 'nachmittags' },
  { werktage: 2, fenster: 'ganztägig' },
]

const FENSTER_OK = /^(vormittags|nachmittags|ganztägig|(um|ab) ([01]?\d|2[0-3])(:[0-5]\d)? Uhr)$/

/** Einstellung prüfen; alles Unlesbare fällt still auf den Standard zurück. */
export function anrufFensterAus(wert) {
  const liste = Array.isArray(wert) ? wert : Array.isArray(wert?.slots) ? wert.slots : null
  if (!liste || liste.length !== 2) return ANRUF_FENSTER_STANDARD
  const ok = liste.every(
    (s) => Number.isInteger(s?.werktage) && s.werktage >= 0 && s.werktage <= 10 && FENSTER_OK.test(String(s?.fenster ?? '')),
  )
  return ok ? liste.map((s) => ({ werktage: s.werktage, fenster: s.fenster })) : ANRUF_FENSTER_STANDARD
}

const BERLIN = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Berlin',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** Kalendertag in Berlin (Tage seit 1970-01-01) plus Uhrzeit. */
export function berlinZeit(d) {
  const t = {}
  for (const p of BERLIN.formatToParts(d)) t[p.type] = p.value
  return {
    tag: Date.UTC(Number(t.year), Number(t.month) - 1, Number(t.day)) / TAG_MS,
    stunde: Number(t.hour) % 24,
    minute: Number(t.minute),
  }
}

function datumVon(tag) {
  const d = new Date(tag * TAG_MS)
  return { jahr: d.getUTCFullYear(), monat: d.getUTCMonth() + 1, tag: d.getUTCDate(), wochentag: d.getUTCDay() }
}

export function werktageWeiter(tag, n) {
  let t = tag
  for (let rest = n; rest > 0; ) {
    t += 1
    const w = datumVon(t).wochentag
    if (w !== 0 && w !== 6) rest--
  }
  return t
}

/** `[[Mittwoch, 7.10.2026, nachmittags]]` — dieselbe Form wie `slotToken` im Cockpit. */
export function slotToken(tag, fenster) {
  const d = datumVon(tag)
  return `[[${WOCHENTAGE[d.wochentag]}, ${d.tag}.${d.monat}.${d.jahr}, ${fenster}]]`
}

function langesDatum(tag) {
  const d = datumVon(tag)
  return `${WOCHENTAGE[d.wochentag]}, ${d.tag}.${d.monat}.${d.jahr}`
}

/**
 * Der `zeit`-Block für den Agenten-Input. Steht im JSON neben den Threads; die
 * Regel, wie er zu nutzen ist, steht in Kevins Stimme
 * (`runner/regeln/stimme/herrmann-outreach.md`, „Zeitangaben und Telefonat").
 */
export function zeitKontext(now = new Date(), fenster = ANRUF_FENSTER_STANDARD) {
  const jetzt = berlinZeit(now)
  const hh = String(jetzt.stunde).padStart(2, '0')
  const mm = String(jetzt.minute).padStart(2, '0')
  return {
    heute: `${langesDatum(jetzt.tag)}, ${hh}:${mm} Uhr (Europe/Berlin)`,
    naechster_werktag: langesDatum(werktageWeiter(jetzt.tag, 1)),
    anruf_vorschlaege: anrufFensterAus(fenster).map((s) => slotToken(werktageWeiter(jetzt.tag, s.werktage), s.fenster)),
    regel:
      'Nie „heute", „morgen", „übermorgen" oder „nächste Woche" schreiben: Der Text wird erst Stunden später verschickt. ' +
      'Termine als Platzhalter [[Wochentag, T.M.JJJJ, Fenster]] schreiben, sonstige Tage als Wochentag + Datum ' +
      '(„Mittwoch, 7.10."). Jedes Telefonat-Angebot endet mit genau zwei Vorschlägen, Standard: die beiden aus ' +
      '`anruf_vorschlaege` wörtlich, z. B. „Mir würde zum Beispiel [[…]] oder [[…]] ganz gut passen."',
  }
}

const TOKEN = /\[\[[^\]\n]{1,80}\]\]/g

/** Bietet der Text ein Gespräch an? Bewusst eng: nur Kevins feste Formulierungen. */
const ANRUF = /telefonieren|telefonat|kurz austauschen|gern austauschen|ruf ich dich an|rufe? ich sie an|zehn minuten/i

/** Steht schon irgendeine konkrete Zeit im Text (Wochentag, Datum, Uhrzeit, „morgen")? */
const ZEIT = new RegExp(
  `(?:${WOCHENTAGE.join('|')})(?![a-zäöüß])|\\b\\d{1,2}\\.\\d{1,2}\\.|\\b\\d{1,2}(?::\\d{2})?\\s*Uhr\\b|(?:^|[^a-zäöüß])(?:über)?morgen(?![a-zäöüß])`,
  'i',
)

/**
 * Sicherung hinter dem Agenten: Ein Telefonat-Angebot ohne jeden Zeitvorschlag
 * bekommt Kevins zwei Standard-Vorschläge angehängt. Hat der Agent selbst eine
 * Zeit genannt, wird nichts angefasst — lieber ein eigener Vorschlag als zwei
 * doppelte.
 */
export function ergaenzeAnrufVorschlaege(text, vorschlaege) {
  const s = String(text ?? '')
  if (!ANRUF.test(s)) return s
  if ((s.match(TOKEN) ?? []).length >= 2) return s
  if (s.match(TOKEN) || ZEIT.test(s)) return s
  if (!Array.isArray(vorschlaege) || vorschlaege.length < 2) return s
  return `${s.trimEnd()} Mir würde zum Beispiel ${vorschlaege[0]} oder ${vorschlaege[1]} ganz gut passen.`
}
