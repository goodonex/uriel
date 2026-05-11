import { useCallback, useEffect, useRef, useState } from 'react'
import { generateId, loadList, saveList } from '../lib/storage'
import {
  isMissingSupabaseTableError,
  shouldFallbackToLocalSupabase,
  supabaseErrorMessage,
} from '../lib/supabaseErrors'
import { supabase } from '../lib/supabase'
import type { ContentIdea } from '../types/db'
import { useBrandId } from './useBrandId'

const IDEAS_KEY = 'content-ideas-store' as const

function rowToIdea(row: Record<string, unknown>): ContentIdea {
  return {
    id: row.id as string,
    brand_id: row.brand_id as string,
    title: (row.title as string) ?? '',
    hook: (row.hook as string) ?? '',
    a_roll: (row.a_roll as string) ?? '',
    b_roll: (row.b_roll as string) ?? '',
    skript: (row.skript as string) ?? '',
    format: (row.format as string) ?? 'post',
    kanal: (row.kanal as string) ?? 'linkedin',
    status: (row.status as string) ?? 'idee',
    woche: typeof row.woche === 'number' ? row.woche : row.woche == null ? null : Number(row.woche),
    created_at: (row.created_at as string) ?? new Date().toISOString(),
  }
}

function shouldUseLocalIdeas(brandSlug: string | undefined, brandId: string | null): boolean {
  return !brandSlug || !supabase || !brandId
}

export function useContentIdeas(brandSlug: string | undefined) {
  const brandId = useBrandId(brandSlug)
  const [items, setItems] = useState<ContentIdea[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const itemsRef = useRef<ContentIdea[]>([])
  itemsRef.current = items

  const persistLocal = useCallback(
    (next: ContentIdea[]) => {
      if (!brandSlug) return
      saveList([brandSlug, IDEAS_KEY], next)
    },
    [brandSlug],
  )

  const loadLocal = useCallback(() => {
    if (!brandSlug) return
    setItems(loadList<ContentIdea>([brandSlug, IDEAS_KEY]))
    setError(null)
  }, [brandSlug])

  const reload = useCallback(async () => {
    if (!brandSlug) {
      setItems([])
      setLoading(false)
      setError(null)
      return
    }
    if (shouldUseLocalIdeas(brandSlug, brandId)) {
      loadLocal()
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error: err } = await supabase!
      .from('content_ideas')
      .select('*')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false })

    if (err) {
      if (
        isMissingSupabaseTableError(err.message) ||
        shouldFallbackToLocalSupabase(err.message)
      ) {
        loadLocal()
        setError(null)
      } else {
        setError(err.message)
        setItems([])
      }
      setLoading(false)
      return
    }
    setItems((data ?? []).map((r) => rowToIdea(r as Record<string, unknown>)))
    setError(null)
    setLoading(false)
  }, [brandId, brandSlug, loadLocal])

  useEffect(() => {
    void reload()
  }, [reload])

  const create = useCallback(
    async (partial?: Partial<Omit<ContentIdea, 'id' | 'brand_id' | 'created_at'>>) => {
      if (!brandSlug) throw new Error('Kein Brand')
      const id = generateId()
      const now = new Date().toISOString()
      const row: ContentIdea = {
        id,
        brand_id: brandSlug,
        title: partial?.title ?? '',
        hook: partial?.hook ?? '',
        a_roll: partial?.a_roll ?? '',
        b_roll: partial?.b_roll ?? '',
        skript: partial?.skript ?? '',
        format: partial?.format ?? 'post',
        kanal: partial?.kanal ?? 'linkedin',
        status: partial?.status ?? 'idee',
        woche: partial?.woche ?? null,
        created_at: now,
      }
      if (!supabase || !brandId) {
        const next = [row, ...itemsRef.current]
        setItems(next)
        persistLocal(next)
        return id
      }
      const { error: insErr } = await supabase.from('content_ideas').insert({
        ...row,
        brand_id: brandId,
      })
      if (insErr) {
        const msg = supabaseErrorMessage(insErr)
        if (shouldFallbackToLocalSupabase(msg)) {
          const next = [row, ...itemsRef.current]
          setItems(next)
          persistLocal(next)
          return id
        }
        throw insErr
      }
      await reload()
      return id
    },
    [brandId, brandSlug, persistLocal, reload],
  )

  const update = useCallback(
    async (id: string, patch: Partial<Omit<ContentIdea, 'id' | 'brand_id' | 'created_at'>>) => {
      if (!brandSlug) return
      if (!supabase || !brandId) {
        const next = itemsRef.current.map((it) => (it.id === id ? { ...it, ...patch } : it))
        setItems(next)
        persistLocal(next)
        return
      }
      const { error: err } = await supabase
        .from('content_ideas')
        .update(patch)
        .eq('id', id)
        .eq('brand_id', brandId)
      if (err) {
        const msg = supabaseErrorMessage(err)
        if (shouldFallbackToLocalSupabase(msg)) {
          const next = itemsRef.current.map((it) => (it.id === id ? { ...it, ...patch } : it))
          setItems(next)
          persistLocal(next)
          return
        }
        throw err
      }
      await reload()
    },
    [brandId, brandSlug, persistLocal, reload],
  )

  const remove = useCallback(
    async (id: string) => {
      if (!brandSlug) return
      if (!supabase || !brandId) {
        const next = itemsRef.current.filter((it) => it.id !== id)
        setItems(next)
        persistLocal(next)
        return
      }
      const { error: err } = await supabase
        .from('content_ideas')
        .delete()
        .eq('id', id)
        .eq('brand_id', brandId)
      if (err) {
        const msg = supabaseErrorMessage(err)
        if (shouldFallbackToLocalSupabase(msg)) {
          const next = itemsRef.current.filter((it) => it.id !== id)
          setItems(next)
          persistLocal(next)
          return
        }
        throw err
      }
      await reload()
    },
    [brandId, brandSlug, persistLocal, reload],
  )

  return { items, loading, error, reload, create, update, remove }
}
