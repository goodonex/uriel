import { useCallback, useEffect, useState } from 'react'
import { isMissingSupabaseTableError } from '../lib/supabaseErrors'
import { supabase } from '../lib/supabase'
import { useBrandId } from './useBrandId'

/**
 * Kevins jüngstes Loom-Urteil je Lead (`lead_ereignisse.typ` = `loom_zugesagt` /
 * `loom_abgelehnt`, 03.10.2026).
 *
 * Warum der Thread das nicht trägt: „Loom ja" schreibt nur das Ereignis. Der
 * Stern kommt allein aus LinkedIn, und das „Erledigt" setzt `last_from` lokal
 * auf `me` — der nächste Sync stellt es auf `them` zurück. Ohne dieses Urteil
 * stand der Lead danach wieder unter „Antworten".
 */
export const LOOM_URTEIL_EVENT = 'uriel:loom-urteil'

export interface LoomUrteil {
  zugesagt: boolean
  /** Zeitpunkt des Urteils (ms). */
  at: number
}

export interface UseLoomUrteileResult {
  /** `lead_id` → jüngstes Urteil. */
  urteile: ReadonlyMap<string, LoomUrteil>
  reload: () => Promise<void>
}

export function useLoomUrteile(brandSlug: string | undefined): UseLoomUrteileResult {
  const brandId = useBrandId(brandSlug)
  const [urteile, setUrteile] = useState<ReadonlyMap<string, LoomUrteil>>(() => new Map())

  const reload = useCallback(async () => {
    if (!supabase || !brandId) {
      setUrteile(new Map())
      return
    }
    const karte = new Map<string, LoomUrteil>()
    for (let von = 0; von < 20_000; von += 1000) {
      const { data, error } = await supabase
        .from('lead_ereignisse')
        .select('lead_id, typ, at')
        .eq('brand_id', brandId)
        .in('typ', ['loom_zugesagt', 'loom_abgelehnt'])
        .order('id')
        .range(von, von + 999)
      if (error) {
        if (!isMissingSupabaseTableError(error.message)) console.warn('loom-urteile:', error.message)
        break
      }
      for (const z of (data ?? []) as { lead_id?: string; typ: string; at: string }[]) {
        const at = new Date(z.at).getTime()
        if (!z.lead_id || Number.isNaN(at)) continue
        const alt = karte.get(z.lead_id)
        if (!alt || at >= alt.at) karte.set(z.lead_id, { zugesagt: z.typ === 'loom_zugesagt', at })
      }
      if ((data ?? []).length < 1000) break
    }
    setUrteile(karte)
  }, [brandId])

  useEffect(() => {
    void reload()
    // „Loom ja/nein" feuert das Ereignis; jede Instanz (Liste, Tages-Flow,
    // Ambient-Zähler) lädt dann neu, statt bis zum Seitenwechsel zu veralten.
    const neu = () => void reload()
    window.addEventListener(LOOM_URTEIL_EVENT, neu)
    return () => window.removeEventListener(LOOM_URTEIL_EVENT, neu)
  }, [reload])

  return { urteile, reload }
}
