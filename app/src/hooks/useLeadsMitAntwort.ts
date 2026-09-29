import { useCallback, useEffect, useState } from 'react'
import { isMissingSupabaseTableError } from '../lib/supabaseErrors'
import { supabase } from '../lib/supabase'
import { useBrandId } from './useBrandId'

/**
 * Welche Leads schon einmal geantwortet haben (`lead_ereignisse.typ =
 * 'antwort_erhalten'`, 29.09.2026).
 *
 * Der Thread selbst weiß das oft nicht: Die LinkedIn-Übersicht liefert je
 * Gespräch nur die letzte Nachricht, und die ist beim Nachfassen Kevins eigene.
 * Die Lead-Kartei hat die Antwort dagegen verbucht. Valerius hatte im März
 * geschrieben, seine Seite werde überarbeitet — der Thread zeigte nur Kevins
 * Rückfrage, und das Cockpit schlug ihm die kalte Vorlage vor, die für Leute
 * gebaut ist, die nie geantwortet haben.
 *
 * Fehlt die Tabelle oder schlägt die Abfrage fehl, bleibt die Menge leer — dann
 * gilt wie bisher die Vorlage. Das ist die schwächere, aber sichtbare Richtung.
 */
export interface UseLeadsMitAntwortResult {
  /** `lead_id`s mit mindestens einem `antwort_erhalten`. */
  leadIds: ReadonlySet<string>
  loading: boolean
  reload: () => Promise<void>
}

export function useLeadsMitAntwort(brandSlug: string | undefined): UseLeadsMitAntwortResult {
  const brandId = useBrandId(brandSlug)
  const [leadIds, setLeadIds] = useState<ReadonlySet<string>>(() => new Set())
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!supabase || !brandId) {
      setLeadIds(new Set())
      setLoading(false)
      return
    }
    setLoading(true)
    const menge = new Set<string>()
    // Blättern: PostgREST deckelt bei 1000 Zeilen.
    for (let von = 0; von < 20_000; von += 1000) {
      const { data, error } = await supabase
        .from('lead_ereignisse')
        .select('lead_id')
        .eq('brand_id', brandId)
        .eq('typ', 'antwort_erhalten')
        .order('id')
        .range(von, von + 999)
      if (error) {
        if (!isMissingSupabaseTableError(error.message)) console.warn('antwort_erhalten:', error.message)
        break
      }
      for (const zeile of data ?? []) {
        const id = (zeile as { lead_id?: string }).lead_id
        if (id) menge.add(id)
      }
      if ((data ?? []).length < 1000) break
    }
    setLeadIds(menge)
    setLoading(false)
  }, [brandId])

  useEffect(() => {
    void reload()
  }, [reload])

  return { leadIds, loading, reload }
}
