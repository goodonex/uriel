/**
 * Mock-Vitals (Phase 2). Phase 3 ersetzt dies durch echte daily_metrics
 * aus Supabase — die Form bleibt identisch, damit CockpitHome unverändert bleibt.
 */

export interface Vital {
  key: string
  label: string
  current: number
  target: number
  /** letzte 14 Tage für Sparkline */
  history: number[]
}

export interface VitalsData {
  week: Vital[]
  /** kumulierter Monatsumsatz in € */
  monthRevenue: number
}

export function useVitals(): VitalsData {
  return {
    week: [
      { key: 'looms', label: 'Looms', current: 9, target: 25, history: [3, 5, 4, 5, 5, 0, 0, 4, 5, 5, 3, 5, 4, 5] },
      { key: 'anfragen', label: 'Anfragen', current: 54, target: 150, history: [28, 30, 25, 30, 31, 0, 0, 30, 24, 27, 30, 28, 26, 30] },
      { key: 'termine', label: 'Termine', current: 2, target: 5, history: [0, 1, 0, 1, 1, 0, 0, 0, 1, 0, 1, 1, 0, 1] },
      { key: 'abschluesse', label: 'Abschlüsse', current: 1, target: 2, history: [0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0] },
    ],
    monthRevenue: 3000,
  }
}
