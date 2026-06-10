import { useCallback, useEffect, useRef, useState } from 'react'
import { readCachedDailyTargets, writeCachedDailyTargets } from '../lib/performanceCache'
import { generateId, loadList, saveList } from '../lib/storage'
import { DEFAULT_DAILY_TARGETS } from '../lib/performanceSeeds'
import { isMissingSupabaseTableError } from '../lib/supabaseErrors'
import { supabase } from '../lib/supabase'
import type { DailyMetricTargets } from '../types/db'
import { useBrandId } from './useBrandId'

function nowIso(): string {
  return new Date().toISOString()
}

function rowToTargets(row: Record<string, unknown>, fallbackBrand: string): DailyMetricTargets {
  return {
    id: typeof row.id === 'string' ? row.id : generateId(),
    brand_id: typeof row.brand_id === 'string' ? row.brand_id : fallbackBrand,
    dial_attempts_target:
      typeof row.dial_attempts_target === 'number' ? row.dial_attempts_target : 50,
    linkedin_target: typeof row.linkedin_target === 'number' ? row.linkedin_target : 30,
    pitches_target: typeof row.pitches_target === 'number' ? row.pitches_target : 5,
    created_at: typeof row.created_at === 'string' ? row.created_at : nowIso(),
    updated_at: typeof row.updated_at === 'string' ? row.updated_at : nowIso(),
  }
}

interface UseDailyMetricTargetsResult {
  current: DailyMetricTargets | null
  loading: boolean
  hydrated: boolean
  error: string | null
  upsert: (
    patch: Partial<
      Pick<DailyMetricTargets, 'dial_attempts_target' | 'linkedin_target' | 'pitches_target'>
    >,
  ) => Promise<void>
  reload: () => Promise<void>
}

export function useDailyMetricTargets(
  brandSlug: string | undefined,
): UseDailyMetricTargetsResult {
  const brandId = useBrandId(brandSlug)
  const [current, setCurrent] = useState<DailyMetricTargets | null>(() =>
    brandSlug ? (readCachedDailyTargets(brandSlug) ?? null) : null,
  )
  const [loading, setLoading] = useState(() => !brandSlug || !readCachedDailyTargets(brandSlug))
  const [hydrated, setHydrated] = useState(() =>
    Boolean(brandSlug && readCachedDailyTargets(brandSlug)),
  )
  const [error, setError] = useState<string | null>(null)
  const localOnly = useRef(false)
  const seedStarted = useRef(false)
  const hydratedRef = useRef(Boolean(brandSlug && readCachedDailyTargets(brandSlug)))

  useEffect(() => {
    seedStarted.current = false
    const cached = brandSlug ? readCachedDailyTargets(brandSlug) : undefined
    if (cached) {
      setCurrent(cached)
      hydratedRef.current = true
      setHydrated(true)
      setLoading(false)
      return
    }
    hydratedRef.current = false
    setHydrated(false)
    setLoading(true)
  }, [brandSlug])

  const commitCurrent = useCallback(
    (row: DailyMetricTargets | null) => {
      setCurrent(row)
      if (brandSlug && row) writeCachedDailyTargets(brandSlug, row)
    },
    [brandSlug],
  )

  const reload = useCallback(async () => {
    if (!brandSlug) {
      commitCurrent(null)
      setLoading(false)
      hydratedRef.current = true
      setHydrated(true)
      return
    }
    if (!supabase || !brandId) {
      localOnly.current = true
      const list = loadList<DailyMetricTargets>([brandSlug, 'daily-metric-targets'])
      commitCurrent(list[0] ?? null)
      setLoading(false)
      hydratedRef.current = true
      setHydrated(true)
      return
    }
    if (!hydratedRef.current) setLoading(true)
    const { data, error: err } = await supabase
      .from('daily_metric_targets')
      .select('*')
      .eq('brand_id', brandId)
      .maybeSingle()
    if (err && !isMissingSupabaseTableError(err.message)) {
      setError(err.message)
      setLoading(false)
      hydratedRef.current = true
      setHydrated(true)
      return
    }
    localOnly.current = false
    const row = data ? rowToTargets(data as Record<string, unknown>, brandId) : null
    setError(null)
    setLoading(false)
    hydratedRef.current = true
    setHydrated(true)

    if (!row && !seedStarted.current) {
      seedStarted.current = true
      const merged: DailyMetricTargets = {
        id: generateId(),
        brand_id: brandId,
        ...DEFAULT_DAILY_TARGETS,
        created_at: nowIso(),
        updated_at: nowIso(),
      }
      commitCurrent(merged)
      const { error: upErr } = await supabase.from('daily_metric_targets').upsert(
        {
          id: merged.id,
          brand_id: brandId,
          dial_attempts_target: merged.dial_attempts_target,
          linkedin_target: merged.linkedin_target,
          pitches_target: merged.pitches_target,
          updated_at: merged.updated_at,
        },
        { onConflict: 'brand_id' },
      )
      if (upErr) setError(upErr.message)
    } else {
      commitCurrent(row)
    }
  }, [brandSlug, brandId, commitCurrent])

  useEffect(() => {
    void reload()
  }, [reload])

  const upsert = useCallback(
    async (
      patch: Partial<
        Pick<DailyMetricTargets, 'dial_attempts_target' | 'linkedin_target' | 'pitches_target'>
      >,
    ) => {
      if (!brandSlug) return
      const merged: DailyMetricTargets = {
        id: current?.id ?? generateId(),
        brand_id: localOnly.current ? brandSlug : (brandId ?? brandSlug),
        dial_attempts_target:
          patch.dial_attempts_target ?? current?.dial_attempts_target ?? DEFAULT_DAILY_TARGETS.dial_attempts_target,
        linkedin_target:
          patch.linkedin_target ?? current?.linkedin_target ?? DEFAULT_DAILY_TARGETS.linkedin_target,
        pitches_target:
          patch.pitches_target ?? current?.pitches_target ?? DEFAULT_DAILY_TARGETS.pitches_target,
        created_at: current?.created_at ?? nowIso(),
        updated_at: nowIso(),
      }
      commitCurrent(merged)
      if (localOnly.current || !supabase || !brandId) {
        saveList([brandSlug, 'daily-metric-targets'], [merged])
        return
      }
      const { error: upErr } = await supabase.from('daily_metric_targets').upsert(
        {
          id: merged.id,
          brand_id: brandId,
          dial_attempts_target: merged.dial_attempts_target,
          linkedin_target: merged.linkedin_target,
          pitches_target: merged.pitches_target,
          updated_at: merged.updated_at,
        },
        { onConflict: 'brand_id' },
      )
      if (upErr) setError(upErr.message)
    },
    [brandSlug, brandId, commitCurrent, current],
  )

  return { current, loading, hydrated, error, upsert, reload }
}
