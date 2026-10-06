import { useCallback, useEffect, useRef, useState } from 'react'
import { BRAND_UNAUFGELOEST, brandLage } from '../lib/datenFrische'
import { isMissingSupabaseTableError } from '../lib/supabaseErrors'
import { supabase } from '../lib/supabase'
import { useBrandIdStatus } from './useBrandId'
import { useNeuLadenWache } from './useNeuLadenWache'
import type { NetzwerkEintrag } from '../cockpit/lib/funnelStufen'

/**
 * Kevins LinkedIn-Netzwerk aus `linkedin_netzwerk` (Migration 0070).
 *
 * Gesendete Einladungen und angenommene Kontakte — die Grundlage für zwei der
 * fünf Funnel-Stufen. Geschrieben wird das ausschliesslich vom Runner
 * (`runner/linkedin/netzwerkUpsert.mjs`); die App liest nur.
 *
 * **`letzterVollerEinladungsLauf` ist das wichtigste Feld hier.** Es sagt, ob
 * die InMail-Kandidaten belastbar sind: nur wer im letzten vollständig
 * gelesenen Einladungs-Lauf noch zu sehen war, gilt als „hat nicht
 * angenommen". Abgeleitet wird es aus dem jüngsten `zuletzt_gesehen_at` der
 * offenen Einträge — ein vollständiger Lauf stempelt alle gleichzeitig, ein
 * abgebrochener lässt den Rest auf einem älteren Stand stehen. Liegt der
 * jüngste Stempel weit vor dem Rest, war der letzte Lauf unvollständig; genau
 * das drückt `unvollstaendig` aus.
 */
export interface UseLinkedinNetzwerkResult {
  items: NetzwerkEintrag[]
  loading: boolean
  tableMissing: boolean
  error: string | null
  /** ISO-Zeitpunkt des jüngsten Einladungs-Laufs, oder null. */
  letzterVollerEinladungsLauf: string | null
  /** Wie viele offene Einladungen diesen jüngsten Stempel tragen. */
  frischGesehen: number
  reload: () => Promise<void>
}

/** Der Merker, den `netzwerkUpsert.mjs` nach jedem vollständigen Lauf schreibt. */
const META_KEY = 'linkedin_netzwerk_meta'

interface NetzwerkMeta {
  einladungen?: { vollAt: string; gesamt: number | null; geerntet: number }
  kontakte?: { vollAt: string; gesamt: number | null; geerntet: number }
}

export function useLinkedinNetzwerk(brandSlug: string | undefined): UseLinkedinNetzwerkResult {
  const { brandId, pending: brandPending } = useBrandIdStatus(brandSlug)
  const [items, setItems] = useState<NetzwerkEintrag[]>([])
  const [meta, setMeta] = useState<NetzwerkMeta>({})
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
      // Wie bei Threads und Erstnachrichten (06.10.2026): Solange die Brands
      // laden, ist das Netzwerk unbekannt — nicht leer. Vorher stand hier
      // `setLoading(false)`, und die Erstnachrichten-Stufe sah „niemand wartet".
      setLoading(brandPending)
      setError(brandLage({ backend: !!supabase, brandId, brandPending }) === 'unaufgeloest' ? BRAND_UNAUFGELOEST : null)
      return
    }
    const lauf = ++lade.current.lauf
    lade.current.laeuft = true
    lade.current.letzterVersuchMs = Date.now()
    if (laut) setLoading(true)

    try {
      /**
       * Seitenweise laden — sonst fehlt der halbe Trichter.
       *
       * PostgREST deckelt eine Antwort bei 1.000 Zeilen. Kevins Netzwerk hat
       * mehr (630 Kontakte + 876 offene Einladungen), und das Limit greift
       * still: die App bekam eine plausible Liste, in der schlicht 500 Leute
       * fehlten — am 12.08. gemessen, die InMail-Kachel zeigte 370 statt 876.
       */
      const alle: NetzwerkEintrag[] = []
      const SEITE = 1000
      for (let von = 0; ; von += SEITE) {
        const { data, error: err } = await supabase
          .from('linkedin_netzwerk')
          .select('*')
          .eq('brand_id', brandId)
          .order('profil_key', { ascending: true })
          .range(von, von + SEITE - 1)

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
        const stapel = (data ?? []) as NetzwerkEintrag[]
        alle.push(...stapel)
        if (stapel.length < SEITE) break
      }

      setTableMissing(false)
      setError(null)
      setItems(alle)

      // Der Merker sagt, welchem Stand zu trauen ist. Fehlt er, gilt: noch kein
      // vollständiger Lauf — dann bleibt die InMail-Liste leer statt falsch.
      const { data: metaRow } = await supabase
        .from('runner_snapshots')
        .select('data')
        .eq('key', META_KEY)
        .maybeSingle()
      if (lauf !== lade.current.lauf) return
      setMeta(((metaRow as { data?: NetzwerkMeta } | null)?.data ?? {}) as NetzwerkMeta)

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

  // Eine Sekunde Luft nach hinten: der Lauf stempelt alle Zeilen gleich, aber
  // die Filter vergleichen mit `>=` und Zeitstempel runden unterschiedlich.
  const vollAt = meta.einladungen?.vollAt ?? null
  const grenze = vollAt ? new Date(new Date(vollAt).getTime() - 1000).toISOString() : null

  const frischGesehen = grenze
    ? items.filter(
        (e) => e.status === 'offen' && new Date(e.zuletzt_gesehen_at).getTime() >= new Date(grenze).getTime(),
      ).length
    : 0

  return {
    items,
    loading,
    tableMissing,
    error,
    letzterVollerEinladungsLauf: grenze,
    frischGesehen,
    reload,
  }
}
