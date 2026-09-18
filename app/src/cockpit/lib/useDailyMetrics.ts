import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { useActiveBrand } from './activeBrand'
import type { MetricField } from './metrikFelder'
import { toIsoDate, weekRowsOf } from './metricsDates'
import { useMetrikTag } from './useMetrikTag'

/**
 * Eine Tageszeile aus daily_metrics (Migration 0049).
 *
 * Etappe 4, Schritt 2c: die vier herkunftslosen Sammelfelder `coldmails`,
 * `followups`, `antworten_cold` und `termine_vereinbart` sind raus. Seit 0053/0055
 * wird je Kanal gezählt (li_/ig_/call_), und die Sammelspalten wurden nur noch
 * mit Nullen beschrieben — kein Leser im ganzen Code, kein Eintrag in QuickTrack
 * oder TrackingArea. Die Spalten selbst bleiben bis zur Migration 0066 stehen
 * (`not null default 0`), der Upsert lässt sie ab jetzt einfach aus.
 */
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
  // Follow-ups je Kanal (0055)
  li_followups: number
  ig_followups: number
  call_followups: number
  /** 0081: von Kevin ABGEARBEITETE Antworten — nicht die erhaltenen (`antworten_li`). */
  antworten_erledigt: number
  antworten_li: number
  antworten_inmail: number
  antworten_ig: number
  quali_termine: number
  sales_calls: number
  // Termine mit Kanal-Herkunft (0055)
  termine_li: number
  termine_ig: number
  termine_call: number
  abschluesse: number
  umsatz: number
  note?: string | null
}

// Feldnamen + Beschriftungen liegen in metrikFelder.ts (Blatt-Modul ohne React),
// damit urielTools.ts und scripts/verify-*.ts sie ohne den Hook laden können.
// Re-Export hält alle bestehenden Import-Pfade gültig.
export { METRIC_FIELDS, METRIK_LABEL, istMetrikFeld } from './metrikFelder'
export type { MetricField } from './metrikFelder'

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
    li_followups: 0,
    ig_followups: 0,
    call_followups: 0,
    antworten_erledigt: 0,
    antworten_li: 0,
    antworten_inmail: 0,
    antworten_ig: 0,
    quali_termine: 0,
    sales_calls: 0,
    termine_li: 0,
    termine_ig: 0,
    termine_call: 0,
    abschluesse: 0,
    umsatz: 0,
  }
}

// Datums-/Wochenlogik liegt in metricsDates.ts (Blatt-Modul ohne React), damit
// scripts/verify-*.ts sie ohne Vite-Umgebung laden kann. Re-Export hält alle
// bestehenden Import-Pfade gültig.
export { mondayOf, toIsoDate, weekRowsOf } from './metricsDates'

interface UseDailyMetricsResult {
  /** alle Zeilen des laufenden Monats (aufsteigend nach Datum) */
  monthRows: DailyMetricsRow[]
  /** Zeilen der laufenden Woche (Mo–So) */
  weekRows: DailyMetricsRow[]
  /** ALLE geladenen Zeilen (~45-Tage-Fenster) — Quelle für Verlaufs-Sparklines */
  windowRows: DailyMetricsRow[]
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
  refresh: (opts?: { leise?: boolean }) => Promise<void>
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

  // Der laufende Metrik-Tag als Zustand (useMetrikTag): Um 0:00 wechselt er von
  // selbst, ohne Reload — vorher hing ein über Nacht offener Tab auf gestern.
  const todayIso = useMetrikTag()
  const monthStart = todayIso.slice(0, 8) + '01'
  // Ladefenster ~45 Tage zurück → rückwirkendes Eintragen (auch über die
  // Monatsgrenze) funktioniert. Aggregate filtern davon wieder auf Monat/Woche.
  const windowStart = useMemo(() => {
    const d = new Date(`${todayIso}T12:00:00`)
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
  // Was noch zur Datenbank muss — als Änderung, nicht als Endstand (siehe persist).
  const pendingRef = useRef<Map<string, { deltas: Partial<Record<MetricField, number>>; umsatz?: number }>>(new Map())

  const applyRows = useCallback((rows: DailyMetricsRow[]) => {
    rowsRef.current = rows
    setAllRows(rows)
  }, [])

  const refresh = useCallback(async ({ leise = false }: { leise?: boolean } = {}) => {
    const u = userRef.current
    const b = brandRef.current
    if (!supabase || !u || !b) {
      setLoading(false)
      return
    }
    if (!leise) setLoading(true)
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
    } else if (leise && (timersRef.current.size > 0 || pendingRef.current.size > 0)) {
      // Während des Abgleichs wurde getrackt — der nächste Takt holt es nach.
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

  // Transiente Fehler (Auth-Lock/Token/Netz) sind KEINE echten Schreibfehler:
  // GoTrue „stiehlt" beim Token-Refresh bzw. über mehrere Tabs kurz den
  // Navigator-Lock → NavigatorLockAcquireTimeoutError schlägt bis in den Upsert
  // durch. Per Design retrybar. Bei sowas NICHT die Eingabe verwerfen.
  const isTransientWriteError = (msg: string, name?: string): boolean => {
    const m = `${msg} ${name ?? ''}`.toLowerCase()
    return (
      m.includes('stole') || // „…released because another request stole it"
      m.includes('lock') ||
      m.includes('abort') ||
      m.includes('jwt') ||
      m.includes('token') ||
      m.includes('refresh') ||
      m.includes('fetch') || // „Failed to fetch"
      m.includes('network') ||
      m.includes('timeout')
    )
  }

  /**
   * Was noch zur Datenbank muss — als ÄNDERUNG, nicht als Endstand (18.09.2026).
   *
   * Bis heute schrieb jeder Klick die ganze Tageszeile aus dem Gerätespeicher.
   * Kevin trackte am Handy 40 Anfragen, eine halbe Stunde später schrieb der
   * Laptop seine Zeile mit `li_anfragen: 0` aus dem alten Ladestand — und die
   * 40 waren weg. Jetzt geht nur das Delta raus (`daily_metric_bump`, Migration
   * 0089), die Datenbank rechnet. Zwei Geräte können sich nicht mehr löschen.
   */

  const offen = (datum: string) => {
    const p = pendingRef.current.get(datum)
    return !!p && (p.umsatz !== undefined || Object.values(p.deltas).some((d) => d))
  }

  /** Server-Zeile übernehmen — aber nur, wenn lokal nichts mehr unterwegs ist. */
  const uebernimm = useCallback(
    (serverRow: DailyMetricsRow) => {
      if (offen(serverRow.datum) || timersRef.current.has(serverRow.datum)) return
      const others = rowsRef.current.filter((r) => r.datum !== serverRow.datum)
      applyRows([...others, serverRow].sort((a, c) => a.datum.localeCompare(c.datum)))
    },
    [applyRows],
  )

  const persistRef = useRef<(datum: string) => Promise<void>>(async () => {})
  const persist = useCallback(
    async (datum: string) => {
      const u = userRef.current
      const b = brandRef.current
      if (!supabase || !u || !b) return
      const arbeit = pendingRef.current.get(datum)
      if (!arbeit) return
      pendingRef.current.delete(datum)

      const zurueckstellen = (rest: { deltas: Partial<Record<MetricField, number>>; umsatz?: number }) => {
        const jetzt = pendingRef.current.get(datum) ?? { deltas: {} }
        for (const [f, d] of Object.entries(rest.deltas) as [MetricField, number][]) {
          jetzt.deltas[f] = (jetzt.deltas[f] ?? 0) + d
        }
        if (rest.umsatz !== undefined && jetzt.umsatz === undefined) jetzt.umsatz = rest.umsatz
        pendingRef.current.set(datum, jetzt)
      }

      const rest = { deltas: { ...arbeit.deltas }, umsatz: arbeit.umsatz }
      let letzteZeile: DailyMetricsRow | null = null
      const delays = [0, 350, 900, 1800] // 1 Versuch + 3 Retries
      for (let attempt = 0; attempt < delays.length; attempt++) {
        if (delays[attempt] > 0) await new Promise((r) => setTimeout(r, delays[attempt]))
        let fehler: { message: string; name?: string } | null = null

        for (const [field, delta] of Object.entries(rest.deltas) as [MetricField, number][]) {
          if (!delta) {
            delete rest.deltas[field]
            continue
          }
          const { data, error: err } = await supabase.rpc('daily_metric_bump', {
            p_brand: b.id,
            p_datum: datum,
            p_field: field,
            p_delta: delta,
          })
          if (err) {
            fehler = err
            break
          }
          delete rest.deltas[field]
          letzteZeile = data as DailyMetricsRow
        }

        if (!fehler && rest.umsatz !== undefined) {
          // Nur die eine Spalte — ein Upsert mit Teilzeile lässt die übrigen stehen.
          const { data, error: err } = await supabase
            .from('daily_metrics')
            .upsert({ user_id: u.id, brand_id: b.id, datum, umsatz: rest.umsatz }, { onConflict: 'user_id,brand_id,datum' })
            .select()
            .single()
          if (err) fehler = err
          else {
            rest.umsatz = undefined
            letzteZeile = data as DailyMetricsRow
          }
        }

        if (!fehler) {
          setError(null)
          if (letzteZeile) uebernimm(letzteZeile)
          return
        }
        if (!isTransientWriteError(fehler.message, fehler.name)) {
          // Echter DB-Fehler (fehlende Funktion/RLS) → sichtbar machen und mit
          // Server-Wahrheit abgleichen. NUR hier wird die Eingabe verworfen.
          setError(fehler.message)
          void refresh()
          return
        }
        if (/jwt|token|refresh/i.test(fehler.message)) {
          try {
            await supabase.auth.refreshSession()
          } catch {
            /* egal — der nächste Versuch zieht die frische Session */
          }
        }
      }

      // Retries erschöpft: Eingabe bleibt erhalten und wird später nachgezogen.
      zurueckstellen(rest)
      setError('Speichern hakt kurz (Verbindung/Session) — dein Eintrag bleibt erhalten und wird automatisch nachgezogen.')
      setTimeout(() => void persistRef.current(datum), 4000)
    },
    [refresh, uebernimm],
  )
  persistRef.current = persist

  // Bündelt schnelle Klicks pro Tag zu einem Write (350ms).
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

  const lokalAendern = useCallback(
    (datum: string, patch: Partial<DailyMetricsRow>): boolean => {
      const b = brandRef.current
      // Nicht mit Fallback-Brand schreiben (keine echte UUID) → Insert schlüge fehl.
      if (b && b.id.startsWith('local-fallback-')) {
        setError('Brand lädt noch — bitte 1–2 Sekunden warten und erneut tracken.')
        return false
      }
      const cur = rowsRef.current.find((r) => r.datum === datum) ?? emptyRow(datum)
      const next = { ...cur, ...patch }
      const others = rowsRef.current.filter((r) => r.datum !== datum)
      applyRows([...others, next].sort((a, c) => a.datum.localeCompare(c.datum)))
      return true
    },
    [applyRows],
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

  /**
   * Live nachziehen, was das andere Gerät getrackt hat: beim Zurückkehren in
   * den Tab sofort, solange er sichtbar ist alle 30 Sekunden. Läuft lokal noch
   * ein Write, wartet der Abgleich — sonst blinkte der Zähler kurz zurück.
   */
  useEffect(() => {
    const nachziehen = () => {
      if (document.visibilityState !== 'visible') return
      if (timersRef.current.size > 0 || pendingRef.current.size > 0) return
      void refresh({ leise: true })
    }
    document.addEventListener('visibilitychange', nachziehen)
    window.addEventListener('focus', nachziehen)
    const takt = setInterval(nachziehen, 30_000)
    return () => {
      document.removeEventListener('visibilitychange', nachziehen)
      window.removeEventListener('focus', nachziehen)
      clearInterval(takt)
    }
  }, [refresh])

  const rowFor = useCallback(
    (datum: string) => allRows.find((r) => r.datum === datum) ?? emptyRow(datum),
    [allRows],
  )

  const monthRows = useMemo(
    () => allRows.filter((r) => r.datum >= monthStart),
    [allRows, monthStart],
  )

  const today = useMemo(() => rowFor(todayIso), [rowFor, todayIso])

  // Aus allRows (45-Tage-Fenster), NICHT aus monthRows — sonst bricht die
  // laufende Woche an jedem Monatsersten weg (siehe weekRowsOf). `todayIso`
  // wird bewusst durchgereicht, damit die Woche beim Tageswechsel nachzieht.
  const weekRows = useMemo(
    () => weekRowsOf(allRows, new Date(`${todayIso}T12:00:00`)),
    [allRows, todayIso],
  )

  const bumpOn = useCallback(
    (datum: string, field: MetricField, delta: number) => {
      const cur = rowsRef.current.find((r) => r.datum === datum) ?? emptyRow(datum)
      const alt = cur[field] ?? 0
      const neu = Math.max(0, alt + delta)
      if (neu === alt) return
      if (!lokalAendern(datum, { [field]: neu })) return
      const p = pendingRef.current.get(datum) ?? { deltas: {} }
      p.deltas[field] = (p.deltas[field] ?? 0) + (neu - alt)
      pendingRef.current.set(datum, p)
      schedulePersist(datum)
    },
    [lokalAendern, schedulePersist],
  )

  const setUmsatzOn = useCallback(
    (datum: string, value: number) => {
      const umsatz = Math.max(0, value)
      if (!lokalAendern(datum, { umsatz })) return
      const p = pendingRef.current.get(datum) ?? { deltas: {} }
      p.umsatz = umsatz
      pendingRef.current.set(datum, p)
      schedulePersist(datum)
    },
    [lokalAendern, schedulePersist],
  )

  const bump = useCallback(
    (field: MetricField, delta: number) => bumpOn(todayIso, field, delta),
    [bumpOn, todayIso],
  )

  const setUmsatz = useCallback((value: number) => setUmsatzOn(todayIso, value), [setUmsatzOn, todayIso])

  return {
    monthRows,
    weekRows,
    windowRows: allRows,
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
