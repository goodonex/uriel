/**
 * useRecruitingJobs — Hook für Stellenanzeigen pro Brand.
 * Fallback auf localStorage wenn Supabase fehlt.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { generateId, loadList, saveList } from '../lib/storage'
import { isMissingSupabaseTableError } from '../lib/supabaseErrors'
import { supabase } from '../lib/supabase'
import type { RecruitingJob } from '../types/db'
import { useBrandId } from './useBrandId'

function nowIso() {
  return new Date().toISOString()
}

function defaults(brandId: string): Omit<RecruitingJob, 'id' | 'created_at' | 'updated_at'> {
  return {
    brand_id: brandId,
    title: '',
    description: '',
    requirements: '',
    benefits: '',
    format: 'culturefit',
    status: 'draft',
    external_url: '',
    utm_campaign: '',
    utm_source: '',
    utm_medium: '',
    views_count: 0,
    applications_count: 0,
  }
}

export interface UseRecruitingJobsResult {
  items: RecruitingJob[]
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  create: (patch?: Partial<RecruitingJob>) => Promise<RecruitingJob>
  update: (id: string, patch: Partial<RecruitingJob>) => Promise<void>
  remove: (id: string) => Promise<void>
}

export function useRecruitingJobs(brandSlug: string | undefined): UseRecruitingJobsResult {
  const brandId = useBrandId(brandSlug)
  const [items, setItems] = useState<RecruitingJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const localOnly = useRef(false)

  const reload = useCallback(async () => {
    if (!brandSlug) {
      setItems([])
      setLoading(false)
      return
    }
    const stored = loadList<RecruitingJob>([brandSlug, 'recruiting-jobs'])
    if (!supabase || !brandId) {
      localOnly.current = true
      setItems(stored)
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error: err } = await supabase
      .from('recruiting_jobs')
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
    setItems((data ?? []) as RecruitingJob[])
    setError(null)
    setLoading(false)
  }, [brandSlug, brandId])

  useEffect(() => {
    void reload()
  }, [reload])

  const create = useCallback(
    async (patch: Partial<RecruitingJob> = {}): Promise<RecruitingJob> => {
      if (!brandSlug) throw new Error('brand_slug missing')
      const id = generateId()
      const base = defaults(localOnly.current ? brandSlug : (brandId ?? brandSlug))
      const row: RecruitingJob = {
        id,
        ...base,
        ...patch,
        brand_id: base.brand_id,
        created_at: nowIso(),
        updated_at: nowIso(),
      }
      setItems((cur) => [row, ...cur])
      if (localOnly.current || !supabase || !brandId) {
        const all = loadList<RecruitingJob>([brandSlug, 'recruiting-jobs'])
        saveList([brandSlug, 'recruiting-jobs'], [row, ...all])
        return row
      }
      const dbRow = { ...row, brand_id: brandId }
      const { error: insErr } = await supabase.from('recruiting_jobs').insert(dbRow)
      if (insErr) setError(insErr.message)
      return row
    },
    [brandId, brandSlug],
  )

  const update = useCallback(
    async (id: string, patch: Partial<RecruitingJob>) => {
      if (!brandSlug) return
      setItems((cur) => cur.map((j) => (j.id === id ? { ...j, ...patch, updated_at: nowIso() } : j)))
      if (localOnly.current || !supabase || !brandId) {
        const all = loadList<RecruitingJob>([brandSlug, 'recruiting-jobs'])
        saveList(
          [brandSlug, 'recruiting-jobs'],
          all.map((j) => (j.id === id ? { ...j, ...patch } : j)),
        )
        return
      }
      const dbPatch: Record<string, unknown> = { ...patch }
      delete dbPatch.id
      delete dbPatch.brand_id
      delete dbPatch.created_at
      delete dbPatch.updated_at
      const { error: updErr } = await supabase
        .from('recruiting_jobs')
        .update(dbPatch)
        .eq('id', id)
      if (updErr) setError(updErr.message)
    },
    [brandId, brandSlug],
  )

  const remove = useCallback(
    async (id: string) => {
      if (!brandSlug) return
      setItems((cur) => cur.filter((j) => j.id !== id))
      if (localOnly.current || !supabase || !brandId) {
        const all = loadList<RecruitingJob>([brandSlug, 'recruiting-jobs'])
        saveList([brandSlug, 'recruiting-jobs'], all.filter((j) => j.id !== id))
        return
      }
      const { error: delErr } = await supabase.from('recruiting_jobs').delete().eq('id', id)
      if (delErr) setError(delErr.message)
    },
    [brandId, brandSlug],
  )

  return { items, loading, error, reload, create, update, remove }
}
