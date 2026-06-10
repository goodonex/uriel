import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { generateId, loadList, saveList } from '../lib/storage'
import { buildWeeklyPulse } from '../lib/performanceMetrics'
import { startOfWeekIsoDate, startOfWeekMondayMs } from '../lib/performanceDates'
import { isMissingSupabaseTableError } from '../lib/supabaseErrors'
import { supabase } from '../lib/supabase'
import type { WeeklyReview, WeeklyReviewSnapshot } from '../types/db'
import { useActivityLog } from './useActivityLog'
import { useActivityEntries } from './useActivityEntries'
import { useContacts } from './useContacts'
import { useContentPieces } from './useContentPieces'
import { useOpportunities } from './useOpportunities'
import { useBrandId } from './useBrandId'

function nowIso(): string {
  return new Date().toISOString()
}

function rowToReview(row: Record<string, unknown>, fallbackBrand: string): WeeklyReview {
  const snapshotRaw = row.snapshot
  const snapshot =
    snapshotRaw && typeof snapshotRaw === 'object' && !Array.isArray(snapshotRaw)
      ? (snapshotRaw as WeeklyReviewSnapshot)
      : ({} as WeeklyReviewSnapshot)

  return {
    id: typeof row.id === 'string' ? row.id : generateId(),
    brand_id: typeof row.brand_id === 'string' ? row.brand_id : fallbackBrand,
    week_start: typeof row.week_start === 'string' ? row.week_start : startOfWeekIsoDate(),
    snapshot,
    notes: typeof row.notes === 'string' ? row.notes : '',
    completed_at: typeof row.completed_at === 'string' ? row.completed_at : null,
    created_at: typeof row.created_at === 'string' ? row.created_at : nowIso(),
    updated_at: typeof row.updated_at === 'string' ? row.updated_at : nowIso(),
  }
}

interface UseWeeklyReviewResult {
  current: WeeklyReview | null
  autoSnapshot: WeeklyReviewSnapshot
  loading: boolean
  error: string | null
  complete: (notes: string) => Promise<void>
  reload: () => Promise<void>
}

export function useWeeklyReview(brandSlug: string | undefined): UseWeeklyReviewResult {
  const brandId = useBrandId(brandSlug)
  const weekStart = startOfWeekIsoDate()
  const [current, setCurrent] = useState<WeeklyReview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const localOnly = useRef(false)

  const activityLog = useActivityLog(brandSlug, 500)
  const crmEntries = useActivityEntries(brandSlug, { limit: 500 })
  const contacts = useContacts(brandSlug)
  const pieces = useContentPieces(brandSlug)
  const opportunities = useOpportunities()

  const autoSnapshot = useMemo(
    () =>
      buildWeeklyPulse(
        crmEntries.items,
        activityLog.items,
        contacts.items,
        opportunities.items,
        pieces.items,
        startOfWeekMondayMs(),
      ),
    [
      crmEntries.items,
      activityLog.items,
      contacts.items,
      opportunities.items,
      pieces.items,
    ],
  )

  const reload = useCallback(async () => {
    if (!brandSlug) {
      setCurrent(null)
      setLoading(false)
      return
    }
    if (!supabase || !brandId) {
      localOnly.current = true
      const list = loadList<WeeklyReview>([brandSlug, 'weekly-reviews'])
      setCurrent(list.find((r) => r.week_start === weekStart) ?? null)
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error: err } = await supabase
      .from('weekly_reviews')
      .select('*')
      .eq('brand_id', brandId)
      .eq('week_start', weekStart)
      .maybeSingle()
    if (err && !isMissingSupabaseTableError(err.message)) {
      setError(err.message)
      setLoading(false)
      return
    }
    localOnly.current = false
    setCurrent(data ? rowToReview(data as Record<string, unknown>, brandId) : null)
    setError(null)
    setLoading(false)
  }, [brandSlug, brandId, weekStart])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    if (!brandSlug) return
    const ids = contacts.items.map((c) => c.id).filter(Boolean)
    if (ids.length === 0) return
    void opportunities.loadForContacts(ids)
  }, [brandSlug, contacts.items, opportunities])

  const complete = useCallback(
    async (notes: string) => {
      if (!brandSlug) return
      const merged: WeeklyReview = {
        id: current?.id ?? generateId(),
        brand_id: localOnly.current ? brandSlug : (brandId ?? brandSlug),
        week_start: weekStart,
        snapshot: autoSnapshot,
        notes,
        completed_at: nowIso(),
        created_at: current?.created_at ?? nowIso(),
        updated_at: nowIso(),
      }
      setCurrent(merged)
      if (localOnly.current || !supabase || !brandId) {
        const list = loadList<WeeklyReview>([brandSlug, 'weekly-reviews'])
        const others = list.filter((r) => r.week_start !== weekStart)
        saveList([brandSlug, 'weekly-reviews'], [...others, merged])
        return
      }
      const { error: upErr } = await supabase.from('weekly_reviews').upsert(
        {
          id: merged.id,
          brand_id: brandId,
          week_start: weekStart,
          snapshot: merged.snapshot,
          notes: merged.notes,
          completed_at: merged.completed_at,
          updated_at: merged.updated_at,
        },
        { onConflict: 'brand_id,week_start' },
      )
      if (upErr) setError(upErr.message)
    },
    [autoSnapshot, brandId, brandSlug, current, weekStart],
  )

  return { current, autoSnapshot, loading, error, complete, reload }
}
