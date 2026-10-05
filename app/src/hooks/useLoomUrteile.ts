import { useCallback, useEffect, useState } from 'react'
import { isMissingSupabaseTableError } from '../lib/supabaseErrors'
import { supabase } from '../lib/supabase'
import { useBrandId } from './useBrandId'

/**
 * Kevins jüngstes Loom-Urteil je Lead (`lead_ereignisse.typ` = `loom_zugesagt` /
 * `loom_abgelehnt`, 03.10.2026).
 *
 * Dazu Kevins „Erledigt" an einer Antwort (`erledigtAt`), aus demselben Grund.
 *
 * Warum der Thread das nicht trägt: „Loom ja" schreibt nur das Ereignis. Der
 * Stern kommt allein aus LinkedIn, und das „Erledigt" setzt `last_from` lokal
 * auf `me` — der nächste Sync stellt es auf `them` zurück. Ohne dieses Urteil
 * stand der Lead danach wieder unter „Antworten".
 */
export const LOOM_URTEIL_EVENT = 'uriel:loom-urteil'

export interface LoomUrteil {
  /** `null` = Kevin hat zum Loom nichts entschieden (nur „Erledigt"). */
  zugesagt: boolean | null
  /** Zeitpunkt des Loom-Urteils (ms), 0 ohne Urteil. */
  at: number
  /**
   * „Erledigt" an einer Antwort (05.10.2026, `lead_ereignisse.typ` = `notiz`,
   * `details.art` = `antwort_erledigt`). Hält den Lead aus „Antworten", auch wenn
   * LinkedIn weiter „Lead hat zuletzt geschrieben" meldet, weil Kevin telefoniert
   * hat. Gilt, bis der Lead danach erneut schreibt.
   */
  erledigtAt?: number
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
        .select('lead_id, typ, at, details')
        .eq('brand_id', brandId)
        .in('typ', ['loom_zugesagt', 'loom_abgelehnt', 'notiz'])
        .order('id')
        .range(von, von + 999)
      if (error) {
        if (!isMissingSupabaseTableError(error.message)) console.warn('loom-urteile:', error.message)
        break
      }
      for (const z of (data ?? []) as { lead_id?: string; typ: string; at: string; details?: { art?: string } | null }[]) {
        const at = new Date(z.at).getTime()
        if (!z.lead_id || Number.isNaN(at)) continue
        const alt = karte.get(z.lead_id) ?? { zugesagt: null, at: 0 }
        if (z.typ === 'notiz') {
          if (z.details?.art === 'antwort_erledigt') karte.set(z.lead_id, { ...alt, erledigtAt: Math.max(alt.erledigtAt ?? 0, at) })
          continue
        }
        if (alt.zugesagt === null || at >= alt.at) karte.set(z.lead_id, { ...alt, zugesagt: z.typ === 'loom_zugesagt', at })
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
