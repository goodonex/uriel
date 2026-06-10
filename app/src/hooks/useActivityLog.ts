import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  rowToActivity,
  type ActivityEntry,
} from '../lib/activityLog'
import { isMissingSupabaseTableError } from '../lib/supabaseErrors'
import { supabase } from '../lib/supabase'
import { useBrandId } from './useBrandId'

interface UseActivityLogResult {
  items: ActivityEntry[]
  unreadCount: number
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  markAllRead: () => Promise<void>
  markRead: (id: string) => Promise<void>
}

export function useActivityLog(
  brandSlug: string | undefined,
  limit = 50,
): UseActivityLogResult {
  const brandId = useBrandId(brandSlug)
  const [items, setItems] = useState<ActivityEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const itemsRef = useRef<ActivityEntry[]>([])
  const hydratedRef = useRef(false)
  itemsRef.current = items

  const reload = useCallback(async () => {
    if (!supabase || !brandId) {
      setItems([])
      setLoading(false)
      hydratedRef.current = true
      setError(null)
      return
    }
    if (!hydratedRef.current) setLoading(true)
    const { data, error: err } = await supabase
      .from('activity_log')
      .select('*')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (err) {
      if (isMissingSupabaseTableError(err.message)) {
        setItems([])
      } else {
        setError(err.message)
      }
      hydratedRef.current = true
      setLoading(false)
      return
    }
    setError(null)
    setItems((data ?? []).map((r) => rowToActivity(r as Record<string, unknown>)))
    hydratedRef.current = true
    setLoading(false)
  }, [brandId, limit])

  useEffect(() => {
    hydratedRef.current = false
  }, [brandId])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    if (!supabase || !brandId) return
    const interval = window.setInterval(() => {
      void reload()
    }, 60000)
    return () => window.clearInterval(interval)
  }, [brandId, reload])

  const unreadCount = useMemo(
    () => items.filter((i) => !i.read_at).length,
    [items],
  )

  const markAllRead = useCallback(async () => {
    if (!supabase || !brandId) return
    const now = new Date().toISOString()
    setItems((prev) => prev.map((i) => (i.read_at ? i : { ...i, read_at: now })))
    const { error: err } = await supabase
      .from('activity_log')
      .update({ read_at: now })
      .eq('brand_id', brandId)
      .is('read_at', null)
    if (err) {
      console.warn('[activity_log] markAllRead', err.message)
      void reload()
    }
  }, [brandId, reload])

  const markRead = useCallback(
    async (id: string) => {
      if (!supabase || !brandId) return
      const now = new Date().toISOString()
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, read_at: now } : i)))
      const { error: err } = await supabase
        .from('activity_log')
        .update({ read_at: now })
        .eq('id', id)
      if (err) {
        console.warn('[activity_log] markRead', err.message)
        void reload()
      }
    },
    [brandId, reload],
  )

  return { items, unreadCount, loading, error, reload, markAllRead, markRead }
}
