/**
 * Sales-Ziele (REBUILD-PLAN §9, Quelle: Kevins KPI-System).
 * Wochenziele + back-loaded Soll-Kurve Juli 2026. August analog generiert.
 * v1 fest verdrahtet — später konfigurierbar.
 */

export const WEEK_TARGETS = {
  // Getrennt seit der Vitals-Trennung: Anfragen = LI-Vernetzung + IG-Follows,
  // Nachrichten = LI- + IG-Erstnachrichten. Split der alten Sammel-150
  // („alle Kanäle") — bei Bedarf hier justieren.
  anfragen: 75,
  nachrichten: 75,
  looms: 25,
  termine: 5, // neu vereinbarte Termine (alle Herkunfts-Kanäle)
  abschluesse: 2,
} as const

/** Kumulierte Umsatz-Soll-Werte je Kalenderwoche (back-loaded, Sales-Lag ~2 Wo). */
export interface WeekTarget {
  kw: number
  /** ISO-Montag der Woche */
  weekStart: string
  /** kumuliertes Umsatz-Soll in € zum Wochenende */
  sollKumuliert: number
}

export const JULY_2026_CURVE: WeekTarget[] = [
  { kw: 28, weekStart: '2026-07-06', sollKumuliert: 3000 },
  { kw: 29, weekStart: '2026-07-13', sollKumuliert: 11000 },
  { kw: 30, weekStart: '2026-07-20', sollKumuliert: 20000 },
  { kw: 31, weekStart: '2026-07-27', sollKumuliert: 30000 },
]

/** August-Ziel 50k, gleiche back-loaded Verteilung (10% / 36.7% / 66.7% / 100%). */
export const AUGUST_2026_CURVE: WeekTarget[] = [
  { kw: 32, weekStart: '2026-08-03', sollKumuliert: 5000 },
  { kw: 33, weekStart: '2026-08-10', sollKumuliert: 18300 },
  { kw: 34, weekStart: '2026-08-17', sollKumuliert: 33300 },
  { kw: 35, weekStart: '2026-08-24', sollKumuliert: 50000 },
]

export const MONTH_TARGETS: Record<string, { label: string; total: number; curve: WeekTarget[] }> = {
  '2026-07': { label: 'Juli 2026', total: 30000, curve: JULY_2026_CURVE },
  '2026-08': { label: 'August 2026', total: 50000, curve: AUGUST_2026_CURVE },
}

/** Benchmark-Antwortraten je Kanal (für Referenzlinien in Phase 3). */
export const CHANNEL_BENCHMARKS = [
  { key: 'li_anfragen', label: 'LinkedIn', min: 0.15, max: 0.25 },
  { key: 'inmails', label: 'InMail', min: 0.1, max: 0.25 },
  { key: 'ig_anfragen', label: 'Instagram', min: 0.1, max: 0.15 },
] as const

/**
 * Conversion-Zielquoten des Coachings (Agentur Inkubator / Marcel Steljes,
 * Outreach-Tracker). „min" = Zielband-Untergrenze, „great" = „sehr gut".
 */
export const CONVERSION_TARGETS = {
  nachrichtLoom: { label: 'Nachricht → Loom', min: 0.1, max: 0.2, great: 0.2 },
  loomQuali: { label: 'Loom → Quali-Call', min: 0.1, max: 0.3, great: 0.3 },
  qualiKunde: { label: 'Quali → Kunde', min: 0.25, max: 0.5, great: 0.5 },
} as const

/**
 * Nordstern / Traumleben (Zielplanung 2026, Interview 09.07.2026).
 * Netto-Wunsch → nötiger Agentur-Umsatz (Faustregel Faktor ~2) → getragen aus zwei Töpfen:
 * Neukunden-Cash (Projekt + Setup) + Retainer-MRR (Leadgen, kumulativ).
 * Kernmeilenstein: 20 aktive Leadgen-Retainer = 10.000 € MRR → „Freundin/Familie kann aufhören".
 */
export const LIFE_TARGET = {
  nettoMonat: 20000,
  umsatzMonat: 40000, // ≈ netto × Faktor 2,0 (Steuern/Abgaben/Betrieb/Reinvest)
  cashProKunde: 5500, // Branding & Website 3.500 + Leadgen Setup 2.000 (einmalig)
  mrrProKunde: 500, // Leadgen-Retainer (+ Beteiligung, hier nicht beziffert)
  neukundenProMonat: 5,
  mrrMeilenstein: 10000, // Freundin/Familie kann aufhören zu arbeiten
  retainerKundenZiel: 20, // = mrrMeilenstein / mrrProKunde
} as const

/** localStorage-Key für den (aktuell manuell gepflegten) Stand aktiver Retainer-Kunden. */
export const RETAINER_KUNDEN_KEY = 'cockpit.retainerKunden'

/** Aktuelles Soll für "heute" aus einer Kurve interpolieren (Wochenende = voller Wert). */
export function currentSoll(curve: WeekTarget[], today = new Date()): number {
  let soll = 0
  for (const w of curve) {
    const start = new Date(`${w.weekStart}T00:00:00`)
    const end = new Date(start)
    end.setDate(end.getDate() + 7)
    if (today >= end) soll = w.sollKumuliert
  }
  return soll
}

export function formatEuro(value: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)
}
