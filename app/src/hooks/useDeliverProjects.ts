import { useCallback, useEffect, useRef, useState } from 'react'
import { logActivity } from '../lib/activityLog'
import {
  coerceStoredDeliverItem,
  deliverProjectToInsertRow,
  deliverProjectToUpdateRow,
  emptyTiptapDoc,
  normalizeDeliverProject,
  rowRecordToDeliverProject,
} from '../lib/deliverProjectCoercion'
import { generateId, loadList, saveList } from '../lib/storage'
import { isMissingSupabaseTableError } from '../lib/supabaseErrors'
import { supabase } from '../lib/supabase'
import type { DeliverProject } from '../types/db'
import { useBrandId } from './useBrandId'

interface UseDeliverProjectsResult {
  items: DeliverProject[]
  loading: boolean
  error: string | null
  create: (
    partial?: Partial<Omit<DeliverProject, 'id' | 'brand_id' | 'updated_at'>>,
  ) => DeliverProject
  update: (
    id: string,
    patch: Partial<Omit<DeliverProject, 'id' | 'brand_id'>>,
  ) => void
  remove: (id: string) => void
}

const STORAGE_KEY = 'deliver-projects' as const

function parseDeliverLocalList(brandSlug: string): {
  raw: unknown[]
  items: DeliverProject[]
} {
  const raw = loadList<unknown>([brandSlug, STORAGE_KEY])
  const items = raw
    .map((x) => coerceStoredDeliverItem(x, brandSlug))
    .filter((x): x is DeliverProject => x != null)
  return { raw, items }
}

export function readDeliverProjectsLocal(brandSlug: string): DeliverProject[] {
  return parseDeliverLocalList(brandSlug).items
}

export function useDeliverProjects(brandSlug: string | undefined): UseDeliverProjectsResult {
  const brandId = useBrandId(brandSlug)
  const [items, setItems] = useState<DeliverProject[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const itemsRef = useRef<DeliverProject[]>([])
  itemsRef.current = items
  const localOnlyRef = useRef(false)

  const loadLocal = useCallback(() => {
    if (!brandSlug) return
    const { raw, items: next } = parseDeliverLocalList(brandSlug)
    setItems(next)
    try {
      if (JSON.stringify(raw) !== JSON.stringify(next)) {
        saveList([brandSlug, STORAGE_KEY], next)
      }
    } catch {
      /* ignore */
    }
    setError(null)
  }, [brandSlug])

  const persistLocal = useCallback(
    (next: DeliverProject[]) => {
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
      .from('deliver_projects')
      .select('*')
      .eq('owner_brand_id', brandId)
      .order('updated_at', { ascending: false })

    if (err && isMissingSupabaseTableError(err.message)) {
      console.warn('[useDeliverProjects] → localStorage', err.message)
      localOnlyRef.current = true
      loadLocal()
      setLoading(false)
      return
    }
    if (err) {
      setError(err.message)
      const { items: localRows } = parseDeliverLocalList(brandSlug)
      if (localRows.length > 0) {
        console.warn('[useDeliverProjects] Supabase-Fehler — zeige localStorage')
        localOnlyRef.current = true
        setItems(localRows)
      } else {
        setItems([])
      }
      setLoading(false)
      return
    }
    const serverRows = (data ?? []).map((r) =>
      rowRecordToDeliverProject(r as Record<string, unknown>),
    )
    const { items: localRows } = parseDeliverLocalList(brandSlug)

    if (serverRows.length === 0 && localRows.length > 0) {
      console.warn(
        '[useDeliverProjects] Supabase liefert 0 Zeilen — nutze localStorage (leere DB / RLS / noch nicht migriert).',
      )
      localOnlyRef.current = true
      setItems(localRows)
      setLoading(false)
      return
    }

    localOnlyRef.current = false
    setError(null)
    const byId = new Map<string, DeliverProject>()
    for (const l of localRows) byId.set(l.id, l)
    for (const r of serverRows) byId.set(r.id, r)
    const merged = Array.from(byId.values()).sort((a, b) =>
      b.updated_at.localeCompare(a.updated_at),
    )
    setItems(merged)
    setLoading(false)
  }, [brandId, brandSlug, loadLocal])

  useEffect(() => {
    void reload()
  }, [reload])

  const create = useCallback(
    (
      partial?: Partial<Omit<DeliverProject, 'id' | 'brand_id' | 'updated_at'>>,
    ): DeliverProject => {
      if (!brandSlug) throw new Error('Kein Brand-Slug')
      const now = new Date().toISOString()
      const item = normalizeDeliverProject(
        {
          id: generateId(),
          name: partial?.name ?? 'Neues Projekt',
          client_name: partial?.client_name ?? '',
          client_contact_id: partial?.client_contact_id ?? null,
          status: partial?.status ?? 'active',
          internal_stage: partial?.internal_stage,
          client_stage: partial?.client_stage,
          internal_notes_doc: partial?.internal_notes_doc ?? emptyTiptapDoc(),
          internal_file_links: partial?.internal_file_links,
          team_notes: partial?.team_notes ?? '',
          client_welcome_text: partial?.client_welcome_text ?? '',
          client_documents: partial?.client_documents,
          updated_at: now,
        },
        localOnlyRef.current ? brandSlug : (brandId ?? brandSlug),
      )

      if (localOnlyRef.current || !supabase || !brandId) {
        const next = [...itemsRef.current, item]
        setItems(next)
        persistLocal(next)
        return item
      }

      const row = deliverProjectToInsertRow(item, brandId)
      setItems([...itemsRef.current, item])
      void supabase.from('deliver_projects').insert(row).then(({ error: insErr }) => {
        if (insErr) {
          if (isMissingSupabaseTableError(insErr.message)) {
            localOnlyRef.current = true
            const next = [...itemsRef.current, item]
            persistLocal(next)
            setItems(next)
          } else {
            setError(insErr.message)
            void reload()
          }
        }
      })
      logActivity({
        brand_id: brandId,
        entity_type: 'project',
        entity_id: item.id,
        action: 'created',
        summary: `Neues Projekt: ${item.name}${item.client_name ? ' · ' + item.client_name : ''}`,
        metadata: { stage: item.internal_stage },
      })
      return item
    },
    [brandId, brandSlug, persistLocal, reload],
  )

  const update = useCallback(
    (id: string, patch: Partial<Omit<DeliverProject, 'id' | 'brand_id'>>) => {
      if (!brandSlug) return
      const now = new Date().toISOString()
      const prev = itemsRef.current.find((p) => p.id === id)
      if (!prev) return
      const merged = normalizeDeliverProject({ ...prev, ...patch, updated_at: now }, prev.brand_id)
      const next = itemsRef.current.map((p) => (p.id === id ? merged : p))
      setItems(next)
      if (localOnlyRef.current || !supabase || !brandId) {
        persistLocal(next)
        return
      }
      const row = deliverProjectToUpdateRow(patch, now)
      void supabase
        .from('deliver_projects')
        .update(row)
        .eq('id', id)
        .eq('owner_brand_id', brandId)
        .then(({ error: updErr }) => {
          if (updErr) {
            if (isMissingSupabaseTableError(updErr.message)) {
              localOnlyRef.current = true
              persistLocal(next)
            } else {
              setError(updErr.message)
              void reload()
            }
          }
        })

      if (
        patch.internal_stage &&
        patch.internal_stage !== prev.internal_stage &&
        brandId
      ) {
        logActivity({
          brand_id: brandId,
          entity_type: 'project',
          entity_id: id,
          action: 'stage_changed',
          summary: `${prev.name}: ${prev.internal_stage.replace(/_/g, ' ')} → ${patch.internal_stage.replace(/_/g, ' ')}`,
          metadata: {
            from: prev.internal_stage,
            to: patch.internal_stage,
          },
        })
      }
      if (patch.status && patch.status !== prev.status && brandId) {
        logActivity({
          brand_id: brandId,
          entity_type: 'project',
          entity_id: id,
          action: patch.status === 'completed' ? 'completed' : 'updated',
          summary: `${prev.name} ${patch.status === 'completed' ? 'abgeschlossen' : 'reaktiviert'}`,
        })
      }
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
        .from('deliver_projects')
        .delete()
        .eq('id', id)
        .eq('owner_brand_id', brandId)
        .then(({ error: delErr }) => {
          if (delErr) {
            if (isMissingSupabaseTableError(delErr.message)) {
              localOnlyRef.current = true
              persistLocal(next)
            } else {
              setError(delErr.message)
              void reload()
            }
          }
        })
    },
    [brandId, brandSlug, persistLocal, reload],
  )

  return { items, loading, error, create, update, remove }
}
