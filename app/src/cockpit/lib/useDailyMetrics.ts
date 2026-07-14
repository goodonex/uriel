import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { useActiveBrand } from './activeBrand'

/** Eine Tageszeile aus daily_metrics (Migration 0049). */
export interface DailyMetricsRow {
  id?: string
  datum: string // YYYY-MM-DD
  li_anfragen: number
  li_nachrichten: number
  inmails: number
  looms: number
  ig_anfragen: number
  ig_nachrichten: number
  cold_calls: number
  coldmails: number
  followups: number
  antworten_li: number
  antworten_inmail: number
  antworten_ig: number
  antworten_cold: number
  quali_termine: number
  sales_calls: number
  termine_vereinbart: number
  abschluesse: number
  umsatz: number
  note?: string | null
}

export const METRIC_FIELDS = [
  'li_anfragen',
  'li_nachrichten',
  'inmails',
  'looms',
  'ig_anfragen',
  'ig_nachrichten',
  'cold_calls',
  'coldmails',
  'followups',
  'antworten_li',
  'antworten_inmail',
  'antworten_ig',
  'antworten_cold',
  'quali_termine',
  'sales_calls',
  'termine_vereinbart',
  'abschluesse',
] as const
export type MetricField = (typeof METRIC_FIELDS)[number]

export function emptyRow(datum: string): DailyMetricsRow {
  return {
    datum,
    li_anfragen: 0,
    li_nachrichten: 0,
    inmails: 0,
    looms: 0,
    ig_anfragen: 0,
    ig_nachrichten: 0,
    cold_calls: 0,
    coldmails: 0,
    followups: 0,
    antworten_li: 0,
    antworten_inmail: 0,
    antworten_ig: 0,
    antworten_cold: 0,
    quali_termine: 0,
    sales_calls: 0,
    termine_vereinbart: 0,
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
  /** frühestes Datum, das rückwirkend eingetragen werden kann (Ladefenster-Start) */
  windowStart: string
  /** Zeile eines beliebigen Tages (leer, wenn nichts eingetragen) */
  rowFor: (datum: string) => DailyMetricsRow
  /** Feld der HEUTIGEN Zeile ändern (optimistisch, race-sicher, gebündelt gespeichert) */
  bump: (field: MetricField, delta: number) => void
  /** Umsatz der HEUTIGEN Zeile setzen */
  setUmsatz: (value: number) => void
  /** Feld eines BELIEBIGEN Tages ändern (rückwirkendes Tracking) */
  bumpOn: (datum: string, field: MetricField, delta: number) => void
  /** Umsatz eines BELIEBIGEN Tages setzen */
  setUmsatzOn: (datum: string, value: number) => void
  refresh: () => Promise<void>
}

/**
 * Echte daily_metrics aus Supabase (ersetzt useVitalsMock ab Phase 3).
 * Lädt ein ~45-Tage-Fenster (für rückwirkendes Eintragen), schreibt per Upsert
 * auf (user, brand, datum). Bumps laufen über eine synchrone Ref-Kopie +
 * gebündelten (debounced) Upsert — so gehen schnelle Klicks nicht verloren
 * (kein Stale-Closure-Race) und out-of-order-Writes können sich nicht
 * gegenseitig überschreiben.
 */
export function useDailyMetrics(): UseDailyMetricsResult {
  const { user } = useAuth()
  const { activeBrand } = useActiveBrand()
  const [allRows, setAllRows] = useState<DailyMetricsRow[]>([])
  const [loading, setLoading] = useState(true)
  const [tableMissing, setTableMissing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const todayIso = toIsoDate(new Date())
  const monthStart = todayIso.slice(0, 8) + '01'
  // Ladefenster ~45 Tage zurück → rückwirkendes Eintragen (auch über die
  // Monatsgrenze) funktioniert. Aggregate filtern davon wieder auf Monat/Woche.
  const windowStart = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - 45)
    return toIsoDate(d)
  }, [todayIso])

  // Autoritative, SYNCHRON aktualisierte Kopie — Bumps lesen daraus statt aus
  // dem Render-Closure, damit schnelle Mehrfachklicks korrekt akkumulieren.
  const rowsRef = useRef<DailyMetricsRow[]>([])
  const userRef = useRef(user)
  userRef.current = user
  const brandRef = useRef(activeBrand)
  brandRef.current = activeBrand
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const applyRows = useCallback((rows: DailyMetricsRow[]) => {
    rowsRef.current = rows
    setAllRows(rows)
  }, [])

  const refresh = useCallback(async () => {
    const u = userRef.current
    const b = brandRef.current
    if (!supabase || !u || !b) {
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error: err } = await supabase
      .from('daily_metrics')
      .select('*')
      .eq('user_id', u.id)
      .eq('brand_id', b.id)
      .gte('datum', windowStart)
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
      applyRows([])
    } else {
      setTableMissing(false)
      setError(null)
      applyRows((data as DailyMetricsRow[]) ?? [])
    }
    setLoading(false)
  }, [windowStart, applyRows])

  useEffect(() => {
    void refresh()
  }, [refresh, user?.id, activeBrand?.id])

  // Einen Tag zur Server-Wahrheit schreiben (liest den frischen Ref-Stand).
  const persist = useCallback(
    async (datum: string) => {
      const u = userRef.current
      const b = brandRef.current
      if (!supabase || !u || !b) return
      const row = rowsRef.current.find((r) => r.datum === datum)
      if (!row) return
      const { id: _id, ...payload } = row
      const { error: err } = await supabase.from('daily_metrics').upsert(
        { ...payload, user_id: u.id, brand_id: b.id },
        { onConflict: 'user_id,brand_id,datum' },
      )
      if (err) {
        setError(err.message)
        void refresh() // Server-Wahrheit wiederherstellen
      } else {
        setError(null)
      }
    },
    [refresh],
  )

  // Bündelt schnelle Klicks pro Tag zu einem Write des Endstands (350ms).
  const schedulePersist = useCallback(
    (datum: string) => {
      const timers = timersRef.current
      const existing = timers.get(datum)
      if (existing) clearTimeout(existing)
      timers.set(
        datum,
        setTimeout(() => {
          timers.delete(datum)
          void persist(datum)
        }, 350),
      )
    },
    [persist],
  )

  const mutate = useCallback(
    (datum: string, patch: Partial<DailyMetricsRow>) => {
      const b = brandRef.current
      // Nicht mit Fallback-Brand schreiben (keine echte UUID) → Insert schlüge fehl.
      if (b && b.id.startsWith('local-fallback-')) {
        setError('Brand lädt noch — bitte 1–2 Sekunden warten und erneut tracken.')
        return
      }
      const cur = rowsRef.current.find((r) => r.datum === datum) ?? emptyRow(datum)
      const next = { ...cur, ...patch }
      const others = rowsRef.current.filter((r) => r.datum !== datum)
      applyRows([...others, next].sort((a, c) => a.datum.localeCompare(c.datum)))
      schedulePersist(datum)
    },
    [applyRows, schedulePersist],
  )

  // Ausstehende Writes beim Verlassen sofort rausschicken (kein Datenverlust).
  useEffect(() => {
    const timers = timersRef.current
    return () => {
      timers.forEach((t, datum) => {
        clearTimeout(t)
        void persist(datum)
      })
      timers.clear()
    }
  }, [persist])

  const rowFor = useCallback(
    (datum: string) => allRows.find((r) => r.datum === datum) ?? emptyRow(datum),
    [allRows],
  )

  const monthRows = useMemo(
    () => allRows.filter((r) => r.datum >= monthStart),
    [allRows, monthStart],
  )

  const today = useMemo(() => rowFor(todayIso), [rowFor, todayIso])

  const weekRows = useMemo(() => {
    const mondayIso = toIsoDate(mondayOf(new Date()))
    return monthRows.filter((r) => r.datum >= mondayIso)
  }, [monthRows])

  const bumpOn = useCallback(
    (datum: string, field: MetricField, delta: number) => {
      const cur = rowsRef.current.find((r) => r.datum === datum) ?? emptyRow(datum)
      mutate(datum, { [field]: Math.max(0, (cur[field] ?? 0) + delta) })
    },
    [mutate],
  )

  const setUmsatzOn = useCallback(
    (datum: string, value: number) => {
      mutate(datum, { umsatz: Math.max(0, value) })
    },
    [mutate],
  )

  const bump = useCallback(
    (field: MetricField, delta: number) => bumpOn(todayIso, field, delta),
    [bumpOn, todayIso],
  )

  const setUmsatz = useCallback((value: number) => setUmsatzOn(todayIso, value), [setUmsatzOn, todayIso])

  return {
    monthRows,
    weekRows,
    today,
    loading,
    tableMissing,
    error,
    windowStart,
    rowFor,
    bump,
    setUmsatz,
    bumpOn,
    setUmsatzOn,
    refresh,
  }
}
