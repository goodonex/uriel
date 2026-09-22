import { useCallback, useEffect, useState } from 'react'
import type { EntscheiderKandidat, EntscheiderStatus } from '../cockpit/lib/entscheider'
import { isMissingSupabaseTableError } from '../lib/supabaseErrors'
import { supabase } from '../lib/supabase'
import { useBrandIdStatus } from './useBrandId'

interface Result {
  items: EntscheiderKandidat[]
  loading: boolean
  tableMissing: boolean
  error: string | null
  reload: () => Promise<void>
  setzeStatus: (id: string, status: EntscheiderStatus) => Promise<void>
}

/** GF-Kandidaten aus dem Impressum (Migration 0091), angelegt vom Runner. */
export function useEntscheiderKandidaten(brandSlug: string | undefined): Result {
  const { brandId, pending: brandPending } = useBrandIdStatus(brandSlug)
  const [items, setItems] = useState<EntscheiderKandidat[]>([])
  const [loading, setLoading] = useState(true)
  const [tableMissing, setTableMissing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!supabase || !brandId) {
      setItems([])
      setLoading(brandPending)
      return
    }
    setLoading(true)
    const { data, error: err } = await supabase
      .from('entscheider_kandidaten')
      .select('id,gf_name,firma,website,quelle_name,grund,linkedin_url,status,status_at,created_at')
      .eq('brand_id', brandId)
      .eq('status', 'offen')
      .order('created_at', { ascending: true })
      .limit(200)
    if (err) {
      if (isMissingSupabaseTableError(err.message)) {
        setTableMissing(true)
        setError(null)
      } else {
        setError(err.message)
      }
      setItems([])
      setLoading(false)
      return
    }
    setTableMissing(false)
    setError(null)
    setItems((data ?? []) as EntscheiderKandidat[])
    setLoading(false)
  }, [brandId, brandPending])

  useEffect(() => {
    void reload()
  }, [reload])

  const setzeStatus = useCallback(
    async (id: string, status: EntscheiderStatus) => {
      if (!supabase) return
      const jetzt = new Date().toISOString()
      // Optimistisch: der Klick soll sich sofort anfühlen, auch übers Handy.
      setItems((cur) => cur.map((k) => (k.id === id ? { ...k, status, status_at: jetzt } : k)))
      const { error: err } = await supabase.from('entscheider_kandidaten').update({ status, status_at: jetzt }).eq('id', id)
      if (err) {
        setError(err.message)
        await reload()
      }
    },
    [reload],
  )

  return { items, loading, tableMissing, error, reload, setzeStatus }
}
