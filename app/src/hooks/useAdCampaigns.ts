/**
 * useAdCampaigns — Ads-Verwaltung pro Brand (CRUD).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { generateId, loadList, saveList } from '../lib/storage'
import { isMissingSupabaseTableError } from '../lib/supabaseErrors'
import { supabase } from '../lib/supabase'
import type { AdCampaign } from '../types/db'
import { useBrandId } from './useBrandId'

function nowIso() {
  return new Date().toISOString()
}

function defaults(brandId: string): Omit<AdCampaign, 'id' | 'created_at' | 'updated_at'> {
  return {
    brand_id: brandId,
    name: '',
    platform: 'meta',
    status: 'draft',
    hook: '',
    body: '',
    cta: '',
    target_url: '',
    tracking_url: '',
    utm_source: 'brandos',
    utm_medium: 'paid',
    utm_campaign: '',
    utm_content: '',
    budget_total: 0,
    budget_spent: 0,
    cost_per_lead: 0,
    start_date: null,
    end_date: null,
    clicks_count: 0,
    leads_count: 0,
  }
}

export interface UseAdCampaignsResult {
  items: AdCampaign[]
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  create: (patch?: Partial<AdCampaign>) => Promise<AdCampaign>
  update: (id: string, patch: Partial<AdCampaign>) => Promise<void>
  remove: (id: string) => Promise<void>
}

export function useAdCampaigns(brandSlug: string | undefined): UseAdCampaignsResult {
  const brandId = useBrandId(brandSlug)
  const [items, setItems] = useState<AdCampaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const localOnly = useRef(false)

  const reload = useCallback(async () => {
    if (!brandSlug) {
      setItems([])
      setLoading(false)
      return
    }
    const stored = loadList<AdCampaign>([brandSlug, 'ad-campaigns'])
    if (!supabase || !brandId) {
      localOnly.current = true
      setItems(stored)
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error: err } = await supabase
      .from('ad_campaigns')
      .select('*')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false })
    if (err) {
      if (isMissingSupabaseTableError(err.message)) {
        localOnly.current = true
        setItems(stored)
      } else {
        setError(err.message)
      }
      setLoading(false)
      return
    }
    localOnly.current = false
    setItems((data ?? []) as AdCampaign[])
    setError(null)
    setLoading(false)
  }, [brandSlug, brandId])

  useEffect(() => {
    void reload()
  }, [reload])

  const create = useCallback(
    async (patch: Partial<AdCampaign> = {}): Promise<AdCampaign> => {
      if (!brandSlug) throw new Error('brand_slug missing')
      const id = generateId()
      const base = defaults(localOnly.current ? brandSlug : (brandId ?? brandSlug))
      const row: AdCampaign = {
        id,
        ...base,
        ...patch,
        brand_id: base.brand_id,
        created_at: nowIso(),
        updated_at: nowIso(),
      }
      setItems((cur) => [row, ...cur])
      if (localOnly.current || !supabase || !brandId) {
        const all = loadList<AdCampaign>([brandSlug, 'ad-campaigns'])
        saveList([brandSlug, 'ad-campaigns'], [row, ...all])
        return row
      }
      const dbRow = { ...row, brand_id: brandId }
      const { error: insErr } = await supabase.from('ad_campaigns').insert(dbRow)
      if (insErr) setError(insErr.message)
      return row
    },
    [brandId, brandSlug],
  )

  const update = useCallback(
    async (id: string, patch: Partial<AdCampaign>) => {
      if (!brandSlug) return
      setItems((cur) => cur.map((c) => (c.id === id ? { ...c, ...patch, updated_at: nowIso() } : c)))
      if (localOnly.current || !supabase || !brandId) {
        const all = loadList<AdCampaign>([brandSlug, 'ad-campaigns'])
        saveList([brandSlug, 'ad-campaigns'], all.map((c) => (c.id === id ? { ...c, ...patch } : c)))
        return
      }
      const dbPatch: Record<string, unknown> = { ...patch }
      delete dbPatch.id
      delete dbPatch.brand_id
      delete dbPatch.created_at
      delete dbPatch.updated_at
      const { error: updErr } = await supabase
        .from('ad_campaigns')
        .update(dbPatch)
        .eq('id', id)
      if (updErr) setError(updErr.message)
    },
    [brandId, brandSlug],
  )

  const remove = useCallback(
    async (id: string) => {
      if (!brandSlug) return
      setItems((cur) => cur.filter((c) => c.id !== id))
      if (localOnly.current || !supabase || !brandId) {
        const all = loadList<AdCampaign>([brandSlug, 'ad-campaigns'])
        saveList([brandSlug, 'ad-campaigns'], all.filter((c) => c.id !== id))
        return
      }
      const { error: delErr } = await supabase.from('ad_campaigns').delete().eq('id', id)
      if (delErr) setError(delErr.message)
    },
    [brandId, brandSlug],
  )

  return { items, loading, error, reload, create, update, remove }
}
