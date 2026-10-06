import { useCallback, useEffect, useState } from 'react'
import type { Anfrage, AnfrageStatus } from '../cockpit/lib/anfragenAnDich'
import { isMissingSupabaseTableError } from '../lib/supabaseErrors'
import { supabase } from '../lib/supabase'
import { useBrandIdStatus } from './useBrandId'

interface Result {
  items: Anfrage[]
  loading: boolean
  tableMissing: boolean
  error: string | null
  reload: () => Promise<void>
  setzeStatus: (id: string, status: AnfrageStatus) => Promise<void>
}

const SPALTEN =
  'id,profil_key,name,headline,profile_url,notiz,gemeinsame,eingegangen_at,nicht_mehr_da_at,icp_urteil,icp_grund,' +
  'ausgeblendet_grund,firma,website,entwurf,entwurf_at,entwurf_versuche,status,status_at'

/**
 * Anfragen an Kevin aus `linkedin_anfragen` (Migration 0098), angelegt vom Runner.
 *
 * Geladen werden die offenen und alles, was Kevin seit gestern erledigt hat —
 * Letzteres nur für die erste Zahl der Zeile („2 von 3"). Ein Fehler bleibt
 * ein Fehler (`error`), nie eine leere Liste: Die Zeile zeigt dann „nicht
 * geladen" statt eines grünen Hakens.
 */
export function useEingehendeAnfragen(brandSlug: string | undefined): Result {
  const { brandId, pending: brandPending } = useBrandIdStatus(brandSlug)
  const [items, setItems] = useState<Anfrage[]>([])
  const [loading, setLoading] = useState(true)
  const [tableMissing, setTableMissing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!supabase || !brandId) {
      setItems([])
      setLoading(brandPending)
      if (!supabase) setError('Keine Verbindung zur Datenbank')
      return
    }
    setLoading(true)
    const seit = new Date(Date.now() - 36 * 3_600_000).toISOString()
    const { data, error: err } = await supabase
      .from('linkedin_anfragen')
      .select(SPALTEN)
      .eq('brand_id', brandId)
      .or(`status.eq.offen,status_at.gte."${seit}"`)
      .order('eingegangen_at', { ascending: false })
      .limit(500)
    if (err) {
      if (isMissingSupabaseTableError(err.message)) {
        setTableMissing(true)
        setError(null)
      } else {
        setTableMissing(false)
        setError(err.message)
      }
      setItems([])
      setLoading(false)
      return
    }
    setTableMissing(false)
    setError(null)
    setItems((data ?? []) as unknown as Anfrage[])
    setLoading(false)
  }, [brandId, brandPending])

  useEffect(() => {
    void reload()
  }, [reload])

  const setzeStatus = useCallback(
    async (id: string, status: AnfrageStatus) => {
      if (!supabase) return
      const jetzt = new Date().toISOString()
      // Optimistisch: der Klick soll sich sofort anfühlen, auch übers Handy.
      setItems((cur) => cur.map((a) => (a.id === id ? { ...a, status, status_at: status === 'offen' ? null : jetzt } : a)))
      const { error: err } = await supabase
        .from('linkedin_anfragen')
        .update({ status, status_at: status === 'offen' ? null : jetzt })
        .eq('id', id)
      if (err) {
        setError(err.message)
        await reload()
      }
    },
    [reload],
  )

  return { items, loading, tableMissing, error, reload, setzeStatus }
}
