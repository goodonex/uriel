import { useCallback, useEffect, useRef, useState } from 'react'
import {
  readCachedBusinessTargets,
  writeCachedBusinessTargets,
} from '../lib/performanceCache'
import { generateId, loadList, saveList } from '../lib/storage'
import { DEFAULT_H2_2026_TARGETS } from '../lib/performanceSeeds'
import { isMissingSupabaseTableError } from '../lib/supabaseErrors'
import { supabase } from '../lib/supabase'
import type { BusinessTarget, BusinessTargetMilestone } from '../types/db'
import { useBrandId } from './useBrandId'

const PERIOD = 'H2 2026'

function nowIso(): string {
  return new Date().toISOString()
}

function rowToTarget(row: Record<string, unknown>, fallbackBrand: string): BusinessTarget {
  const milestonesRaw = row.milestones
  const milestones: BusinessTargetMilestone[] = Array.isArray(milestonesRaw)
    ? (milestonesRaw as BusinessTargetMilestone[])
    : DEFAULT_H2_2026_TARGETS.milestones

  return {
    id: typeof row.id === 'string' ? row.id : generateId(),
    brand_id: typeof row.brand_id === 'string' ? row.brand_id : fallbackBrand,
    period_label: typeof row.period_label === 'string' ? row.period_label : PERIOD,
    north_star_mrr: Number(row.north_star_mrr ?? DEFAULT_H2_2026_TARGETS.north_star_mrr),
    north_star_deadline:
      typeof row.north_star_deadline === 'string'
        ? row.north_star_deadline
        : DEFAULT_H2_2026_TARGETS.north_star_deadline,
    mrr_dec_target: Number(row.mrr_dec_target ?? DEFAULT_H2_2026_TARGETS.mrr_dec_target),
    total_revenue_target: Number(
      row.total_revenue_target ?? DEFAULT_H2_2026_TARGETS.total_revenue_target,
    ),
    new_customers_target: Number(
      row.new_customers_target ?? DEFAULT_H2_2026_TARGETS.new_customers_target,
    ),
    margin_min: Number(row.margin_min ?? DEFAULT_H2_2026_TARGETS.margin_min),
    margin_max: Number(row.margin_max ?? DEFAULT_H2_2026_TARGETS.margin_max),
    hire_trigger_mrr: Number(row.hire_trigger_mrr ?? DEFAULT_H2_2026_TARGETS.hire_trigger_mrr),
    hire_trigger_profit: Number(
      row.hire_trigger_profit ?? DEFAULT_H2_2026_TARGETS.hire_trigger_profit,
    ),
    milestones,
    created_at: typeof row.created_at === 'string' ? row.created_at : nowIso(),
    updated_at: typeof row.updated_at === 'string' ? row.updated_at : nowIso(),
  }
}

interface UseBusinessTargetsResult {
  current: BusinessTarget | null
  loading: boolean
  hydrated: boolean
  error: string | null
  upsert: (patch: Partial<Omit<BusinessTarget, 'id' | 'brand_id' | 'created_at' | 'updated_at'>>) => Promise<void>
  reload: () => Promise<void>
}

export function useBusinessTargets(brandSlug: string | undefined): UseBusinessTargetsResult {
  const brandId = useBrandId(brandSlug)
  const [current, setCurrent] = useState<BusinessTarget | null>(() =>
    brandSlug ? (readCachedBusinessTargets(brandSlug) ?? null) : null,
  )
  const [loading, setLoading] = useState(() => !brandSlug || !readCachedBusinessTargets(brandSlug))
  const [hydrated, setHydrated] = useState(() =>
    Boolean(brandSlug && readCachedBusinessTargets(brandSlug)),
  )
  const [error, setError] = useState<string | null>(null)
  const localOnly = useRef(false)
  const seedStarted = useRef(false)
  const hydratedRef = useRef(Boolean(brandSlug && readCachedBusinessTargets(brandSlug)))

  useEffect(() => {
    seedStarted.current = false
    const cached = brandSlug ? readCachedBusinessTargets(brandSlug) : undefined
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
    (row: BusinessTarget | null) => {
      setCurrent(row)
      if (brandSlug && row) writeCachedBusinessTargets(brandSlug, row)
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
      const list = loadList<BusinessTarget>([brandSlug, 'business-targets'])
      const row = list.find((t) => t.period_label === PERIOD) ?? null
      commitCurrent(row)
      setLoading(false)
      hydratedRef.current = true
      setHydrated(true)
      return
    }
    if (!hydratedRef.current) setLoading(true)
    const { data, error: err } = await supabase
      .from('business_targets')
      .select('*')
      .eq('brand_id', brandId)
      .eq('period_label', PERIOD)
      .maybeSingle()
    if (err && !isMissingSupabaseTableError(err.message)) {
      setError(err.message)
      setLoading(false)
      hydratedRef.current = true
      setHydrated(true)
      return
    }
    localOnly.current = false
    const row = data ? rowToTarget(data as Record<string, unknown>, brandId) : null
    setError(null)
    setLoading(false)
    hydratedRef.current = true
    setHydrated(true)

    if (!row && !seedStarted.current) {
      seedStarted.current = true
      const merged: BusinessTarget = {
        id: generateId(),
        brand_id: brandId,
        ...DEFAULT_H2_2026_TARGETS,
        created_at: nowIso(),
        updated_at: nowIso(),
      }
      commitCurrent(merged)
      const { error: upErr } = await supabase.from('business_targets').upsert(
        {
          id: merged.id,
          brand_id: brandId,
          period_label: merged.period_label,
          north_star_mrr: merged.north_star_mrr,
          north_star_deadline: merged.north_star_deadline,
          mrr_dec_target: merged.mrr_dec_target,
          total_revenue_target: merged.total_revenue_target,
          new_customers_target: merged.new_customers_target,
          margin_min: merged.margin_min,
          margin_max: merged.margin_max,
          hire_trigger_mrr: merged.hire_trigger_mrr,
          hire_trigger_profit: merged.hire_trigger_profit,
          milestones: merged.milestones,
          updated_at: merged.updated_at,
        },
        { onConflict: 'brand_id,period_label' },
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
      patch: Partial<Omit<BusinessTarget, 'id' | 'brand_id' | 'created_at' | 'updated_at'>>,
    ) => {
      if (!brandSlug) return
      const merged: BusinessTarget = {
        id: current?.id ?? generateId(),
        brand_id: localOnly.current ? brandSlug : (brandId ?? brandSlug),
        period_label: patch.period_label ?? current?.period_label ?? PERIOD,
        north_star_mrr: patch.north_star_mrr ?? current?.north_star_mrr ?? DEFAULT_H2_2026_TARGETS.north_star_mrr,
        north_star_deadline:
          patch.north_star_deadline ??
          current?.north_star_deadline ??
          DEFAULT_H2_2026_TARGETS.north_star_deadline,
        mrr_dec_target:
          patch.mrr_dec_target ?? current?.mrr_dec_target ?? DEFAULT_H2_2026_TARGETS.mrr_dec_target,
        total_revenue_target:
          patch.total_revenue_target ??
          current?.total_revenue_target ??
          DEFAULT_H2_2026_TARGETS.total_revenue_target,
        new_customers_target:
          patch.new_customers_target ??
          current?.new_customers_target ??
          DEFAULT_H2_2026_TARGETS.new_customers_target,
        margin_min: patch.margin_min ?? current?.margin_min ?? DEFAULT_H2_2026_TARGETS.margin_min,
        margin_max: patch.margin_max ?? current?.margin_max ?? DEFAULT_H2_2026_TARGETS.margin_max,
        hire_trigger_mrr:
          patch.hire_trigger_mrr ??
          current?.hire_trigger_mrr ??
          DEFAULT_H2_2026_TARGETS.hire_trigger_mrr,
        hire_trigger_profit:
          patch.hire_trigger_profit ??
          current?.hire_trigger_profit ??
          DEFAULT_H2_2026_TARGETS.hire_trigger_profit,
        milestones: patch.milestones ?? current?.milestones ?? DEFAULT_H2_2026_TARGETS.milestones,
        created_at: current?.created_at ?? nowIso(),
        updated_at: nowIso(),
      }
      commitCurrent(merged)
      if (localOnly.current || !supabase || !brandId) {
        const list = loadList<BusinessTarget>([brandSlug, 'business-targets'])
        const others = list.filter((t) => t.period_label !== PERIOD)
        saveList([brandSlug, 'business-targets'], [...others, merged])
        return
      }
      const { error: upErr } = await supabase.from('business_targets').upsert(
        {
          id: merged.id,
          brand_id: brandId,
          period_label: merged.period_label,
          north_star_mrr: merged.north_star_mrr,
          north_star_deadline: merged.north_star_deadline,
          mrr_dec_target: merged.mrr_dec_target,
          total_revenue_target: merged.total_revenue_target,
          new_customers_target: merged.new_customers_target,
          margin_min: merged.margin_min,
          margin_max: merged.margin_max,
          hire_trigger_mrr: merged.hire_trigger_mrr,
          hire_trigger_profit: merged.hire_trigger_profit,
          milestones: merged.milestones,
          updated_at: merged.updated_at,
        },
        { onConflict: 'brand_id,period_label' },
      )
      if (upErr) setError(upErr.message)
    },
    [brandSlug, brandId, commitCurrent, current],
  )

  return { current, loading, hydrated, error, upsert, reload }
}
