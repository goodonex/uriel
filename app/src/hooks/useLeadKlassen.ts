import { useCallback, useEffect, useState } from 'react'
import { istLeadKlasse, type LeadKlassenInfo } from '../cockpit/lib/leadKlasse'
import { supabase } from '../lib/supabase'
import { useBrandId } from './useBrandId'

/**
 * Die Klassen A/B/C je Lead (Migration 0092), als Karte `lead_id → Klasse`.
 *
 * Eigener, schmaler Hook aus demselben Grund wie `useLoomGesichtet`: `usePosten`
 * hängt an jeder Arbeitsseite, und gebraucht werden drei Spalten der Leads mit
 * Klasse — kein Volllauf über alle Leads und Ereignisse.
 *
 * Fehlt die Spalte (Migration noch nicht eingespielt) oder scheitert die
 * Abfrage, bleibt die Karte leer: Dann gilt die bisherige Reihenfolge, und es
 * steht kein Badge da — nichts wird geraten.
 */
export interface UseLeadKlassenResult {
  klassen: ReadonlyMap<string, LeadKlassenInfo>
  loading: boolean
  reload: () => Promise<void>
}

export function useLeadKlassen(brandSlug: string | undefined): UseLeadKlassenResult {
  const brandId = useBrandId(brandSlug)
  const [klassen, setKlassen] = useState<ReadonlyMap<string, LeadKlassenInfo>>(() => new Map())
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!supabase || !brandId) {
      setKlassen(new Map())
      setLoading(false)
      return
    }
    setLoading(true)
    const karte = new Map<string, LeadKlassenInfo>()
    // Blättern: PostgREST deckelt bei 1000 Zeilen.
    for (let von = 0; von < 20_000; von += 1000) {
      const { data, error } = await supabase
        .from('leads')
        .select('id,klasse,klasse_grund')
        .eq('brand_id', brandId)
        .not('klasse', 'is', null)
        .range(von, von + 999)
      if (error) {
        console.warn('lead-klassen:', error.message)
        break
      }
      for (const z of (data ?? []) as { id: string; klasse: unknown; klasse_grund: string | null }[]) {
        if (istLeadKlasse(z.klasse)) karte.set(z.id, { klasse: z.klasse, grund: z.klasse_grund ?? '' })
      }
      if ((data ?? []).length < 1000) break
    }
    setKlassen(karte)
    setLoading(false)
  }, [brandId])

  useEffect(() => {
    void reload()
  }, [reload])

  return { klassen, loading, reload }
}
