import { useCallback, useEffect, useRef, useState } from 'react'
import { generateId, loadList, saveList } from '../lib/storage'
import type {
  ContentChannel,
  ContentFormat,
  ContentGoal,
  ContentPiece,
} from '../types/db'

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

export function useContentPieces(
  brandSlug: string | undefined,
): UseContentPiecesResult {
  const [items, setItems] = useState<ContentPiece[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const itemsRef = useRef<ContentPiece[]>([])
  itemsRef.current = items

  useEffect(() => {
    if (!brandSlug) {
      setItems([])
      setLoading(false)
      return
    }
    setLoading(true)
    const timer = window.setTimeout(() => {
      try {
        setItems(loadList<ContentPiece>([brandSlug, 'content-pieces']))
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unbekannter Fehler')
      } finally {
        setLoading(false)
      }
    }, 80)
    return () => window.clearTimeout(timer)
  }, [brandSlug])

  const persist = useCallback(
    (next: ContentPiece[]) => {
      if (!brandSlug) return
      saveList([brandSlug, 'content-pieces'], next)
    },
    [brandSlug],
  )

  const create = useCallback(
    (
      partial?: Partial<Omit<ContentPiece, 'id' | 'brand_id' | 'updated_at'>>,
    ): ContentPiece => {
      const now = new Date().toISOString()
      const today = now.slice(0, 10)
      const item: ContentPiece = {
        id: generateId(),
        brand_id: brandSlug ?? 'unknown',
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
      const next = [...itemsRef.current, item]
      setItems(next)
      persist(next)
      return item
    },
    [brandSlug, persist],
  )

  const update = useCallback(
    (id: string, patch: Partial<Omit<ContentPiece, 'id' | 'brand_id'>>) => {
      const next = itemsRef.current.map((p) =>
        p.id === id
          ? { ...p, ...patch, updated_at: new Date().toISOString() }
          : p,
      )
      setItems(next)
      persist(next)
    },
    [persist],
  )

  const remove = useCallback(
    (id: string) => {
      const next = itemsRef.current.filter((p) => p.id !== id)
      setItems(next)
      persist(next)
    },
    [persist],
  )

  return { items, loading, error, create, update, remove }
}
