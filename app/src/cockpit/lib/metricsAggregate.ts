import type { Vital } from '../components/VitalsPanel'
import type { DailyMetricsRow } from './useDailyMetrics'
import { toIsoDate } from './useDailyMetrics'
import { CONVERSION_TARGETS, WEEK_TARGETS } from './goals'

export function sumField(rows: DailyMetricsRow[], field: keyof DailyMetricsRow): number {
  return rows.reduce((acc, r) => acc + (Number(r[field]) || 0), 0)
}

export function anfragenTotal(row: DailyMetricsRow): number {
  return row.li_anfragen + row.inmails + row.ig_anfragen + row.coldmails
}

export function antwortenTotal(row: DailyMetricsRow): number {
  return row.antworten_li + row.antworten_inmail + row.antworten_ig + row.antworten_cold
}

export function termineTotal(row: DailyMetricsRow): number {
  return row.quali_termine + row.sales_calls
}

/** Letzte `days` Kalendertage als Werte-Reihe (fehlende Tage = 0) für Sparklines. */
export function historySeries(
  rows: DailyMetricsRow[],
  pick: (row: DailyMetricsRow) => number,
  days = 14,
): number[] {
  const byDate = new Map(rows.map((r) => [r.datum, r]))
  const out: number[] = []
  const d = new Date()
  d.setDate(d.getDate() - (days - 1))
  for (let i = 0; i < days; i++) {
    const row = byDate.get(toIsoDate(d))
    out.push(row ? pick(row) : 0)
    d.setDate(d.getDate() + 1)
  }
  return out
}

/** Wochen-Vitals in der Form, die VitalsPanel erwartet (ersetzt Mock). */
export function weekVitals(weekRows: DailyMetricsRow[], monthRows: DailyMetricsRow[]): Vital[] {
  return [
    {
      key: 'looms',
      label: 'Looms',
      current: sumField(weekRows, 'looms'),
      target: WEEK_TARGETS.looms,
      history: historySeries(monthRows, (r) => r.looms),
    },
    {
      key: 'anfragen',
      label: 'Anfragen',
      current: weekRows.reduce((a, r) => a + anfragenTotal(r), 0),
      target: WEEK_TARGETS.anfragen,
      history: historySeries(monthRows, anfragenTotal),
    },
    {
      key: 'termine',
      label: 'Termine',
      current: weekRows.reduce((a, r) => a + termineTotal(r), 0),
      target: WEEK_TARGETS.termine,
      history: historySeries(monthRows, termineTotal),
    },
    {
      key: 'abschluesse',
      label: 'Abschlüsse',
      current: sumField(weekRows, 'abschluesse'),
      target: WEEK_TARGETS.abschluesse,
      history: historySeries(monthRows, (r) => r.abschluesse),
    },
  ]
}

/**
 * Funnel-Conversions + „Wert pro Aktion" nach dem Coach-Modell (Agentur
 * Inkubator). Conversions über den laufenden Monat (stabiler als eine
 * einzelne Woche — der Coach liest Quoten bewusst über mehrere Wochen).
 */
export interface FunnelKpi {
  key: keyof typeof CONVERSION_TARGETS
  label: string
  rate: number | null
  min: number
  great: number
  /** 'great' ≥ „sehr gut" · 'ok' im Zielband · 'low' darunter · null ohne Daten */
  state: 'great' | 'ok' | 'low' | null
}

export interface FunnelKpis {
  conv: FunnelKpi[]
  /** € Umsatz je aufgenommenem Loom bzw. je Erstnachricht (laufender Monat) */
  perLoom: number | null
  perNachricht: number | null
}

export function funnelKpis(monthRows: DailyMetricsRow[], monthRevenue: number): FunnelKpis {
  const nachrichten = monthRows.reduce((a, r) => a + anfragenTotal(r), 0)
  const looms = sumField(monthRows, 'looms')
  const quali = sumField(monthRows, 'quali_termine')
  const kunden = sumField(monthRows, 'abschluesse')

  const build = (key: keyof typeof CONVERSION_TARGETS, num: number, den: number): FunnelKpi => {
    const t = CONVERSION_TARGETS[key]
    const rate = den > 0 ? num / den : null
    const state: FunnelKpi['state'] =
      rate == null ? null : rate >= t.great ? 'great' : rate >= t.min ? 'ok' : 'low'
    return { key, label: t.label, rate, min: t.min, great: t.great, state }
  }

  return {
    conv: [
      build('nachrichtLoom', looms, nachrichten),
      build('loomQuali', quali, looms),
      build('qualiKunde', kunden, quali),
    ],
    perLoom: looms > 0 ? monthRevenue / looms : null,
    perNachricht: nachrichten > 0 ? monthRevenue / nachrichten : null,
  }
}

export interface ChannelRate {
  key: string
  label: string
  anfragen: number
  antworten: number
  rate: number | null // null solange keine Anfragen
  benchMin: number
  benchMax: number
}

/** Antwortrate je Kanal über die übergebenen Zeilen (typisch: laufender Monat). */
export function channelRates(rows: DailyMetricsRow[]): ChannelRate[] {
  const defs = [
    { key: 'li', label: 'LinkedIn', a: 'li_anfragen', r: 'antworten_li', min: 0.15, max: 0.25 },
    { key: 'inmail', label: 'InMail', a: 'inmails', r: 'antworten_inmail', min: 0.1, max: 0.25 },
    { key: 'ig', label: 'Instagram', a: 'ig_anfragen', r: 'antworten_ig', min: 0.1, max: 0.15 },
    { key: 'cold', label: 'Cold-Mail', a: 'coldmails', r: 'antworten_cold', min: 0.04, max: 0.08 },
  ] as const

  return defs.map((d) => {
    const anfragen = sumField(rows, d.a as keyof DailyMetricsRow)
    const antworten = sumField(rows, d.r as keyof DailyMetricsRow)
    return {
      key: d.key,
      label: d.label,
      anfragen,
      antworten,
      rate: anfragen > 0 ? antworten / anfragen : null,
      benchMin: d.min,
      benchMax: d.max,
    }
  })
}

/** Kumulierte Ist-Umsatz-Punkte je Tag des Monats (für die Kurve). */
export function cumulativeRevenue(monthRows: DailyMetricsRow[]): Array<{ datum: string; kumuliert: number }> {
  let acc = 0
  return monthRows.map((r) => {
    acc += Number(r.umsatz) || 0
    return { datum: r.datum, kumuliert: acc }
  })
}
