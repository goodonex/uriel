import { useCallback, useEffect, useRef, useState } from 'react'
import { generateId, loadList, saveList } from '../lib/storage'
import { computeAdsMetrics, computeMrrMetrics } from '../lib/performanceMetrics'
import { startOfMonthIsoDate } from '../lib/performanceDates'
import { isMissingSupabaseTableError } from '../lib/supabaseErrors'
import { supabase } from '../lib/supabase'
import type { MonthlySnapshot } from '../types/db'
import { useAdCampaigns } from './useAdCampaigns'
import { useBrandId } from './useBrandId'
import { useContacts } from './useContacts'

function nowIso(): string {
  return new Date().toISOString()
}

function rowToSnapshot(row: Record<string, unknown>, fallbackBrand: string): MonthlySnapshot {
  return {
    id: typeof row.id === 'string' ? row.id : generateId(),
    brand_id: typeof row.brand_id === 'string' ? row.brand_id : fallbackBrand,
    month: typeof row.month === 'string' ? row.month : startOfMonthIsoDate(),
    mrr: Number(row.mrr ?? 0),
    mrr_override: row.mrr_override != null ? Number(row.mrr_override) : null,
    mrr_delta: Number(row.mrr_delta ?? 0),
    project_revenue: Number(row.project_revenue ?? 0),
    total_revenue: Number(row.total_revenue ?? 0),
    active_customers: Number(row.active_customers ?? 0),
    churn_rate: Number(row.churn_rate ?? 0),
    new_customers: Number(row.new_customers ?? 0),
    ads_cpl: row.ads_cpl != null ? Number(row.ads_cpl) : null,
    ads_cpk: row.ads_cpk != null ? Number(row.ads_cpk) : null,
    created_at: typeof row.created_at === 'string' ? row.created_at : nowIso(),
    updated_at: typeof row.updated_at === 'string' ? row.updated_at : nowIso(),
  }
}

function buildSnapshotFromMetrics(
  brandId: string,
  month: string,
  previousMrr: number | null,
  contacts: ReturnType<typeof useContacts>['items'],
  adsCpl: number | null,
  adsCpk: number | null,
): MonthlySnapshot {
  const metrics = computeMrrMetrics(contacts)
  const mrr = metrics.currentMrr
  return {
    id: generateId(),
    brand_id: brandId,
    month,
    mrr,
    mrr_override: null,
    mrr_delta: previousMrr !== null ? mrr - previousMrr : 0,
    project_revenue: metrics.projectRevenueThisMonth,
    total_revenue: metrics.totalRevenueThisMonth,
    active_customers: metrics.activeCustomers,
    churn_rate: metrics.monthlyChurnRate,
    new_customers: metrics.newCustomersThisMonth,
    ads_cpl: adsCpl,
    ads_cpk: adsCpk,
    created_at: nowIso(),
    updated_at: nowIso(),
  }
}

interface UseMonthlySnapshotResult {
  current: MonthlySnapshot | null
  previous: MonthlySnapshot | null
  loading: boolean
  error: string | null
  ensureCurrentMonth: () => Promise<void>
  reload: () => Promise<void>
}

export function useMonthlySnapshot(brandSlug: string | undefined): UseMonthlySnapshotResult {
  const brandId = useBrandId(brandSlug)
  const month = startOfMonthIsoDate()
  const [current, setCurrent] = useState<MonthlySnapshot | null>(null)
  const [previous, setPrevious] = useState<MonthlySnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const localOnly = useRef(false)
  const contacts = useContacts(brandSlug)
  const campaigns = useAdCampaigns(brandSlug)
  const ensured = useRef(false)

  const reload = useCallback(async () => {
    if (!brandSlug) {
      setCurrent(null)
      setPrevious(null)
      setLoading(false)
      return
    }
    if (!supabase || !brandId) {
      localOnly.current = true
      const list = loadList<MonthlySnapshot>([brandSlug, 'monthly-snapshots'])
      setCurrent(list.find((s) => s.month === month) ?? null)
      const prevMonth = new Date(month)
      prevMonth.setMonth(prevMonth.getMonth() - 1)
      const prevIso = startOfMonthIsoDate(prevMonth)
      setPrevious(list.find((s) => s.month === prevIso) ?? null)
      setLoading(false)
      return
    }
    setLoading(true)
    const prevMonth = new Date(month)
    prevMonth.setMonth(prevMonth.getMonth() - 1)
    const prevIso = startOfMonthIsoDate(prevMonth)

    const [curRes, prevRes] = await Promise.all([
      supabase
        .from('monthly_snapshots')
        .select('*')
        .eq('brand_id', brandId)
        .eq('month', month)
        .maybeSingle(),
      supabase
        .from('monthly_snapshots')
        .select('*')
        .eq('brand_id', brandId)
        .eq('month', prevIso)
        .maybeSingle(),
    ])

    if (curRes.error && !isMissingSupabaseTableError(curRes.error.message)) {
      setError(curRes.error.message)
      setLoading(false)
      return
    }
    localOnly.current = false
    setCurrent(
      curRes.data ? rowToSnapshot(curRes.data as Record<string, unknown>, brandId) : null,
    )
    setPrevious(
      prevRes.data ? rowToSnapshot(prevRes.data as Record<string, unknown>, brandId) : null,
    )
    setError(null)
    setLoading(false)
  }, [brandSlug, brandId, month])

  useEffect(() => {
    void reload()
  }, [reload])

  const ensureCurrentMonth = useCallback(async () => {
    if (!brandSlug || !brandId || ensured.current) return
    if (loading) return
    if (current) {
      ensured.current = true
      return
    }
    ensured.current = true
    const ads = computeAdsMetrics(campaigns.items)
    const prevMrr = previous?.mrr_override ?? previous?.mrr ?? null
    const snap = buildSnapshotFromMetrics(
      brandId,
      month,
      prevMrr,
      contacts.items,
      ads.cpl,
      ads.cpk,
    )

    setCurrent(snap)
    if (localOnly.current || !supabase) {
      const list = loadList<MonthlySnapshot>([brandSlug, 'monthly-snapshots'])
      const others = list.filter((s) => s.month !== month)
      saveList([brandSlug, 'monthly-snapshots'], [...others, snap])
      return
    }
    const { error: upErr } = await supabase.from('monthly_snapshots').upsert(
      {
        id: snap.id,
        brand_id: brandId,
        month: snap.month,
        mrr: snap.mrr,
        mrr_delta: snap.mrr_delta,
        project_revenue: snap.project_revenue,
        total_revenue: snap.total_revenue,
        active_customers: snap.active_customers,
        churn_rate: snap.churn_rate,
        new_customers: snap.new_customers,
        ads_cpl: snap.ads_cpl,
        ads_cpk: snap.ads_cpk,
        updated_at: snap.updated_at,
      },
      { onConflict: 'brand_id,month' },
    )
    if (upErr) setError(upErr.message)
  }, [brandId, brandSlug, campaigns.items, contacts.items, current, loading, month, previous])

  useEffect(() => {
    void ensureCurrentMonth()
  }, [ensureCurrentMonth])

  return { current, previous, loading, error, ensureCurrentMonth, reload }
}
