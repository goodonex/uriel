import { useCallback, useEffect, useRef, useState } from 'react'
import { generateId, loadList, saveList } from '../lib/storage'
import { isMissingSupabaseTableError } from '../lib/supabaseErrors'
import { supabase } from '../lib/supabase'
import type {
  ContentChannel,
  ContentFormat,
  ContentGoal,
  ContentPiece,
} from '../types/db'
import { useBrandId } from './useBrandId'

const EMPTY_DOC: Record<string, unknown> = {
  type: 'doc',
  content: [],
}

function defaultTags(): ContentPiece['tags'] {
  return {
    icp_ids: [],
    cluster_tags: [],
    format: 'post' as ContentFormat,
    channel: 'linkedin' as ContentChannel,
    goal: 'awareness' as ContentGoal,
  }
}

function defaultPerformanceManual(): ContentPiece['performance_manual'] {
  return {
    impressions: null,
    engagements: null,
    leads: null,
    notes: '',
    updated_at: null,
  }
}

function defaultPerformanceApi(): ContentPiece['performance_api'] {
  return {
    instagram_last_sync_at: null,
    linkedin_last_sync_at: null,
    instagram_metrics_json: null,
    linkedin_metrics_json: null,
  }
}

interface UseContentPiecesResult {
  items: ContentPiece[]
  loading: boolean
  error: string | null
  create: (
    partial?: Partial<Omit<ContentPiece, 'id' | 'brand_id' | 'updated_at'>>,
  ) => ContentPiece
  update: (
    id: string,
    patch: Partial<Omit<ContentPiece, 'id' | 'brand_id'>>,
  ) => void
  remove: (id: string) => void
}

function rowToPiece(row: Record<string, unknown>): ContentPiece {
  const sched = row.scheduled_at as string
  return {
    id: row.id as string,
    brand_id: row.brand_id as string,
    title: row.title as string,
    content: (row.content as Record<string, unknown>) ?? EMPTY_DOC,
    scheduled_at: typeof sched === 'string' ? sched.slice(0, 10) : String(sched),
    published_at: (row.published_at as string | null) ?? null,
    campaign_id: (row.campaign_id as string | null) ?? null,
    tags: { ...defaultTags(), ...(row.tags as object as ContentPiece['tags']) },
    performance_manual: {
      ...defaultPerformanceManual(),
      ...(row.performance_manual as object as ContentPiece['performance_manual']),
    },
    performance_api: {
      ...defaultPerformanceApi(),
      ...(row.performance_api as object as ContentPiece['performance_api']),
    },
    updated_at: row.updated_at as string,
  }
}

function pieceToRow(p: ContentPiece): Record<string, unknown> {
  return {
    id: p.id,
    brand_id: p.brand_id,
    title: p.title,
    content: p.content,
    scheduled_at: p.scheduled_at.slice(0, 10),
    published_at: p.published_at,
    campaign_id: p.campaign_id,
    tags: p.tags,
    performance_manual: p.performance_manual,
    performance_api: p.performance_api,
    updated_at: p.updated_at,
  }
}

const STORAGE_KEY = 'content-pieces' as const

export function useContentPieces(
  brandSlug: string | undefined,
): UseContentPiecesResult {
  const brandId = useBrandId(brandSlug)
  const [items, setItems] = useState<ContentPiece[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const itemsRef = useRef<ContentPiece[]>([])
  itemsRef.current = items
  const localOnlyRef = useRef(false)

  const loadLocal = useCallback(() => {
    if (!brandSlug) return
    setItems(loadList<ContentPiece>([brandSlug, STORAGE_KEY]))
    setError(null)
  }, [brandSlug])

  const persistLocal = useCallback(
    (next: ContentPiece[]) => {
      if (!brandSlug) return
      saveList([brandSlug, STORAGE_KEY], next)
    },
    [brandSlug],
  )

  const reload = useCallback(async () => {
    if (!brandSlug) {
      setItems([])
      setLoading(false)
      setError(null)
      return
    }
    if (!supabase || !brandId) {
      localOnlyRef.current = true
      loadLocal()
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error: err } = await supabase
      .from('content_pieces')
      .select('*')
      .eq('brand_id', brandId)
      .order('scheduled_at', { ascending: true })

    if (err && isMissingSupabaseTableError(err.message)) {
      console.warn('[useContentPieces] → localStorage', err.message)
      localOnlyRef.current = true
      loadLocal()
      setLoading(false)
      return
    }
    if (err) {
      setError(err.message)
      setItems([])
      setLoading(false)
      return
    }
    localOnlyRef.current = false
    setError(null)
    setItems((data ?? []).map(rowToPiece))
    setLoading(false)
  }, [brandId, brandSlug, loadLocal])

  useEffect(() => {
    void reload()
  }, [reload])

  const create = useCallback(
    (
      partial?: Partial<Omit<ContentPiece, 'id' | 'brand_id' | 'updated_at'>>,
    ): ContentPiece => {
      if (!brandSlug) throw new Error('Kein Brand-Slug')
      const now = new Date().toISOString()
      const today = now.slice(0, 10)
      const item: ContentPiece = {
        id: generateId(),
        brand_id: localOnlyRef.current ? brandSlug : (brandId ?? brandSlug),
        title: partial?.title ?? 'Neues Content-Piece',
        content: partial?.content ?? EMPTY_DOC,
        scheduled_at: partial?.scheduled_at ?? today,
        published_at: partial?.published_at ?? null,
        campaign_id: partial?.campaign_id ?? null,
        tags: partial?.tags ?? defaultTags(),
        performance_manual:
          partial?.performance_manual ?? defaultPerformanceManual(),
        performance_api: partial?.performance_api ?? defaultPerformanceApi(),
        updated_at: now,
      }
      if (localOnlyRef.current || !supabase || !brandId) {
        const next = [...itemsRef.current, item]
        setItems(next)
        persistLocal(next)
        return item
      }
      const row = pieceToRow({ ...item, brand_id: brandId })
      setItems([...itemsRef.current, item])
      void supabase.from('content_pieces').insert(row).then(({ error: err }) => {
        if (err) {
          if (isMissingSupabaseTableError(err.message)) {
            localOnlyRef.current = true
            const next = [...itemsRef.current, item]
            persistLocal(next)
            setItems(next)
          } else {
            setError(err.message)
            void reload()
          }
        }
      })
      return item
    },
    [brandId, brandSlug, persistLocal, reload],
  )

  const update = useCallback(
    (id: string, patch: Partial<Omit<ContentPiece, 'id' | 'brand_id'>>) => {
      if (!brandSlug) return
      const now = new Date().toISOString()
      const next = itemsRef.current.map((p) =>
        p.id === id ? { ...p, ...patch, updated_at: now } : p,
      )
      setItems(next)
      if (localOnlyRef.current || !supabase || !brandId) {
        persistLocal(next)
        return
      }
      const merged = next.find((p) => p.id === id)
      if (!merged) return
      void supabase
        .from('content_pieces')
        .update(pieceToRow({ ...merged, brand_id: brandId }))
        .eq('id', id)
        .eq('brand_id', brandId)
        .then(({ error: err }) => {
          if (err) {
            if (isMissingSupabaseTableError(err.message)) {
              localOnlyRef.current = true
              persistLocal(next)
            } else {
              setError(err.message)
              void reload()
            }
          }
        })
    },
    [brandId, brandSlug, persistLocal, reload],
  )

  const remove = useCallback(
    (id: string) => {
      if (!brandSlug) return
      const next = itemsRef.current.filter((p) => p.id !== id)
      setItems(next)
      if (localOnlyRef.current || !supabase || !brandId) {
        persistLocal(next)
        return
      }
      void supabase
        .from('content_pieces')
        .delete()
        .eq('id', id)
        .eq('brand_id', brandId)
        .then(({ error: err }) => {
          if (err) {
            if (isMissingSupabaseTableError(err.message)) {
              localOnlyRef.current = true
              persistLocal(next)
            } else {
              setError(err.message)
              void reload()
            }
          }
        })
    },
    [brandId, brandSlug, persistLocal, reload],
  )

  return { items, loading, error, create, update, remove }
}
