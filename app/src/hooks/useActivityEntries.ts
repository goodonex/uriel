import { useCallback, useEffect, useRef, useState } from 'react'
import { generateId, loadList, saveList } from '../lib/storage'
import { isMissingSupabaseTableError } from '../lib/supabaseErrors'
import { supabase } from '../lib/supabase'
import type { ActivityEntry, ActivityEntryType } from '../types/db'
import { useAuth } from './useAuth'
import { useBrandId } from './useBrandId'

const STORAGE_KEY = 'activity-entries' as const

function nowIso(): string {
  return new Date().toISOString()
}

function rowToEntry(row: Record<string, unknown>, fallbackBrand: string): ActivityEntry {
  return {
    id: typeof row.id === 'string' ? row.id : generateId(),
    brand_id: typeof row.brand_id === 'string' ? row.brand_id : fallbackBrand,
    contact_id: typeof row.contact_id === 'string' ? row.contact_id : '',
    activity_type: (row.activity_type as ActivityEntryType) ?? 'notiz',
    performed_by: typeof row.performed_by === 'string' ? row.performed_by : null,
    data: (row.data && typeof row.data === 'object' ? row.data : {}) as Record<string, unknown>,
    created_at: typeof row.created_at === 'string' ? row.created_at : nowIso(),
  }
}

interface UseActivityEntriesOpts {
  contactId?: string
  limit?: number
}

interface UseActivityEntriesResult {
  items: ActivityEntry[]
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  create: (input: {
    contact_id: string
    activity_type: ActivityEntryType
    data?: Record<string, unknown>
  }) => Promise<{ entry: ActivityEntry | null; error?: string }>
  update: (
    id: string,
    patch: { data?: Record<string, unknown> },
  ) => Promise<{ entry: ActivityEntry | null; error?: string }>
}

export function useActivityEntries(
  brandSlug: string | undefined,
  opts: UseActivityEntriesOpts = {},
): UseActivityEntriesResult {
  const brandId = useBrandId(brandSlug)
  const { user } = useAuth()
  const { contactId, limit = 200 } = opts
  const [items, setItems] = useState<ActivityEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const localOnly = useRef(false)
  const itemsRef = useRef<ActivityEntry[]>([])
  itemsRef.current = items

  const reload = useCallback(async () => {
    if (!brandSlug) {
      setItems([])
      setLoading(false)
      return
    }
    const stored = loadList<ActivityEntry>([brandSlug, STORAGE_KEY])
    if (!supabase || !brandId) {
      localOnly.current = true
      const filtered = contactId ? stored.filter((x) => x.contact_id === contactId) : stored
      setItems(filtered)
      setLoading(false)
      return
    }
    setLoading(true)
    let q = supabase
      .from('activity_entries')
      .select('*')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (contactId) q = q.eq('contact_id', contactId)
    const { data, error: err } = await q
    if (err) {
      if (isMissingSupabaseTableError(err.message)) {
        localOnly.current = true
        setItems(contactId ? stored.filter((x) => x.contact_id === contactId) : stored)
        setError(null)
      } else {
        setError(err.message)
      }
      setLoading(false)
      return
    }
    localOnly.current = false
    setItems((data ?? []).map((r) => rowToEntry(r as Record<string, unknown>, brandId)))
    setError(null)
    setLoading(false)
  }, [brandSlug, brandId, contactId, limit])

  useEffect(() => {
    void reload()
  }, [reload])

  const create = useCallback(
    async (input: {
      contact_id: string
      activity_type: ActivityEntryType
      data?: Record<string, unknown>
    }): Promise<{ entry: ActivityEntry | null; error?: string }> => {
      if (!brandSlug) return { entry: null, error: 'Kein Brand' }
      const row: ActivityEntry = {
        id: generateId(),
        brand_id: localOnly.current ? brandSlug : (brandId ?? brandSlug),
        contact_id: input.contact_id,
        activity_type: input.activity_type,
        performed_by: user?.id ?? null,
        data: input.data ?? {},
        created_at: nowIso(),
      }
      setItems((cur) => [row, ...cur])
      if (localOnly.current || !supabase || !brandId) {
        const all = loadList<ActivityEntry>([brandSlug, STORAGE_KEY])
        saveList([brandSlug, STORAGE_KEY], [row, ...all])
        return { entry: row }
      }
      const { data, error: insErr } = await supabase
        .from('activity_entries')
        .insert({
          brand_id: brandId,
          contact_id: row.contact_id,
          activity_type: row.activity_type,
          performed_by: row.performed_by,
          data: row.data,
        })
        .select('*')
        .maybeSingle()
      if (insErr) {
        console.error('[activity_entries] insert failed', insErr)
        setItems((cur) => cur.filter((x) => x.id !== row.id))
        setError(insErr.message)
        return { entry: null, error: insErr.message }
      }
      if (data) {
        const mapped = rowToEntry(data as Record<string, unknown>, brandId)
        setItems((cur) => [mapped, ...cur.filter((x) => x.id !== row.id)])
        return { entry: mapped }
      }
      return { entry: row }
    },
    [brandId, brandSlug, user?.id],
  )

  const update = useCallback(
    async (
      id: string,
      patch: { data?: Record<string, unknown> },
    ): Promise<{ entry: ActivityEntry | null; error?: string }> => {
      if (!brandSlug) return { entry: null, error: 'Kein Brand' }
      const prev = itemsRef.current.find((e) => e.id === id)
      if (!prev) return { entry: null, error: 'Eintrag nicht gefunden' }
      const merged: ActivityEntry = {
        ...prev,
        data: patch.data ?? prev.data,
      }
      setItems((cur) => cur.map((e) => (e.id === id ? merged : e)))
      if (localOnly.current || !supabase || !brandId) {
        const all = loadList<ActivityEntry>([brandSlug, STORAGE_KEY])
        saveList(
          [brandSlug, STORAGE_KEY],
          all.map((e) => (e.id === id ? merged : e)),
        )
        return { entry: merged }
      }
      const { data, error: updErr } = await supabase
        .from('activity_entries')
        .update({ data: merged.data })
        .eq('id', id)
        .eq('brand_id', brandId)
        .select('*')
        .maybeSingle()
      if (updErr) {
        console.error('[activity_entries] update failed', updErr)
        setItems((cur) => cur.map((e) => (e.id === id ? prev : e)))
        setError(updErr.message)
        return { entry: null, error: updErr.message }
      }
      if (data) {
        const mapped = rowToEntry(data as Record<string, unknown>, brandId)
        setItems((cur) => cur.map((e) => (e.id === id ? mapped : e)))
        return { entry: mapped }
      }
      return { entry: merged }
    },
    [brandId, brandSlug],
  )

  return { items, loading, error, reload, create, update }
}
