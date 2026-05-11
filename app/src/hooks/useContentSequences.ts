import { useCallback, useEffect, useRef, useState } from 'react'
import { generateId, loadList, saveList } from '../lib/storage'
import {
  isMissingSupabaseTableError,
  shouldFallbackToLocalSupabase,
  supabaseErrorMessage,
} from '../lib/supabaseErrors'
import { supabase } from '../lib/supabase'
import type {
  ContentSequence,
  ContentSequencePlanPiece,
  ContentSequencePlanWeek,
} from '../types/db'
import { useBrandId } from './useBrandId'

export type ContentSequenceKind = 'content' | 'email'

function storageKeyForKind(kind: ContentSequenceKind): string {
  return `content-sequences-${kind}`
}

function parsePlan(raw: unknown): ContentSequencePlanWeek[] {
  if (!Array.isArray(raw)) return []
  const out: ContentSequencePlanWeek[] = []
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue
    const o = x as Record<string, unknown>
    const woche = typeof o.woche === 'number' ? o.woche : Number(o.woche)
    const thema = typeof o.thema === 'string' ? o.thema : ''
    const piecesRaw = o.pieces
    const pieces: ContentSequencePlanPiece[] = []
    if (Array.isArray(piecesRaw)) {
      for (const p of piecesRaw) {
        if (!p || typeof p !== 'object') continue
        const pr = p as Record<string, unknown>
        pieces.push({
          format: typeof pr.format === 'string' ? pr.format : 'post',
          titel: typeof pr.titel === 'string' ? pr.titel : '',
          kanal: typeof pr.kanal === 'string' ? pr.kanal : 'linkedin',
        })
      }
    }
    if (Number.isFinite(woche)) {
      out.push({ woche, thema, pieces })
    }
  }
  return out.sort((a, b) => a.woche - b.woche)
}

function rowToSeq(row: Record<string, unknown>): ContentSequence {
  const rawKind = row.sequence_kind
  const sequence_kind: ContentSequenceKind = rawKind === 'email' ? 'email' : 'content'
  return {
    id: row.id as string,
    brand_id: row.brand_id as string,
    name: (row.name as string) ?? '',
    description: (row.description as string) ?? '',
    wochen: typeof row.wochen === 'number' ? row.wochen : Number(row.wochen) || 4,
    plan: parsePlan(row.plan),
    status: (row.status as string) ?? 'aktiv',
    sequence_kind,
    created_at: (row.created_at as string) ?? new Date().toISOString(),
  }
}

function shouldUseLocalSequences(brandSlug: string | undefined, brandId: string | null): boolean {
  return !brandSlug || !supabase || !brandId
}

export function useContentSequences(
  brandSlug: string | undefined,
  opts?: { kind?: ContentSequenceKind },
) {
  const kind: ContentSequenceKind = opts?.kind ?? 'content'
  const brandId = useBrandId(brandSlug)
  const [items, setItems] = useState<ContentSequence[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const itemsRef = useRef<ContentSequence[]>([])
  itemsRef.current = items

  const lsKey = storageKeyForKind(kind)

  const persistLocal = useCallback(
    (next: ContentSequence[]) => {
      if (!brandSlug) return
      saveList([brandSlug, lsKey], next)
    },
    [brandSlug, lsKey],
  )

  const loadLocal = useCallback(() => {
    if (!brandSlug) return
    setItems(loadList<ContentSequence>([brandSlug, lsKey]))
    setError(null)
  }, [brandSlug, lsKey])

  const reload = useCallback(async () => {
    if (!brandSlug) {
      setItems([])
      setLoading(false)
      setError(null)
      return
    }
    if (shouldUseLocalSequences(brandSlug, brandId)) {
      loadLocal()
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error: err } = await supabase!
      .from('content_sequences')
      .select('*')
      .eq('brand_id', brandId)
      .eq('sequence_kind', kind)
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
    setItems((data ?? []).map((r) => rowToSeq(r as Record<string, unknown>)))
    setError(null)
    setLoading(false)
  }, [brandId, brandSlug, kind, loadLocal])

  useEffect(() => {
    void reload()
  }, [reload])

  const create = useCallback(
    async (
      partial?: Partial<
        Pick<ContentSequence, 'name' | 'description' | 'wochen' | 'plan' | 'status' | 'sequence_kind'>
      >,
    ) => {
      if (!brandSlug) throw new Error('Kein Brand')
      const id = generateId()
      const wochen = partial?.wochen ?? 4
      const sequence_kind: ContentSequenceKind =
        partial?.sequence_kind === 'email' || partial?.sequence_kind === 'content'
          ? partial.sequence_kind
          : kind
      const plan: ContentSequencePlanWeek[] =
        partial?.plan ??
        Array.from({ length: wochen }, (_, i) => ({
          woche: i + 1,
          thema: '',
          pieces: [],
        }))
      const now = new Date().toISOString()
      const row: ContentSequence = {
        id,
        brand_id: brandSlug,
        name: partial?.name ?? 'Neue Sequenz',
        description: partial?.description ?? '',
        wochen,
        plan,
        status: partial?.status ?? 'aktiv',
        sequence_kind,
        created_at: now,
      }
      if (!supabase || !brandId) {
        const next = [row, ...itemsRef.current]
        setItems(next)
        persistLocal(next)
        return id
      }
      const { error: insErr } = await supabase.from('content_sequences').insert({
        id,
        brand_id: brandId,
        name: row.name,
        description: row.description,
        wochen,
        plan,
        status: row.status,
        sequence_kind,
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
    [brandId, brandSlug, kind, persistLocal, reload],
  )

  const update = useCallback(
    async (
      id: string,
      patch: Partial<Pick<ContentSequence, 'name' | 'description' | 'wochen' | 'plan' | 'status'>>,
    ) => {
      if (!brandSlug) return
      if (!supabase || !brandId) {
        const next = itemsRef.current.map((it) => (it.id === id ? { ...it, ...patch } : it))
        setItems(next)
        persistLocal(next)
        return
      }
      const { error: err } = await supabase
        .from('content_sequences')
        .update(patch)
        .eq('id', id)
        .eq('brand_id', brandId)
        .eq('sequence_kind', kind)
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
    [brandId, brandSlug, kind, persistLocal, reload],
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
        .from('content_sequences')
        .delete()
        .eq('id', id)
        .eq('brand_id', brandId)
        .eq('sequence_kind', kind)
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
    [brandId, brandSlug, kind, persistLocal, reload],
  )

  return { items, loading, error, reload, create, update, remove, kind }
}
