import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { useActiveBrand } from './activeBrand'

/** Eine Tageszeile aus daily_metrics (Migration 0049). */
export interface DailyMetricsRow {
  id?: string
  datum: string // YYYY-MM-DD
  li_anfragen: number
  inmails: number
  ig_anfragen: number
  coldmails: number
  followups: number
  looms: number
  antworten_li: number
  antworten_inmail: number
  antworten_ig: number
  antworten_cold: number
  quali_termine: number
  sales_calls: number
  abschluesse: number
  umsatz: number
  note?: string | null
}

export const METRIC_FIELDS = [
  'li_anfragen',
  'inmails',
  'ig_anfragen',
  'coldmails',
  'followups',
  'looms',
  'antworten_li',
  'antworten_inmail',
  'antworten_ig',
  'antworten_cold',
  'quali_termine',
  'sales_calls',
  'abschluesse',
] as const
export type MetricField = (typeof METRIC_FIELDS)[number]

export function emptyRow(datum: string): DailyMetricsRow {
  return {
    datum,
    li_anfragen: 0,
    inmails: 0,
    ig_anfragen: 0,
    coldmails: 0,
    followups: 0,
    looms: 0,
    antworten_li: 0,
    antworten_inmail: 0,
    antworten_ig: 0,
    antworten_cold: 0,
    quali_termine: 0,
    sales_calls: 0,
    abschluesse: 0,
    umsatz: 0,
  }
}

export function toIsoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Montag der Woche von `d` (de: Woche beginnt Montag). */
export function mondayOf(d: Date): Date {
  const copy = new Date(d)
  const day = (copy.getDay() + 6) % 7
  copy.setDate(copy.getDate() - day)
  copy.setHours(0, 0, 0, 0)
  return copy
}

interface UseDailyMetricsResult {
  /** alle Zeilen des laufenden Monats (aufsteigend nach Datum) */
  monthRows: DailyMetricsRow[]
  /** Zeilen der laufenden Woche (Mo–So) */
  weekRows: DailyMetricsRow[]
  /** heutige Zeile (leer, wenn noch nichts eingetragen) */
  today: DailyMetricsRow
  loading: boolean
  /** Tabelle fehlt → Migration 0049 noch nicht ausgeführt */
  tableMissing: boolean
  error: string | null
  /** Feld der heutigen Zeile um delta ändern (optimistisch + upsert) */
  bump: (field: MetricField, delta: number) => Promise<void>
  /** Umsatz der heutigen Zeile setzen */
  setUmsatz: (value: number) => Promise<void>
  refresh: () => Promise<void>
}

/**
 * Echte daily_metrics aus Supabase (ersetzt useVitalsMock ab Phase 3).
 * Lädt den laufenden Monat, schreibt per Upsert auf (user, brand, datum).
 */
export function useDailyMetrics(): UseDailyMetricsResult {
  const { user } = useAuth()
  const { activeBrand } = useActiveBrand()
  const [monthRows, setMonthRows] = useState<DailyMetricsRow[]>([])
  const [loading, setLoading] = useState(true)
  const [tableMissing, setTableMissing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const todayIso = toIsoDate(new Date())
  const monthStart = todayIso.slice(0, 8) + '01'

  const refresh = useCallback(async () => {
    if (!supabase || !user || !activeBrand) {
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error: err } = await supabase
      .from('daily_metrics')
      .select('*')
      .eq('user_id', user.id)
      .eq('brand_id', activeBrand.id)
      .gte('datum', monthStart)
      .order('datum', { ascending: true })

    if (err) {
      // Tabelle fehlt → Migration 0049 nicht ausgeführt.
      // Direkt-SQL: 42P01 · PostgREST: PGRST205 "Could not find the table … in the schema cache"
      const missing =
        err.code === '42P01' ||
        err.code === 'PGRST205' ||
        err.message.includes('does not exist') ||
        err.message.includes('Could not find the table')
      if (missing) {
        setTableMissing(true)
      } else {
        setError(err.message)
      }
      setMonthRows([])
    } else {
      setTableMissing(false)
      setError(null)
      setMonthRows((data as DailyMetricsRow[]) ?? [])
    }
    setLoading(false)
  }, [user, activeBrand, monthStart])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const today = useMemo(
    () => monthRows.find((r) => r.datum === todayIso) ?? emptyRow(todayIso),
    [monthRows, todayIso],
  )

  const weekRows = useMemo(() => {
    const monday = mondayOf(new Date())
    const mondayIso = toIsoDate(monday)
    return monthRows.filter((r) => r.datum >= mondayIso)
  }, [monthRows])

  const upsertToday = useCallback(
    async (patch: Partial<DailyMetricsRow>) => {
      if (!supabase || !user || !activeBrand) return
      const next = { ...today, ...patch }

      // Optimistisch in den Monats-Zeilen ersetzen/ergänzen
      setMonthRows((rows) => {
        const others = rows.filter((r) => r.datum !== todayIso)
        return [...others, next].sort((a, b) => a.datum.localeCompare(b.datum))
      })

      const { id: _id, ...payload } = next
      const { error: err } = await supabase.from('daily_metrics').upsert(
        { ...payload, user_id: user.id, brand_id: activeBrand.id },
        { onConflict: 'user_id,brand_id,datum' },
      )
      if (err) {
        setError(err.message)
        void refresh() // Server-Wahrheit wiederherstellen
      }
    },
    [today, todayIso, user, activeBrand, refresh],
  )

  const bump = useCallback(
    async (field: MetricField, delta: number) => {
      const value = Math.max(0, (today[field] ?? 0) + delta)
      await upsertToday({ [field]: value })
    },
    [today, upsertToday],
  )

  const setUmsatz = useCallback(
    async (value: number) => {
      await upsertToday({ umsatz: Math.max(0, value) })
    },
    [upsertToday],
  )

  return { monthRows, weekRows, today, loading, tableMissing, error, bump, setUmsatz, refresh }
}
