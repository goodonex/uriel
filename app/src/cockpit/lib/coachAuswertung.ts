/**
 * Die Coach-Auswertung (17.09.2026) — die Wochenzahlen im Raster des
 * Agentur Inkubators.
 *
 * Kevins Auftrag: „All diese Zahlen möchte ich ordentlich in Uriel mit einem
 * Klick bekommen … genau in der Reihenfolge, wie er das trackt." Er zieht sie
 * **donnerstags abends**.
 *
 * **Die Vorlage.** Das Outreach-Tracker-Sheet aus Modul 3, Lektion 37 (Vault:
 * `04 Ressourcen/…/Agentur Inkubator 2.0/Modul 3 - LinkedIn-OS/37 Outreach
 * Tracking-Sheet.md`). Drei Blöcke nebeneinander, je Block in dieser Reihenfolge:
 * Versendete Nachrichten · Loom zugesendet · Conv. · Quali-Call-Termine · Conv. ·
 * Kunden · Conv. Davor gesetzt die Kontaktanfragen aus Lektion 42, danach die
 * Wochen-Standards aus Modul 1, Lektion 12, und der „Wert pro Aktion".
 *
 * **Die Woche läuft Freitag bis Donnerstag.** Wer am Donnerstagabend zieht und
 * Montag–Sonntag rechnete, sähe jede Woche nur vier Tage und am Montag darauf
 * drei davon ein zweites Mal. Freitag–Donnerstag deckt jeden Tag genau einmal ab.
 *
 * **Eine Zahl, eine Quelle je Tatsache — und wo zwei dasselbe messen, gewinnt
 * die grössere.** Erstnachrichten stehen sowohl in `linkedin_erstnachrichten`
 * (abgehakt) als auch in `daily_metrics.li_nachrichten` (gezählt); beide messen
 * dieselben Handgriffe, und jede Quelle verliert gelegentlich einen (Haken
 * vergessen, Zähler vergessen). Addieren hiesse doppelt zählen, das Maximum
 * ist die ehrlichste Schätzung.
 *
 * **Keine erfundene Zahl.** Termine und Kunden werden nicht nach Follow-up oder
 * InMail getrennt erfasst. Dort steht `null` („nicht getrennt erfasst"), nicht 0.
 *
 * Reine Funktionen, keine React-Importe — prüfbar per
 * `npx tsx scripts/verify-coach-auswertung.ts`.
 */
import { toIsoDate } from './metricsDates'

// ── Eingabe ────────────────────────────────────────────────────────────────

export interface CoachTageszeile {
  datum: string
  li_anfragen: number
  li_nachrichten: number
  inmails: number
  looms: number
  li_followups: number
  ig_followups: number
  call_followups: number
  antworten_li: number
  termine_li: number
  termine_ig: number
  termine_call: number
  quali_termine: number
  sales_calls: number
  abschluesse: number
  umsatz: number
}

export interface CoachEingabe {
  /** `useDailyMetrics().windowRows` */
  tageszeilen: readonly CoachTageszeile[]
  /** `usePosten().erstnachrichten.items` */
  erstnachrichten: readonly { status: string; sent_at: string | null }[]
  /** `usePosten().netzwerk.items` */
  netzwerk: readonly { status: string; eingeladen_at: string | null; angenommen_at: string | null }[]
  /** `useLeads().ereignisse` */
  ereignisse: readonly { lead_id: string; typ: string; at: string }[]
  jetzt: Date
}

// ── Die Woche ──────────────────────────────────────────────────────────────

export interface CoachWoche {
  /** Freitag, ISO-Datum */
  von: string
  /** Donnerstag, ISO-Datum */
  bis: string
  /** Kalenderwoche des Donnerstags (ISO 8601) */
  kw: number
}

function tagPlus(iso: string, tage: number): string {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + tage)
  return toIsoDate(d)
}

/** ISO-Kalenderwoche (Montag–Sonntag, die Woche mit dem 4. Januar ist KW 1). */
function isoKw(iso: string): number {
  const [j, m, t] = iso.split('-').map(Number)
  const d = new Date(Date.UTC(j, m - 1, t))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const jahresanfang = Date.UTC(d.getUTCFullYear(), 0, 1)
  return Math.ceil(((d.getTime() - jahresanfang) / 86_400_000 + 1) / 7)
}

/**
 * Die Tracking-Woche, die am jüngsten Donnerstag ≤ `jetzt` endet.
 *
 * Am Donnerstag selbst ist das der laufende Tag — genau dann zieht Kevin.
 * Am Freitag früh zeigt die Ansicht deshalb noch die abgeschlossene Woche und
 * nicht einen leeren ersten Tag.
 *
 * @param zurueck 0 = diese Woche, 1 = die davor, …
 */
export function coachWoche(jetzt: Date, zurueck = 0): CoachWoche {
  const heute = toIsoDate(jetzt)
  const wochentag = new Date(`${heute}T12:00:00`).getDay() // 0 So … 4 Do
  const seitDonnerstag = (wochentag - 4 + 7) % 7
  const bis = tagPlus(heute, -seitDonnerstag - 7 * Math.max(0, zurueck))
  return { von: tagPlus(bis, -6), bis, kw: isoKw(bis) }
}

/** Ortsdatum eines Zeitstempels — die Tagesgrenze liegt wie überall um Mitternacht. */
function ortsTag(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : toIsoDate(d)
}

// ── Die Zahlen einer Zeitspanne ────────────────────────────────────────────

export interface CoachZahlen {
  anfragen: number
  angenommen: number
  antworten: number

  liNachrichten: number
  liLooms: number
  liTermine: number
  kunden: number

  fuNachrichten: number
  fuLooms: number

  inmails: number
  inmailLooms: number

  looms: number
  termineGesamt: number
  qualiGefuehrt: number
  salesCalls: number
  umsatz: number
}

type LoomBlock = 'linkedin' | 'followup' | 'inmail'

/**
 * Aus welchem Block kam ein Loom?
 *
 * Entscheidet die Geschichte des Leads VOR dem Versand: Stand dort eine InMail,
 * war es der zweite Kanal; ein Follow-up, dann der Follow-up-Trichter — er hat
 * erst auf das Nachfassen reagiert. Sonst LinkedIn. InMail gewinnt vor
 * Follow-up, weil ein InMail-Lead nie eine Erstnachricht im Chat hatte.
 */
function loomBlock(ereignisse: readonly { typ: string; at: string }[], gesendetAt: string): LoomBlock {
  const vorher = ereignisse.filter((e) => e.at < gesendetAt)
  if (vorher.some((e) => e.typ === 'inmail')) return 'inmail'
  // Nur Follow-ups VOR der Zusage zählen: Ein Nachfassen nach „ja, schick mal"
  // ist Erinnerung, nicht der Grund für das Ja.
  const zusage = vorher.find((e) => e.typ === 'loom_zugesagt')?.at ?? gesendetAt
  if (vorher.some((e) => e.typ === 'followup' && e.at < zusage)) return 'followup'
  return 'linkedin'
}

export function coachZahlen(eingabe: CoachEingabe, von: string, bis: string): CoachZahlen {
  const drin = (tag: string | null) => tag !== null && tag >= von && tag <= bis
  const tage = eingabe.tageszeilen.filter((z) => drin(z.datum))
  const summe = (f: keyof CoachTageszeile) =>
    tage.reduce((s, z) => s + Math.max(0, Number(z[f]) || 0), 0)

  // Kontaktanfragen: Kevins Zähler. Ist er leer, die Formel aus Lektion 42 —
  // offene Einladungen plus Annahmen der Woche.
  const angenommen = eingabe.netzwerk.filter((n) => drin(ortsTag(n.angenommen_at))).length
  const offenEingeladen = eingabe.netzwerk.filter(
    (n) => n.status !== 'angenommen' && drin(ortsTag(n.eingeladen_at)),
  ).length
  const anfragenGezaehlt = summe('li_anfragen')
  const anfragen = anfragenGezaehlt > 0 ? anfragenGezaehlt : offenEingeladen + angenommen

  const erstnachrichtenAbgehakt = eingabe.erstnachrichten.filter(
    (e) => e.status === 'gesendet' && drin(ortsTag(e.sent_at)),
  ).length

  const jeLead = new Map<string, { typ: string; at: string }[]>()
  for (const e of eingabe.ereignisse) {
    const liste = jeLead.get(e.lead_id)
    if (liste) liste.push(e)
    else jeLead.set(e.lead_id, [e])
  }
  const ereignisseDrin = (typ: string) => eingabe.ereignisse.filter((e) => e.typ === typ && drin(ortsTag(e.at)))

  // Ein Loom je Lead — ein zweites Ereignis ist ein Doppelklick, kein zweites Video.
  const loomJeLead = new Map<string, string>()
  for (const e of ereignisseDrin('loom_gesendet')) {
    const bisher = loomJeLead.get(e.lead_id)
    if (!bisher || e.at < bisher) loomJeLead.set(e.lead_id, e.at)
  }
  const loomZaehler: Record<LoomBlock, number> = { linkedin: 0, followup: 0, inmail: 0 }
  for (const [leadId, at] of loomJeLead) loomZaehler[loomBlock(jeLead.get(leadId) ?? [], at)]++

  // Gezählte Looms ohne Lead-Ereignis (Zähler geklickt, nicht abgehakt) haben
  // keine Herkunft. Sie landen bei LinkedIn, dem Hauptkanal.
  const loomsGezaehlt = summe('looms')
  const looms = Math.max(loomJeLead.size, loomsGezaehlt)
  const liLooms = loomZaehler.linkedin + (looms - loomJeLead.size)

  const antwortLeads = new Set(ereignisseDrin('antwort_erhalten').map((e) => e.lead_id)).size

  return {
    anfragen,
    angenommen,
    antworten: Math.max(antwortLeads, summe('antworten_li')),

    liNachrichten: Math.max(erstnachrichtenAbgehakt, summe('li_nachrichten')),
    liLooms,
    liTermine: summe('termine_li'),
    kunden: summe('abschluesse'),

    fuNachrichten: Math.max(
      ereignisseDrin('followup').length,
      summe('li_followups') + summe('ig_followups') + summe('call_followups'),
    ),
    fuLooms: loomZaehler.followup,

    inmails: Math.max(ereignisseDrin('inmail').length, summe('inmails')),
    inmailLooms: loomZaehler.inmail,

    looms,
    termineGesamt: summe('termine_li') + summe('termine_ig') + summe('termine_call'),
    qualiGefuehrt: summe('quali_termine'),
    salesCalls: summe('sales_calls'),
    umsatz: summe('umsatz'),
  }
}

// ── Das Raster ─────────────────────────────────────────────────────────────

export interface Ziel {
  /** Untergrenze in Prozent bzw. Stück */
  min: number
  /** Obergrenze des Korridors; darüber gilt „sehr gut" */
  max?: number
  text: string
}

export type Bewertung = 'unter' | 'im_ziel' | 'stark' | null

export interface CoachZeile {
  art: 'zahl' | 'quote' | 'euro'
  label: string
  /** Wert der Woche. `null` = wird so nicht erfasst. Quoten als Anteil 0–1. */
  woche: number | null
  /** Zahl/Euro: Wochenschnitt der letzten vier Wochen. Quote: Quote über die vier Wochen. */
  schnitt: number | null
  ziel?: Ziel
  bewertung: Bewertung
  hinweis?: string
}

export interface CoachBlock {
  id: string
  titel: string
  hinweis?: string
  zeilen: CoachZeile[]
}

export interface CoachAuswertung {
  woche: CoachWoche
  /** Beginn der Vier-Wochen-Spanne (Freitag vor drei Wochen) */
  schnittVon: string
  bloecke: CoachBlock[]
}

function quote(zaehler: number | null, nenner: number | null): number | null {
  if (zaehler === null || nenner === null || nenner <= 0) return null
  return zaehler / nenner
}

function bewerte(wert: number | null, ziel: Ziel | undefined, art: CoachZeile['art']): Bewertung {
  if (wert === null || !ziel) return null
  const v = art === 'quote' ? wert * 100 : wert
  if (v < ziel.min) return 'unter'
  if (ziel.max !== undefined && v > ziel.max) return 'stark'
  return 'im_ziel'
}

function zahlZeile(label: string, w: number | null, s: number | null, ziel?: Ziel, hinweis?: string): CoachZeile {
  return { art: 'zahl', label, woche: w, schnitt: s === null ? null : s / 4, ziel, bewertung: bewerte(w, ziel, 'zahl'), hinweis }
}

function quoteZeile(
  label: string,
  wZ: number | null,
  wN: number | null,
  sZ: number | null,
  sN: number | null,
  ziel?: Ziel,
): CoachZeile {
  const schnitt = quote(sZ, sN)
  // Bewertet wird am Vier-Wochen-Wert: Der Coach sagt ausdrücklich, dass
  // einzelne Wochen „komisch" aussehen, weil Termine zeitversetzt entstehen.
  return { art: 'quote', label, woche: quote(wZ, wN), schnitt, ziel, bewertung: bewerte(schnitt, ziel, 'quote') }
}

/** Ein Block im Sheet-Aufbau: Nachrichten · Loom · Conv. · Termine · Conv. · Kunden · Conv. */
function sheetBlock(
  id: string,
  titel: string,
  nachrichtenLabel: string,
  w: { n: number; l: number; t: number | null; k: number | null },
  s: { n: number; l: number; t: number | null; k: number | null },
  ziele: [Ziel, Ziel, Ziel],
  hinweis?: string,
): CoachBlock {
  return {
    id,
    titel,
    hinweis,
    zeilen: [
      zahlZeile(nachrichtenLabel, w.n, s.n),
      zahlZeile('Loom zugesendet', w.l, s.l),
      quoteZeile('Conv. Nachricht → Loom', w.l, w.n, s.l, s.n, ziele[0]),
      zahlZeile('Quali-Call-Termine', w.t, s.t),
      quoteZeile('Conv. Loom → Quali-Call', w.t, w.l, s.t, s.l, ziele[1]),
      zahlZeile('Kunden', w.k, s.k),
      quoteZeile('Conv. Quali-Call → Kunde', w.k, w.t, s.k, s.t, ziele[2]),
    ],
  }
}

export function coachAuswertung(eingabe: CoachEingabe, zurueck = 0): CoachAuswertung {
  const woche = coachWoche(eingabe.jetzt, zurueck)
  const schnittVon = tagPlus(woche.von, -21)
  const w = coachZahlen(eingabe, woche.von, woche.bis)
  const s = coachZahlen(eingabe, schnittVon, woche.bis)

  const bloecke: CoachBlock[] = [
    {
      id: 'anfragen',
      titel: 'Kontaktanfragen',
      hinweis: 'Lektion 42 — steuert indirekt alles darunter.',
      zeilen: [
        zahlZeile('Kontaktanfragen versendet', w.anfragen, s.anfragen, { min: 150, max: 200, text: '200+ (150 okay)' }),
        zahlZeile('Angenommen', w.angenommen, s.angenommen),
        quoteZeile('Annahmequote', w.angenommen, w.anfragen, s.angenommen, s.anfragen),
      ],
    },
    sheetBlock(
      'linkedin',
      '1 · LinkedIn',
      'Versendete Nachrichten',
      { n: w.liNachrichten, l: w.liLooms, t: w.liTermine, k: w.kunden },
      { n: s.liNachrichten, l: s.liLooms, t: s.liTermine, k: s.kunden },
      [
        { min: 10, max: 20, text: '10–20 %' },
        { min: 10, max: 30, text: '10–30 %' },
        { min: 25, text: '25 %+' },
      ],
      'Abschlüsse werden nicht nach Kanal erfasst und stehen deshalb hier beim Hauptkanal.',
    ),
    sheetBlock(
      'followup',
      '2 · Follow-up',
      'Follow-up-Nachrichten',
      { n: w.fuNachrichten, l: w.fuLooms, t: null, k: null },
      { n: s.fuNachrichten, l: s.fuLooms, t: null, k: null },
      [
        { min: 5, max: 10, text: '5–10 %' },
        { min: 10, max: 30, text: '10–30 %' },
        { min: 50, text: '50 %+' },
      ],
      'Termine und Kunden aus dem Follow-up werden nicht getrennt erfasst.',
    ),
    sheetBlock(
      'inmail',
      '3 · 2. Vertriebskanal: InMail',
      'Versendete InMails',
      { n: w.inmails, l: w.inmailLooms, t: null, k: null },
      { n: s.inmails, l: s.inmailLooms, t: null, k: null },
      [
        { min: 10, max: 20, text: '10–20 %' },
        { min: 10, max: 30, text: '10–30 %' },
        { min: 25, text: '25 %+' },
      ],
      'Termine und Kunden aus InMails werden nicht getrennt erfasst.',
    ),
    {
      id: 'gesamt',
      titel: 'Gesamt & Wert pro Aktion',
      zeilen: [
        quoteZeile('Antwortrate Erstnachricht', w.antworten, w.liNachrichten, s.antworten, s.liNachrichten, {
          min: 15,
          max: 25,
          text: '15–25 %',
        }),
        zahlZeile('Quali-Calls geführt', w.qualiGefuehrt, s.qualiGefuehrt),
        zahlZeile('Sales-Calls geführt', w.salesCalls, s.salesCalls),
        quoteZeile('Gesamt-Abschlussquote', w.kunden, w.termineGesamt, s.kunden, s.termineGesamt, {
          min: 50,
          text: '> 50 %',
        }),
        { art: 'euro', label: 'Umsatz', woche: w.umsatz, schnitt: s.umsatz / 4, bewertung: null },
        {
          art: 'euro',
          label: 'Wert pro Loom',
          woche: quote(w.umsatz, w.looms),
          schnitt: quote(s.umsatz, s.looms),
          bewertung: null,
        },
        {
          art: 'euro',
          label: 'Wert pro Erstnachricht',
          woche: quote(w.umsatz, w.liNachrichten),
          schnitt: quote(s.umsatz, s.liNachrichten),
          bewertung: null,
        },
      ],
    },
    {
      id: 'standards',
      titel: 'Wochen-Standards',
      hinweis: 'Modul 1, Lektion 12 — das Minimum pro Woche.',
      zeilen: [
        zahlZeile('Looms gesamt', w.looms, s.looms, { min: 15, max: 20, text: '15–20' }),
        zahlZeile('Quali-Termine vereinbart', w.termineGesamt, s.termineGesamt, { min: 3, max: 5, text: '3–5' }),
        zahlZeile('Abschlüsse', w.kunden, s.kunden, { min: 1, max: 2, text: '1–2' }),
      ],
    },
  ]

  return { woche, schnittVon, bloecke }
}

// ── Anzeige & Export ───────────────────────────────────────────────────────

export function formatWert(art: CoachZeile['art'], wert: number | null): string {
  if (wert === null) return '—'
  if (art === 'quote') return `${(wert * 100).toLocaleString('de-DE', { maximumFractionDigits: 1 })} %`
  if (art === 'euro') return `${Math.round(wert).toLocaleString('de-DE')} €`
  return wert.toLocaleString('de-DE', { maximumFractionDigits: 1 })
}

export function datumKurz(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}.${m}.`
}

/** Klartext zum Weitergeben — dieselbe Reihenfolge wie auf dem Bildschirm. */
export function coachText(a: CoachAuswertung): string {
  const zeilen: string[] = [
    `KW ${a.woche.kw} · ${datumKurz(a.woche.von)}–${datumKurz(a.woche.bis)}${a.woche.bis.slice(0, 4)}`,
  ]
  for (const b of a.bloecke) {
    zeilen.push('', b.titel.toUpperCase())
    for (const z of b.zeilen) {
      if (z.woche === null && z.schnitt === null) continue
      const ziel = z.ziel ? ` (Ziel ${z.ziel.text})` : ''
      zeilen.push(`${z.label}: ${formatWert(z.art, z.woche)}${ziel}`)
    }
  }
  return zeilen.join('\n')
}
