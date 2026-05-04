import { useCallback, useEffect, useRef, useState } from 'react'
import { generateId } from '../lib/storage'
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

export function useContentPieces(
  brandSlug: string | undefined,
): UseContentPiecesResult {
  const brandId = useBrandId(brandSlug)
  const [items, setItems] = useState<ContentPiece[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const itemsRef = useRef<ContentPiece[]>([])
  itemsRef.current = items

  const reload = useCallback(async () => {
    if (!supabase || !brandId) {
      setItems([])
      setLoading(false)
      setError(null)
      return
    }
    setLoading(true)
    const { data, error: err } = await supabase
      .from('content_pieces')
      .select('*')
      .eq('brand_id', brandId)
      .order('scheduled_at', { ascending: true })
    if (err) {
      setError(err.message)
      setItems([])
    } else {
      setError(null)
      setItems((data ?? []).map(rowToPiece))
    }
    setLoading(false)
  }, [brandId])

  useEffect(() => {
    void reload()
  }, [reload])

  const create = useCallback(
    (
      partial?: Partial<Omit<ContentPiece, 'id' | 'brand_id' | 'updated_at'>>,
    ): ContentPiece => {
      if (!supabase || !brandId) {
        throw new Error('Supabase oder Brand nicht verfügbar')
      }
      const now = new Date().toISOString()
      const today = now.slice(0, 10)
      const item: ContentPiece = {
        id: generateId(),
        brand_id: brandId,
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
      const row = pieceToRow(item)
      setItems([...itemsRef.current, item])
      void supabase.from('content_pieces').insert(row).then(({ error: err }) => {
        if (err) {
          setError(err.message)
          void reload()
        }
      })
      return item
    },
    [brandId, reload],
  )

  const update = useCallback(
    (id: string, patch: Partial<Omit<ContentPiece, 'id' | 'brand_id'>>) => {
      if (!supabase || !brandId) return
      const now = new Date().toISOString()
      const next = itemsRef.current.map((p) =>
        p.id === id ? { ...p, ...patch, updated_at: now } : p,
      )
      setItems(next)
      const merged = next.find((p) => p.id === id)
      if (!merged) return
      void supabase
        .from('content_pieces')
        .update(pieceToRow(merged))
        .eq('id', id)
        .eq('brand_id', brandId)
        .then(({ error: err }) => {
          if (err) {
            setError(err.message)
            void reload()
          }
        })
    },
    [brandId, reload],
  )

  const remove = useCallback(
    (id: string) => {
      if (!supabase || !brandId) return
      const next = itemsRef.current.filter((p) => p.id !== id)
      setItems(next)
      void supabase
        .from('content_pieces')
        .delete()
        .eq('id', id)
        .eq('brand_id', brandId)
        .then(({ error: err }) => {
          if (err) {
            setError(err.message)
            void reload()
          }
        })
    },
    [brandId, reload],
  )

  return { items, loading, error, create, update, remove }
}
