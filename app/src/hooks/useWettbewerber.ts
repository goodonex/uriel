import { useCallback, useEffect, useState } from 'react'
import type { Wettbewerber, WettbewerberReferenz } from '../cockpit/lib/markt'
import { isMissingSupabaseTableError } from '../lib/supabaseErrors'
import { supabase } from '../lib/supabase'
import { useBrandIdStatus } from './useBrandId'

const WB_SPALTEN =
  'id,name,domain,typ,zielgruppe,einstiegsangebot,kundengewinnung,instagram,linkedin,notizen,quelle,status,created_at'
const REF_SPALTEN = 'id,wettbewerber_id,kunde_domain,kunde_name,contact_id,quelle,tiefe,created_at'

export type WettbewerberFelder = Partial<Omit<Wettbewerber, 'id' | 'created_at'>>

interface Result {
  items: Wettbewerber[]
  loading: boolean
  /** Migration 0097 ist noch nicht eingespielt. */
  tableMissing: boolean
  error: string | null
  reload: () => Promise<void>
  /** Legt einen Eintrag an; gibt `null` zurück und setzt `error`, wenn es nicht geklappt hat. */
  anlegen: (eintrag: { domain: string; name: string; quelle: string }) => Promise<Wettbewerber | null>
  aendern: (id: string, felder: WettbewerberFelder) => Promise<void>
  loeschen: (id: string) => Promise<void>
}

/** Wettbewerber der aktiven Brand (Migration 0097). */
export function useWettbewerber(brandSlug: string | undefined): Result {
  const { brandId, pending: brandPending } = useBrandIdStatus(brandSlug)
  const [items, setItems] = useState<Wettbewerber[]>([])
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
      .from('wettbewerber')
      .select(WB_SPALTEN)
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false })
      .limit(500)
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
    setItems((data ?? []) as Wettbewerber[])
    setLoading(false)
  }, [brandId, brandPending])

  useEffect(() => {
    void reload()
  }, [reload])

  const anlegen: Result['anlegen'] = useCallback(
    async ({ domain, name, quelle }) => {
      if (!supabase || !brandId) return null
      const { data, error: err } = await supabase
        .from('wettbewerber')
        .insert({ brand_id: brandId, domain, name, quelle, status: 'neu' })
        .select(WB_SPALTEN)
        .single()
      if (err) {
        // Eindeutigkeit (brand_id, domain): derselbe Link zweimal ist kein Fehler, nur ein Hinweis.
        setError(err.code === '23505' ? `${domain} steht schon in der Liste.` : err.message)
        return null
      }
      setError(null)
      const neu = data as Wettbewerber
      setItems((cur) => [neu, ...cur])
      return neu
    },
    [brandId],
  )

  const aendern: Result['aendern'] = useCallback(
    async (id, felder) => {
      if (!supabase) return
      setItems((cur) => cur.map((w) => (w.id === id ? { ...w, ...felder } : w)))
      const { error: err } = await supabase.from('wettbewerber').update(felder).eq('id', id)
      if (err) {
        setError(err.message)
        await reload()
      }
    },
    [reload],
  )

  const loeschen: Result['loeschen'] = useCallback(
    async (id) => {
      if (!supabase) return
      setItems((cur) => cur.filter((w) => w.id !== id))
      const { error: err } = await supabase.from('wettbewerber').delete().eq('id', id)
      if (err) {
        setError(err.message)
        await reload()
      }
    },
    [reload],
  )

  return { items, loading, tableMissing, error, reload, anlegen, aendern, loeschen }
}

interface ReferenzResult {
  items: WettbewerberReferenz[]
  loading: boolean
  error: string | null
  anlegen: (r: Pick<WettbewerberReferenz, 'kunde_domain' | 'kunde_name' | 'quelle' | 'tiefe'>) => Promise<boolean>
  loeschen: (id: string) => Promise<void>
}

/** Referenzkunden eines Wettbewerbers. */
export function useWettbewerberReferenzen(brandSlug: string | undefined, wettbewerberId: string | undefined): ReferenzResult {
  const { brandId } = useBrandIdStatus(brandSlug)
  const [items, setItems] = useState<WettbewerberReferenz[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    if (!supabase || !wettbewerberId) {
      setItems([])
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error: err } = await supabase
      .from('wettbewerber_referenz')
      .select(REF_SPALTEN)
      .eq('wettbewerber_id', wettbewerberId)
      .order('created_at', { ascending: true })
      .limit(500)
    if (err) {
      setError(err.message)
      setItems([])
    } else {
      setError(null)
      setItems((data ?? []) as WettbewerberReferenz[])
    }
    setLoading(false)
  }, [wettbewerberId])

  useEffect(() => {
    void reload()
  }, [reload])

  const anlegen: ReferenzResult['anlegen'] = useCallback(
    async (r) => {
      if (!supabase || !brandId || !wettbewerberId) return false
      const { error: err } = await supabase
        .from('wettbewerber_referenz')
        .insert({ brand_id: brandId, wettbewerber_id: wettbewerberId, ...r })
      if (err) {
        setError(err.code === '23505' ? 'Diese Referenz steht schon da.' : err.message)
        return false
      }
      await reload()
      return true
    },
    [brandId, wettbewerberId, reload],
  )

  const loeschen: ReferenzResult['loeschen'] = useCallback(
    async (id) => {
      if (!supabase) return
      setItems((cur) => cur.filter((r) => r.id !== id))
      const { error: err } = await supabase.from('wettbewerber_referenz').delete().eq('id', id)
      if (err) {
        setError(err.message)
        await reload()
      }
    },
    [reload],
  )

  return { items, loading, error, anlegen, loeschen }
}
