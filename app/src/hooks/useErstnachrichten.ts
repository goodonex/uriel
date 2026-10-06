import { useCallback, useEffect, useRef, useState } from 'react'
import { entdoppleErstnachrichten } from '../cockpit/lib/erstnachrichtenDedup'
import { BRAND_UNAUFGELOEST, brandLage } from '../lib/datenFrische'
import { isMissingSupabaseTableError } from '../lib/supabaseErrors'
import { supabase } from '../lib/supabase'
import { protokolliereKevin } from '../lib/pruefProtokoll'
import { useBrandIdStatus } from './useBrandId'
import { useNeuLadenWache } from './useNeuLadenWache'

export interface Erstnachricht {
  id: string
  gruppe: string
  name: string
  firma: string
  website: string
  nachricht: string
  sort_index: number
  status: 'offen' | 'gesendet' | 'uebersprungen'
  sent_at: string | null
  /** Wann der Runner die Zeile zuletzt aus dem Vault gespiegelt hat (0060). */
  last_synced_at?: string | null
  /** 0076: Verweis auf den Lead. */
  lead_id?: string | null
  /** 0094: Wann Kevin den PRÜFEN-Hinweis selbst abgehakt hat (NULL = ungeprüft). */
  geprueft_at?: string | null
  /** 0095: Von Kevin eingetragene Website, der Mini bearbeitet den Lead damit neu (danach NULL). */
  pruef_url?: string | null
}

interface Result {
  items: Erstnachricht[]
  loading: boolean
  tableMissing: boolean
  error: string | null
  reload: () => Promise<void>
  setzeStatus: (id: string, status: Erstnachricht['status']) => Promise<void>
  /** Alles vor dieser Position als erledigt abhaken — für den einmaligen Einstieg. */
  alleDavorErledigen: (sortIndex: number) => Promise<void>
  /** Mehrere Zeilen auf einmal als verschickt verbuchen (Postfach-Abgleich, 17.08.). */
  erledigeViele: (ids: string[]) => Promise<void>
  /** Setzt den Prüf-Haken (0094): Der Text rückt damit in die Erstnachrichten-Stufe. */
  markiereGeprueft: (id: string) => Promise<void>
  /** Trägt Kevins URL ein (0095): Der Mini recherchiert den Lead damit neu und ersetzt den Text. */
  neuPruefen: (id: string, url: string) => Promise<boolean>
}

/** Versandfertige LinkedIn-Erstnachrichten aus dem Vault (Migration 0060). */
export function useErstnachrichten(brandSlug: string | undefined): Result {
  const { brandId, pending: brandPending } = useBrandIdStatus(brandSlug)
  const [items, setItems] = useState<Erstnachricht[]>([])
  const [loading, setLoading] = useState(true)
  const [tableMissing, setTableMissing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /** Wann zuletzt geladen wurde — für die Nachlade-Wache (06.10.2026, `lib/datenFrische.ts`). */
  const lade = useRef({ letzterErfolgMs: 0, letzterVersuchMs: 0, laeuft: false, lauf: 0 })

  /** `laut` = mit „…"-Zustand (erstes Laden, Brand-Wechsel). Die Wache lädt leise nach. */
  const laden = useCallback(async (laut: boolean) => {
    if (!supabase || !brandId) {
      lade.current.lauf++
      lade.current.laeuft = false
      setItems([])
      // Solange die Brand noch gesucht wird, ist die Liste nicht leer, sondern
      // unbekannt — sonst blitzt „Noch keine Erstnachrichten gespiegelt" auf.
      setLoading(brandPending)
      // Brands durch, aber keine Brand-ID: Lesefehler, kein Leerzustand (06.10.2026).
      setError(brandLage({ backend: !!supabase, brandId, brandPending }) === 'unaufgeloest' ? BRAND_UNAUFGELOEST : null)
      return
    }
    const lauf = ++lade.current.lauf
    lade.current.laeuft = true
    lade.current.letzterVersuchMs = Date.now()
    if (laut) setLoading(true)
    try {
      const { data, error: err } = await supabase
        .from('linkedin_erstnachrichten')
        .select('*')
        .eq('brand_id', brandId)
        .order('sort_index', { ascending: true })

      if (lauf !== lade.current.lauf) return
      if (err) {
        if (isMissingSupabaseTableError(err.message)) {
          setTableMissing(true)
          setItems([])
          setError(null)
        } else {
          setError(err.message)
        }
        setLoading(false)
        return
      }
      setTableMissing(false)
      setError(null)
      /**
       * Eine Person, eine Zeile. Vor 0071 lag der Schlüssel auf
       * `(brand_id, gruppe, name)` — eine umformulierte Gruppen-Überschrift im
       * Vault ließ den Spiegel die ganze Gruppe erneut anlegen (145 Zeilen für
       * 118 Leads, "144 offen"). Die Entdopplung hier hält die Liste auch mit
       * Altbestand ehrlich; die Regel ist dieselbe wie in der Migration.
       */
      setItems(entdoppleErstnachrichten((data ?? []) as Erstnachricht[]))
      setLoading(false)
      lade.current.letzterErfolgMs = Date.now()
    } catch (e) {
      if (lauf !== lade.current.lauf) return
      setError(e instanceof Error ? e.message : String(e))
      setLoading(false)
    } finally {
      if (lauf === lade.current.lauf) lade.current.laeuft = false
    }
  }, [brandId, brandPending])

  const reload = useCallback(() => laden(true), [laden])

  useEffect(() => {
    void reload()
  }, [reload])

  // Zurück im Tab, Netz wieder da, Anmeldung erneuert, neuer Sync-Stand: nachladen.
  useNeuLadenWache(
    () => void laden(false),
    () => ({ ...lade.current, hatFehler: error !== null }),
  )

  const setzeStatus = useCallback(
    async (id: string, status: Erstnachricht['status']) => {
      if (!supabase) return
      // Optimistisch: der Klick soll sich sofort anfühlen, auch übers Handy.
      setItems((cur) =>
        cur.map((i) =>
          i.id === id ? { ...i, status, sent_at: status === 'gesendet' ? new Date().toISOString() : null } : i,
        ),
      )
      const { error: err } = await supabase
        .from('linkedin_erstnachrichten')
        .update({ status, sent_at: status === 'gesendet' ? new Date().toISOString() : null })
        .eq('id', id)
      if (err) {
        setError(err.message)
        await reload()
      }
    },
    [reload],
  )

  const alleDavorErledigen = useCallback(
    async (sortIndex: number) => {
      if (!supabase || !brandId) return
      const { error: err } = await supabase
        .from('linkedin_erstnachrichten')
        .update({ status: 'gesendet', sent_at: new Date().toISOString() })
        .eq('brand_id', brandId)
        .lt('sort_index', sortIndex)
        .eq('status', 'offen')
      if (err) setError(err.message)
      await reload()
    },
    [brandId, reload],
  )

  /**
   * Der Postfach-Abgleich schreibt in einem Rutsch zurück: Wer nachweislich
   * einen Thread hat, ist verschickt. Kevin löst das per Klick aus — automatisch
   * geschriebene Statuszeilen wären nicht mehr zu unterscheiden von seinen.
   */
  const erledigeViele = useCallback(
    async (ids: string[]) => {
      if (!supabase || ids.length === 0) return
      const jetzt = new Date().toISOString()
      setItems((cur) =>
        cur.map((i) => (ids.includes(i.id) ? { ...i, status: 'gesendet' as const, sent_at: jetzt } : i)),
      )
      const { error: err } = await supabase
        .from('linkedin_erstnachrichten')
        .update({ status: 'gesendet', sent_at: jetzt })
        .in('id', ids)
      if (err) setError(err.message)
      await reload()
    },
    [reload],
  )

  const markiereGeprueft = useCallback(
    async (id: string) => {
      if (!supabase) return
      const jetzt = new Date().toISOString()
      const z = items.find((i) => i.id === id)
      if (z) protokolliereKevin(brandId, { art: 'erstnachricht_pruefen', name: z.name, firma: z.firma ?? '', entscheidung: 'geprueft', grund: String(z.firma ?? '').split('PRÜFEN:')[1]?.trim() ?? '', daten: { website: z.website } })
      setItems((cur) => cur.map((i) => (i.id === id ? { ...i, geprueft_at: jetzt } : i)))
      const { error: err } = await supabase.from('linkedin_erstnachrichten').update({ geprueft_at: jetzt }).eq('id', id)
      if (err) {
        setError(err.message)
        await reload()
      }
    },
    [reload, items, brandId],
  )

  const neuPruefen = useCallback(
    async (id: string, url: string) => {
      if (!supabase) return false
      const z = items.find((i) => i.id === id)
      if (z) protokolliereKevin(brandId, { art: 'erstnachricht_pruefen', name: z.name, firma: z.firma ?? '', entscheidung: 'andere_url', grund: url, daten: { vorher: z.website } })
      setItems((cur) => cur.map((i) => (i.id === id ? { ...i, pruef_url: url } : i)))
      const { error: err } = await supabase.from('linkedin_erstnachrichten').update({ pruef_url: url }).eq('id', id)
      if (err) {
        setError(err.message)
        await reload()
        return false
      }
      return true
    },
    [reload, items, brandId],
  )

  return { items, loading, tableMissing, error, reload, setzeStatus, alleDavorErledigen, erledigeViele, markiereGeprueft, neuPruefen }
}
