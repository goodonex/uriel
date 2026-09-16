import { useCallback, useEffect, useState } from 'react'
import { isMissingSupabaseTableError } from '../lib/supabaseErrors'
import { supabase } from '../lib/supabase'
import { useBrandId } from './useBrandId'

/**
 * Welche Leads ihr Loom nachweislich angesehen haben (Migration 0079).
 *
 * Der Loom-Player meldet sich per `sendBeacon` selbst zurück und schreibt ein
 * `loom_angesehen` in `lead_ereignisse`. Diese Menge entscheidet über zwei
 * Dinge im Nachfassen: den Takt (`kadenz.loomGesichtetTage`, enger als bloß
 * verschickt) und den Text (`LOOM_GESICHTET_VORLAGE` statt „liegt noch im
 * Chat" — eine Nachricht, die das Gegenteil behauptet, verrät sofort, dass
 * niemand hinschaut).
 *
 * **Bewusst ein eigener Hook und nicht `useLeads`.** Der lädt alle Leads UND
 * alle Ereignisse; gebraucht wird hier eine einzige Spalte eines einzigen
 * Ereignistyps. `usePosten` hängt an jeder Seite, auf der gearbeitet wird —
 * das ist der falsche Ort für einen Volllauf.
 *
 * Fehlt die Tabelle oder schlägt die Abfrage fehl, bleibt die Menge leer. Das
 * ist die richtige Richtung: Ein fehlender Beleg darf nie so wirken, als hätte
 * jemand NICHT geschaut — im Zweifel gilt der ruhigere Takt.
 */
export interface UseLoomGesichtetResult {
  /** `lead_id`s mit mindestens einem `loom_angesehen`. */
  leadIds: ReadonlySet<string>
  loading: boolean
  reload: () => Promise<void>
}

export function useLoomGesichtet(brandSlug: string | undefined): UseLoomGesichtetResult {
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
    const { data, error } = await supabase
      .from('lead_ereignisse')
      .select('lead_id')
      .eq('brand_id', brandId)
      .eq('typ', 'loom_angesehen')
    setLoading(false)
    if (error) {
      // Auch eine fehlende Tabelle ist hier kein Fehlerzustand, sondern
      // schlicht „nichts bekannt" — die Oberfläche zeigt deshalb nichts an.
      if (!isMissingSupabaseTableError(error.message)) console.warn('loom_angesehen:', error.message)
      setLeadIds(new Set())
      return
    }
    const menge = new Set<string>()
    for (const zeile of data ?? []) {
      const id = (zeile as { lead_id?: string }).lead_id
      if (id) menge.add(id)
    }
    setLeadIds(menge)
  }, [brandId])

  useEffect(() => {
    void reload()
  }, [reload])

  return { leadIds, loading, reload }
}
