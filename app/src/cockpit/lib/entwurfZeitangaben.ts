/**
 * Zeitangaben in Entwürfen stimmen im Moment des Sendens (06.10.2026).
 *
 * Anlass: Marco Stadelmann schrieb Montag 20:02 „Ja wann hast du Zeit?". Der
 * Entwurf von Montag 20:10 bot „Morgen um 10 Uhr oder Mittwoch um 14 Uhr" an.
 * Kevin öffnete ihn Dienstag 12:40 — „morgen" war da schon Mittwoch, und 10 Uhr
 * war vorbei. Der Nacht-Agent schreibt deshalb nie mehr „morgen", sondern
 * Wochentag + Datum, und Terminvorschläge als Platzhalter mit echtem Datum:
 *
 *     [[Mittwoch, 7.10.2026, nachmittags]]
 *
 * Diese Datei macht daraus beim ANZEIGEN die natürliche Form („morgen
 * Nachmittag"), gerechnet ab jetzt in Europe/Berlin. Dadurch kann sie nie
 * veralten. Alte Entwürfe, die noch „morgen" enthalten, werden gegen ihren
 * Entstehungstag aufgelöst und neu ausgedrückt. Liegt eine Zeitangabe schon in
 * der Vergangenheit, wird das nicht still angeboten, sondern markiert.
 *
 * Reine Funktionen, kein React. Der Runner rechnet die Platzhalter mit
 * `runner/linkedin/zeitangaben.mjs`; `scripts/verify-entwurf-zeitangaben.ts`
 * hält beide Seiten deckungsgleich.
 */

export const ZEIT_WARNUNG = 'Zeitangabe veraltet — Termin anpassen'

const TAG_MS = 24 * 60 * 60 * 1000
export const WOCHENTAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'] as const

export type Fenster =
  | { art: 'vormittags' }
  | { art: 'nachmittags' }
  | { art: 'ganztaegig' }
  | { art: 'um' | 'ab'; stunde: number; minute: number }

/** Ein Terminvorschlag: Kalendertag (Tage seit 1970-01-01, Berliner Datum) + Fenster. */
export interface Slot {
  tag: number
  fenster: Fenster
}

// ---------- Berliner Kalender ----------

const BERLIN = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Berlin',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

export interface BerlinZeit {
  /** Kalendertag als Zahl — Differenzen sind Kalendertage, nie Stunden/24. */
  tag: number
  stunde: number
  minute: number
}

export function berlinZeit(d: Date): BerlinZeit {
  const teile: Record<string, string> = {}
  for (const p of BERLIN.formatToParts(d)) teile[p.type] = p.value
  const tag = Date.UTC(Number(teile.year), Number(teile.month) - 1, Number(teile.day)) / TAG_MS
  return { tag, stunde: Number(teile.hour) % 24, minute: Number(teile.minute) }
}

export function tagAusDatum(jahr: number, monat: number, tagImMonat: number): number {
  return Date.UTC(jahr, monat - 1, tagImMonat) / TAG_MS
}

export function datumVon(tag: number): { jahr: number; monat: number; tag: number; wochentag: number } {
  const d = new Date(tag * TAG_MS)
  return { jahr: d.getUTCFullYear(), monat: d.getUTCMonth() + 1, tag: d.getUTCDate(), wochentag: d.getUTCDay() }
}

const istWochenende = (tag: number) => {
  const w = datumVon(tag).wochentag
  return w === 0 || w === 6
}

/** n Werktage weiter (negativ: zurück). Wochenenden werden übersprungen. */
export function werktageWeiter(tag: number, n: number): number {
  let t = tag
  let rest = Math.abs(n)
  const schritt = n < 0 ? -1 : 1
  while (rest > 0) {
    t += schritt
    if (!istWochenende(t)) rest--
  }
  return t
}

/** „Mittwoch, 7.10." */
export function wochentagDatum(tag: number): string {
  const d = datumVon(tag)
  return `${WOCHENTAGE[d.wochentag]}, ${d.tag}.${d.monat}.`
}

// ---------- Platzhalter [[…]] ----------

const TOKEN = /\[\[([^\]\n]{1,80})\]\]/g

function parseFenster(roh: string): Fenster | null {
  const s = roh.trim().toLowerCase()
  if (!s || /^ganzt(ä|ae)gig$|^ganzer tag$/.test(s)) return { art: 'ganztaegig' }
  if (/^vormittags?$/.test(s)) return { art: 'vormittags' }
  if (/^nachmittags?$/.test(s)) return { art: 'nachmittags' }
  const m = /^(um|ab|gegen)\s+(\d{1,2})(?:[:.](\d{2}))?\s*(?:uhr)?$/.exec(s)
  if (!m) return null
  const stunde = Number(m[2])
  const minute = m[3] ? Number(m[3]) : 0
  if (stunde > 23 || minute > 59) return null
  return { art: m[1] === 'ab' ? 'ab' : 'um', stunde, minute }
}

function jahrFuer(tagImMonat: number, monat: number, basisTag: number): number {
  const basisJahr = datumVon(basisTag).jahr
  const kandidat = tagAusDatum(basisJahr, monat, tagImMonat)
  if (kandidat < basisTag - 183) return basisJahr + 1
  if (kandidat > basisTag + 183) return basisJahr - 1
  return basisJahr
}

function gueltigesDatum(tagImMonat: number, monat: number, jahr: number): number | null {
  if (monat < 1 || monat > 12 || tagImMonat < 1 || tagImMonat > 31) return null
  const tag = tagAusDatum(jahr, monat, tagImMonat)
  const d = datumVon(tag)
  return d.monat === monat && d.tag === tagImMonat ? tag : null
}

/** „Mittwoch, 7.10.2026, nachmittags" → Slot. Das Datum zählt, der Wochentag ist Lesehilfe. */
export function parseSlot(inhalt: string, basisTag: number): Slot | null {
  const teile = inhalt.split(',').map((s) => s.trim())
  let i = 0
  if (WOCHENTAGE.includes(teile[0] as (typeof WOCHENTAGE)[number])) i++
  const dm = /^(\d{1,2})\.(\d{1,2})\.(\d{4})?$/.exec(teile[i] ?? '')
  if (!dm) return null
  const t = Number(dm[1])
  const m = Number(dm[2])
  const tag = gueltigesDatum(t, m, dm[3] ? Number(dm[3]) : jahrFuer(t, m, basisTag))
  if (tag == null) return null
  const fenster = parseFenster(teile.slice(i + 1).join(','))
  return fenster ? { tag, fenster } : null
}

function fensterText(f: Fenster): string {
  switch (f.art) {
    case 'vormittags':
      return 'vormittags'
    case 'nachmittags':
      return 'nachmittags'
    case 'ganztaegig':
      return 'ganztägig'
    default:
      return `${f.art} ${f.stunde}${f.minute ? `:${String(f.minute).padStart(2, '0')}` : ''} Uhr`
  }
}

/** Slot → Platzhalter, wie ihn der Runner in den Text schreibt. */
export function slotToken(slot: Slot): string {
  const d = datumVon(slot.tag)
  return `[[${WOCHENTAGE[d.wochentag]}, ${d.tag}.${d.monat}.${d.jahr}, ${fensterText(slot.fenster)}]]`
}

/** Wann gilt ein Fenster am selben Tag als verstrichen? (Minuten seit Mitternacht) */
function fensterEnde(f: Fenster): number {
  switch (f.art) {
    case 'vormittags':
      return 12 * 60
    case 'nachmittags':
    case 'ganztaegig':
      return 17 * 60
    case 'um':
      return f.stunde * 60 + f.minute
    case 'ab':
      return Math.max(f.stunde + 1, 18) * 60
  }
}

export function slotVorbei(slot: Slot, jetzt: BerlinZeit): boolean {
  if (slot.tag < jetzt.tag) return true
  if (slot.tag > jetzt.tag) return false
  return jetzt.stunde * 60 + jetzt.minute >= fensterEnde(slot.fenster)
}

/** Der Tag, wie man ihn in einer Nachricht sagt — relativ zu heute. */
function tagWort(tag: number, heute: number): { wort: string; absolut: boolean } {
  const diff = tag - heute
  if (diff === 0) return { wort: 'heute', absolut: false }
  if (diff === 1) return { wort: 'morgen', absolut: false }
  if (diff === 2) return { wort: 'übermorgen', absolut: false }
  if (diff >= 3 && diff <= 6) return { wort: WOCHENTAGE[datumVon(tag).wochentag], absolut: false }
  return { wort: wochentagDatum(tag), absolut: true }
}

/** Nur der Tag eines Vorschlags („morgen", „Freitag") — für das Feld, in dem das Fenster daneben steht. */
export function slotTagText(slot: Slot, jetzt: Date = new Date()): string {
  return tagWort(slot.tag, berlinZeit(jetzt).tag).wort
}

/** „morgen Nachmittag", „Freitag um 10 Uhr", „Mittwoch, 14.10. vormittags". */
export function slotText(slot: Slot, jetzt: BerlinZeit): string {
  const { wort, absolut } = tagWort(slot.tag, jetzt.tag)
  const f = slot.fenster
  if (f.art === 'ganztaegig') return wort
  if (f.art === 'vormittags') return `${wort} ${absolut ? 'vormittags' : 'Vormittag'}`
  if (f.art === 'nachmittags') return `${wort} ${absolut ? 'nachmittags' : 'Nachmittag'}`
  return `${wort} ${fensterText(f)}`
}

// ---------- Freitext-Zeitangaben (alte Entwürfe, Wochentag + Datum) ----------

const WT = WOCHENTAGE.slice(1).concat(WOCHENTAGE[0]).join('|')
const FREI = new RegExp(
  '(?<![\\p{L}\\d.\\[])(?:' +
    // 1 Präfix, 2 Wochentag, 3-5 Datum „, 7.10." / 6-8 Datum „(7.10.)"
    `(?:(am|Am|nächsten|Nächsten|kommenden|Kommenden|diesen|Diesen)\\s+)?(${WT})` +
    '(?:,?\\s+(?:den\\s+)?(\\d{1,2})\\.(\\d{1,2})\\.(\\d{4})?|\\s*\\((\\d{1,2})\\.(\\d{1,2})\\.(\\d{4})?\\))?' +
    // 9 Präfix, 10-12 reines Datum
    '|(?:(am|Am|den|Den)\\s+)?(\\d{1,2})\\.(\\d{1,2})\\.(\\d{4})?' +
    // 13 relatives Wort
    '|([Üü]bermorgen|[Mm]orgen|[Hh]eute)' +
    ')(?![\\p{L}\\d])',
  'gu',
)

/** „Guten Morgen", „am Morgen", „jeden Morgen" sind keine Zeitangabe. */
const MORGEN_NOMEN = /(?:guten|am|jeden|den|diesen|einen|schönen|nächsten|kommenden)\s+$/i

const UHRZEIT =
  /^\s*(?:(um|ab|gegen)\s+(\d{1,2})(?:[:.](\d{2}))?(?!\d)(?:\s*Uhr)?|(früh|vormittags?|Vormittag|mittags?|Mittag|nachmittags?|Nachmittag|abends?|Abend))/u

/** Ende der genannten Uhrzeit in Minuten seit Mitternacht; null = keine Uhrzeit genannt. */
function uhrzeitEnde(rest: string): number | null {
  const m = UHRZEIT.exec(rest)
  if (!m) return null
  if (m[1]) {
    const h = Number(m[2])
    const min = m[3] ? Number(m[3]) : 0
    if (h > 23 || min > 59) return null
    return m[1] === 'ab' ? Math.max(h + 1, 18) * 60 : h * 60 + min
  }
  const wort = m[4].toLowerCase()
  if (wort === 'früh' || wort.startsWith('vormittag')) return 12 * 60
  if (wort.startsWith('mittag')) return 14 * 60
  if (wort.startsWith('nachmittag')) return 17 * 60
  return 21 * 60
}

const gross = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

interface FreiErgebnis {
  text: string
  vorbei: boolean
  angepasst: boolean
}

function freitextUmrechnen(text: string, basisTag: number | null, jetzt: BerlinZeit, amAnfang: boolean): FreiErgebnis {
  let vorbei = false
  let angepasst = false
  let out = ''
  let pos = 0
  FREI.lastIndex = 0
  for (let m = FREI.exec(text); m; m = FREI.exec(text)) {
    const start = m.index
    let ende = start + m[0].length
    const relativ = m[13]
    if (relativ && /^morgen$/i.test(relativ) && MORGEN_NOMEN.test(text.slice(0, start))) continue

    const basis = basisTag ?? jetzt.tag
    let ziel: number | null
    let praefix: string | undefined
    if (m[2]) {
      praefix = m[1]
      const t = m[3] ?? m[6]
      const mo = m[4] ?? m[7]
      const j = m[5] ?? m[8]
      if (t) {
        ziel = gueltigesDatum(Number(t), Number(mo), j ? Number(j) : jahrFuer(Number(t), Number(mo), basis))
      } else {
        const w = WOCHENTAGE.indexOf(m[2] as (typeof WOCHENTAGE)[number])
        const delta = (w - datumVon(basis).wochentag + 7) % 7
        ziel = basis + (delta === 0 ? 7 : delta)
      }
    } else if (m[10]) {
      praefix = m[9]
      const t = Number(m[10])
      const mo = Number(m[11])
      ziel = gueltigesDatum(t, mo, m[12] ? Number(m[12]) : jahrFuer(t, mo, basis))
    } else {
      // „morgen" ohne bekannten Entstehungstag lässt sich nicht auflösen.
      if (basisTag == null) continue
      const w = relativ.toLowerCase()
      ziel = basisTag + (w === 'heute' ? 0 : w === 'morgen' ? 1 : 2)
    }
    if (ziel == null) continue
    // Zurückliegende Daten zur Zeit des Schreibens sind Erzählung, kein Termin.
    if (ziel < basis) continue

    const kommaUhr = /^,(?=\s*(?:um|ab|gegen)\s)/.exec(text.slice(ende))
    if (kommaUhr) ende += 1
    const ende_ = uhrzeitEnde(text.slice(ende))
    // „heute" ohne Uhrzeit ist meist „heutzutage" — nicht anfassen.
    if (relativ && /^heute$/i.test(relativ) && ende_ == null) continue

    const original = text.slice(start, ende)
    const diff = ziel - jetzt.tag
    let neu: string
    if (diff < 0) {
      vorbei = true
      neu = relativ ? wochentagDatum(ziel) : original
    } else {
      if (diff === 0 && ende_ != null && jetzt.stunde * 60 + jetzt.minute >= ende_) vorbei = true
      const { wort, absolut } = tagWort(ziel, jetzt.tag)
      if (absolut) {
        neu = (praefix ? `${praefix} ` : '') + wort + (kommaUhr ? ',' : '')
      } else if (diff >= 3) {
        neu = (praefix && /^am$/i.test(praefix) ? `${praefix} ` : '') + wort
      } else {
        neu = wort
      }
      const davor = out + text.slice(pos, start)
      if (davor.trim() ? /[.!?:]\s*$|\n\s*$/.test(davor) : amAnfang) neu = gross(neu)
    }
    if (neu !== original) angepasst = true
    out += text.slice(pos, start) + neu
    pos = ende
  }
  out += text.slice(pos)
  return { text: out, vorbei, angepasst }
}

// ---------- Gesamt ----------

export interface SlotAnzeige {
  /** null: Platzhalter nicht lesbar — er bleibt als Text stehen */
  slot: Slot | null
  text: string
  vorbei: boolean
}

export interface EntwurfZeitAnzeige {
  /** Der Text, wie er jetzt verschickt werden kann. */
  text: string
  slots: SlotAnzeige[]
  /** Irgendeine Zeitangabe liegt schon in der Vergangenheit. */
  zeitVeraltet: boolean
  /** Der Text weicht vom gespeicherten Entwurf ab (umgerechnet). */
  angepasst: boolean
}

const satzAnfang = (davor: string) => !davor.trim() || /[.!?:]\s*$|\n\s*$/.test(davor)

/**
 * Gespeicherter Entwurf → versandfertiger Text für JETZT.
 *
 * @param entwurfAt  Entstehungszeit (ISO) — löst „morgen" in alten Entwürfen auf
 * @param aenderungen  Kevins Verschiebungen je Platzhalter (Index), sonst das Gespeicherte
 */
export function entwurfZeitAnzeige(
  roh: string,
  entwurfAt: string | null,
  jetzt: Date = new Date(),
  aenderungen: ReadonlyArray<Slot | null | undefined> = [],
): EntwurfZeitAnzeige {
  const jb = berlinZeit(jetzt)
  const at = entwurfAt ? new Date(entwurfAt) : null
  const basisTag = at && !Number.isNaN(at.getTime()) ? berlinZeit(at).tag : null

  const slots: SlotAnzeige[] = []
  let text = ''
  let pos = 0
  let zeitVeraltet = false
  let angepasst = false
  TOKEN.lastIndex = 0
  for (let m = TOKEN.exec(roh); m; m = TOKEN.exec(roh)) {
    const frei = freitextUmrechnen(roh.slice(pos, m.index), basisTag, jb, pos === 0)
    text += frei.text
    zeitVeraltet ||= frei.vorbei

    const slot = aenderungen[slots.length] ?? parseSlot(m[1], basisTag ?? jb.tag)
    let wort = slot ? slotText(slot, jb) : m[1].trim()
    if (satzAnfang(text)) wort = gross(wort)
    const vorbei = slot ? slotVorbei(slot, jb) : false
    zeitVeraltet ||= vorbei
    slots.push({ slot, text: wort, vorbei })
    text += wort
    angepasst = true
    pos = m.index + m[0].length
  }
  const rest = freitextUmrechnen(roh.slice(pos), basisTag, jb, pos === 0)
  text += rest.text
  zeitVeraltet ||= rest.vorbei
  angepasst ||= rest.angepasst
  return { text, slots, zeitVeraltet, angepasst }
}

// ---------- Bedienung: Kevin verschiebt einen Vorschlag ----------

/** Einen Werktag früher/später. Nie vor heute. */
export function slotVerschieben(slot: Slot, richtung: 1 | -1, jetzt: Date = new Date()): Slot {
  const heute = berlinZeit(jetzt).tag
  const tag = werktageWeiter(slot.tag, richtung)
  return { ...slot, tag: Math.max(tag, heute) }
}

/** Die Auswahl im Zeit-Feld: Fenster plus volle Stunden 9–18 Uhr. */
export const FENSTER_AUSWAHL: { wert: string; label: string; fenster: Fenster }[] = [
  { wert: 'vormittags', label: 'Vormittag', fenster: { art: 'vormittags' } },
  { wert: 'nachmittags', label: 'Nachmittag', fenster: { art: 'nachmittags' } },
  { wert: 'ganztaegig', label: 'ganztägig', fenster: { art: 'ganztaegig' } },
  ...Array.from({ length: 10 }, (_, i) => ({
    wert: `um-${9 + i}`,
    label: `${9 + i} Uhr`,
    fenster: { art: 'um', stunde: 9 + i, minute: 0 } as Fenster,
  })),
]

export function fensterWert(f: Fenster): string {
  if (f.art === 'um' || f.art === 'ab') return `${f.art}-${f.stunde}${f.minute ? `-${f.minute}` : ''}`
  return f.art
}

// ---------- Label „von gestern Abend" ----------

function tageszeit(stunde: number): string | null {
  if (stunde < 5) return null
  if (stunde < 11) return 'Morgen'
  if (stunde < 14) return 'Mittag'
  if (stunde < 18) return 'Nachmittag'
  return 'Abend'
}

/**
 * Wann der Entwurf entstand, so wie man es sagt. Kalendertage in Berlin, nicht
 * Stunden/24: Bis zum 06.10.2026 hieß ein Entwurf von Montag 20:10, gelesen
 * Dienstag 12:40, „von heute Nacht" — 16 Stunden ergaben „0 Tage".
 */
export function entwurfStand(erstelltAm: string | null, jetzt: Date = new Date()): string {
  if (!erstelltAm) return 'vorbereitet'
  const t = new Date(erstelltAm)
  if (Number.isNaN(t.getTime())) return 'vorbereitet'
  const stunden = Math.floor((jetzt.getTime() - t.getTime()) / (60 * 60 * 1000))
  if (stunden < 1) return 'gerade eben'
  if (stunden < 12) return `vor ${stunden} h`
  const damals = berlinZeit(t)
  const tage = berlinZeit(jetzt).tag - damals.tag
  const zeit = tageszeit(damals.stunde)
  if (tage <= 0) return zeit ? `von heute ${zeit}` : 'von heute Nacht'
  if (tage === 1) return zeit ? `von gestern ${zeit}` : 'von gestern'
  return `vor ${tage} Tagen`
}

// ---------- Versand ----------

/** Was „Kopieren" in die Zwischenablage legt: der Entwurf für jetzt, mit Kevins Verschiebungen. */
export function versandText(
  entwurf: { text: string; roh?: string; erstelltAm: string | null },
  aenderungen?: ReadonlyArray<Slot | null | undefined>,
  jetzt: Date = new Date(),
): string {
  if (!entwurf.roh) return entwurf.text
  return entwurfZeitAnzeige(entwurf.roh, entwurf.erstelltAm, jetzt, aenderungen).text
}
