/**
 * useFunnelCanvas — Funnels, Nodes, Edges (Supabase + localStorage-Fallback).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { generateId, loadList, saveList } from '../lib/storage'
import { isMissingSupabaseTableError } from '../lib/supabaseErrors'
import { supabase } from '../lib/supabase'
import type { FunnelEdgeRow, FunnelNodeRow, FunnelRow } from '../types/funnel'
import type { AdCampaign, Contact } from '../types/db'
import { computeFunnelEconomics, type FunnelEconomics } from '../lib/funnelEconomics'
import type { PromoPerformanceRow } from './usePromoPerformance'
import { useBrandId } from './useBrandId'

export type { FunnelEconomics }
export { computeFunnelEconomics }

export function buildFunnelEconomicsMap(
  funnels: FunnelRow[],
  nodes: FunnelNodeRow[],
  contacts: Contact[],
  campaigns: AdCampaign[],
  performance: PromoPerformanceRow[],
): Map<string, FunnelEconomics> {
  const map = new Map<string, FunnelEconomics>()
  for (const f of funnels) {
    map.set(
      f.id,
      computeFunnelEconomics(f.id, nodes, contacts, campaigns, performance),
    )
  }
  return map
}

const SK_FUNNELS = 'funnels' as const
const SK_NODES = 'funnel-nodes' as const
const SK_EDGES = 'funnel-edges' as const

function nowIso() {
  return new Date().toISOString()
}

function persistLocal(
  slug: string,
  funnels: FunnelRow[],
  nodes: FunnelNodeRow[],
  edges: FunnelEdgeRow[],
) {
  saveList([slug, SK_FUNNELS], funnels)
  saveList([slug, SK_NODES], nodes)
  saveList([slug, SK_EDGES], edges)
}

export interface UseFunnelCanvasResult {
  funnels: FunnelRow[]
  nodes: FunnelNodeRow[]
  edges: FunnelEdgeRow[]
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  createFunnel: (patch?: Partial<Pick<FunnelRow, 'name' | 'description'>>) => Promise<FunnelRow>
  updateFunnel: (id: string, patch: Partial<Pick<FunnelRow, 'name' | 'description'>>) => Promise<void>
  deleteFunnel: (id: string) => Promise<void>
  addNode: (
    funnelId: string,
    patch: Partial<FunnelNodeRow> & Pick<FunnelNodeRow, 'type' | 'label'>,
  ) => Promise<FunnelNodeRow>
  updateNode: (id: string, patch: Partial<FunnelNodeRow>) => Promise<void>
  deleteNode: (id: string) => Promise<void>
  addEdge: (
    funnelId: string,
    sourceId: string,
    targetId: string,
    opts?: { label?: string | null; variant?: string | null },
  ) => Promise<FunnelEdgeRow>
  deleteEdge: (id: string) => Promise<void>
  updateEdge: (id: string, patch: Partial<Pick<FunnelEdgeRow, 'label' | 'variant'>>) => Promise<void>
  getFunnelsForBrand: () => FunnelRow[]
  replaceFunnelGraph: (
    funnelId: string,
    nextNodes: FunnelNodeRow[],
    nextEdges: FunnelEdgeRow[],
  ) => Promise<void>
}

export function useFunnelCanvas(brandSlug: string | undefined): UseFunnelCanvasResult {
  const brandId = useBrandId(brandSlug)
  const [funnels, setFunnels] = useState<FunnelRow[]>([])
  const [nodes, setNodes] = useState<FunnelNodeRow[]>([])
  const [edges, setEdges] = useState<FunnelEdgeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const localOnly = useRef(false)
  const funnelsRef = useRef(funnels)
  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)
  funnelsRef.current = funnels
  nodesRef.current = nodes
  edgesRef.current = edges

  const reload = useCallback(async () => {
    if (!brandSlug) {
      setFunnels([])
      setNodes([])
      setEdges([])
      setLoading(false)
      return
    }
    const lf = loadList<FunnelRow>([brandSlug, SK_FUNNELS])
    const ln = loadList<FunnelNodeRow>([brandSlug, SK_NODES])
    const le = loadList<FunnelEdgeRow>([brandSlug, SK_EDGES])
    if (!supabase || !brandId) {
      localOnly.current = true
      setFunnels(lf)
      setNodes(ln)
      setEdges(le)
      setLoading(false)
      return
    }
    setLoading(true)
    const fr = await supabase
      .from('funnels')
      .select('*')
      .eq('brand_id', brandId)
      .order('updated_at', { ascending: false })

    if (fr.error) {
      if (isMissingSupabaseTableError(fr.error.message)) {
        localOnly.current = true
        setFunnels(lf)
        setNodes(ln)
        setEdges(le)
      } else {
        setError(fr.error.message)
      }
      setLoading(false)
      return
    }
    localOnly.current = false
    const funnelRows = (fr.data ?? []) as FunnelRow[]
    setFunnels(funnelRows)

    const funnelIds = funnelRows.map((f) => f.id)
    if (funnelIds.length === 0) {
      setNodes([])
      setEdges([])
      setError(null)
      setLoading(false)
      return
    }

    const nodesQ = await supabase
      .from('funnel_nodes')
      .select('*')
      .in('funnel_id', funnelIds)
    const edgesQ = await supabase
      .from('funnel_edges')
      .select('*')
      .in('funnel_id', funnelIds)

    if (nodesQ.error || edgesQ.error) {
      const msg = nodesQ.error?.message ?? edgesQ.error?.message ?? ''
      if (isMissingSupabaseTableError(msg)) {
        localOnly.current = true
        setNodes(ln)
        setEdges(le)
      } else {
        setError(msg)
      }
      setLoading(false)
      return
    }
    setNodes((nodesQ.data ?? []) as FunnelNodeRow[])
    setEdges((edgesQ.data ?? []) as FunnelEdgeRow[])
    setError(null)
    setLoading(false)
  }, [brandSlug, brandId])

  useEffect(() => {
    void reload()
  }, [reload])

  const getFunnelsForBrand = useCallback(() => funnels, [funnels])

  const createFunnel = useCallback(
    async (patch: Partial<Pick<FunnelRow, 'name' | 'description'>> = {}): Promise<FunnelRow> => {
      if (!brandSlug) throw new Error('brand_slug missing')
      const id = generateId()
      const row: FunnelRow = {
        id,
        brand_id: localOnly.current ? brandSlug : (brandId ?? brandSlug),
        name: patch.name ?? 'Neuer Funnel',
        description: patch.description ?? null,
        created_at: nowIso(),
        updated_at: nowIso(),
      }
      setFunnels((cur) => {
        const next = [row, ...cur]
        if (localOnly.current || !supabase || !brandId) {
          persistLocal(brandSlug, next, nodesRef.current, edgesRef.current)
        }
        return next
      })
      if (localOnly.current || !supabase || !brandId) {
        return row
      }
      const ins = {
        id: row.id,
        brand_id: brandId,
        name: row.name,
        description: row.description,
      }
      const { error: insErr } = await supabase.from('funnels').insert(ins)
      if (insErr) setError(insErr.message)
      return row
    },
    [brandId, brandSlug],
  )

  const updateFunnel = useCallback(
    async (id: string, patch: Partial<Pick<FunnelRow, 'name' | 'description'>>) => {
      if (!brandSlug) return
      setFunnels((cur) => {
        const nextF = cur.map((f) => (f.id === id ? { ...f, ...patch, updated_at: nowIso() } : f))
        if (localOnly.current || !supabase || !brandId) {
          persistLocal(brandSlug, nextF, nodesRef.current, edgesRef.current)
        }
        return nextF
      })
      if (localOnly.current || !supabase || !brandId) {
        return
      }
      const { error: e } = await supabase
        .from('funnels')
        .update({ ...patch, updated_at: nowIso() })
        .eq('id', id)
        .eq('brand_id', brandId)
      if (e) setError(e.message)
    },
    [brandId, brandSlug],
  )

  const deleteFunnel = useCallback(
    async (id: string) => {
      if (!brandSlug) return
      const nextF = funnelsRef.current.filter((f) => f.id !== id)
      const nextN = nodesRef.current.filter((n) => n.funnel_id !== id)
      const nextE = edgesRef.current.filter((e) => e.funnel_id !== id)
      setFunnels(nextF)
      setNodes(nextN)
      setEdges(nextE)
      if (localOnly.current || !supabase || !brandId) {
        persistLocal(brandSlug, nextF, nextN, nextE)
        return
      }
      const { error: e } = await supabase.from('funnels').delete().eq('id', id).eq('brand_id', brandId)
      if (e) setError(e.message)
    },
    [brandId, brandSlug],
  )

  const addNode = useCallback(
    async (
      funnelId: string,
      patch: Partial<FunnelNodeRow> & Pick<FunnelNodeRow, 'type' | 'label'>,
    ): Promise<FunnelNodeRow> => {
      if (!brandSlug) throw new Error('brand_slug missing')
      const id = generateId()
      const row: FunnelNodeRow = {
        id,
        funnel_id: funnelId,
        type: patch.type,
        label: patch.label,
        position_x: patch.position_x ?? 0,
        position_y: patch.position_y ?? 0,
        config: patch.config ?? {},
        created_at: nowIso(),
      }
      setNodes((cur) => {
        const nextN = [...cur, row]
        if (localOnly.current || !supabase) {
          persistLocal(brandSlug, funnelsRef.current, nextN, edgesRef.current)
        }
        return nextN
      })
      if (localOnly.current || !supabase) {
        return row
      }
      const { error: insErr } = await supabase.from('funnel_nodes').insert({
        id: row.id,
        funnel_id: row.funnel_id,
        type: row.type,
        label: row.label,
        position_x: row.position_x,
        position_y: row.position_y,
        config: row.config,
      })
      if (insErr) setError(insErr.message)
      return row
    },
    [brandSlug],
  )

  const updateNode = useCallback(
    async (id: string, patch: Partial<FunnelNodeRow>) => {
      if (!brandSlug) return
      setNodes((cur) => {
        const nextN = cur.map((n) => (n.id === id ? { ...n, ...patch, config: patch.config ?? n.config } : n))
        if (localOnly.current || !supabase) {
          persistLocal(brandSlug, funnelsRef.current, nextN, edgesRef.current)
        }
        return nextN
      })
      if (localOnly.current || !supabase) {
        return
      }
      const up: Record<string, unknown> = {}
      if (patch.label !== undefined) up.label = patch.label
      if (patch.position_x !== undefined) up.position_x = patch.position_x
      if (patch.position_y !== undefined) up.position_y = patch.position_y
      if (patch.config !== undefined) up.config = patch.config
      if (patch.type !== undefined) up.type = patch.type
      const { error: e } = await supabase.from('funnel_nodes').update(up).eq('id', id)
      if (e) setError(e.message)
    },
    [brandSlug],
  )

  const deleteNode = useCallback(
    async (id: string) => {
      if (!brandSlug) return
      const nextN = nodesRef.current.filter((n) => n.id !== id)
      const nextE = edgesRef.current.filter((e) => e.source_node_id !== id && e.target_node_id !== id)
      setNodes(nextN)
      setEdges(nextE)
      if (localOnly.current || !supabase) {
        persistLocal(brandSlug, funnelsRef.current, nextN, nextE)
        return
      }
      await supabase.from('funnel_nodes').delete().eq('id', id)
    },
    [brandSlug],
  )

  const addEdge = useCallback(
    async (
      funnelId: string,
      sourceId: string,
      targetId: string,
      opts: { label?: string | null; variant?: string | null } = {},
    ): Promise<FunnelEdgeRow> => {
      if (!brandSlug) throw new Error('brand_slug missing')
      const id = generateId()
      const row: FunnelEdgeRow = {
        id,
        funnel_id: funnelId,
        source_node_id: sourceId,
        target_node_id: targetId,
        label: opts.label ?? null,
        variant: opts.variant ?? null,
        created_at: nowIso(),
      }
      setEdges((cur) => {
        const nextE = [...cur, row]
        if (localOnly.current || !supabase) {
          persistLocal(brandSlug, funnelsRef.current, nodesRef.current, nextE)
        }
        return nextE
      })
      if (localOnly.current || !supabase) {
        return row
      }
      const { error: insErr } = await supabase.from('funnel_edges').insert({
        id: row.id,
        funnel_id: row.funnel_id,
        source_node_id: row.source_node_id,
        target_node_id: row.target_node_id,
        label: row.label,
        variant: row.variant,
      })
      if (insErr) setError(insErr.message)
      return row
    },
    [brandSlug],
  )

  const deleteEdge = useCallback(
    async (edgeId: string) => {
      if (!brandSlug) return
      setEdges((cur) => {
        const nextE = cur.filter((e) => e.id !== edgeId)
        if (localOnly.current || !supabase) {
          persistLocal(brandSlug, funnelsRef.current, nodesRef.current, nextE)
        }
        return nextE
      })
      if (localOnly.current || !supabase) {
        return
      }
      await supabase.from('funnel_edges').delete().eq('id', edgeId)
    },
    [brandSlug],
  )

  const updateEdge = useCallback(
    async (edgeId: string, patch: Partial<Pick<FunnelEdgeRow, 'label' | 'variant'>>) => {
      if (!brandSlug) return
      setEdges((cur) => {
        const nextE = cur.map((e) => (e.id === edgeId ? { ...e, ...patch } : e))
        if (localOnly.current || !supabase) {
          persistLocal(brandSlug, funnelsRef.current, nodesRef.current, nextE)
        }
        return nextE
      })
      if (localOnly.current || !supabase) return
      const { error: e } = await supabase.from('funnel_edges').update(patch).eq('id', edgeId)
      if (e) setError(e.message)
    },
    [brandSlug],
  )

  const replaceFunnelGraph = useCallback(
    async (funnelId: string, nextNodes: FunnelNodeRow[], nextEdges: FunnelEdgeRow[]) => {
      if (!brandSlug) return
      const otherN = nodesRef.current.filter((n) => n.funnel_id !== funnelId)
      const otherE = edgesRef.current.filter((e) => e.funnel_id !== funnelId)
      const mergedN = [...otherN, ...nextNodes]
      const mergedE = [...otherE, ...nextEdges]
      setNodes(mergedN)
      setEdges(mergedE)
      if (localOnly.current || !supabase) {
        persistLocal(brandSlug, funnelsRef.current, mergedN, mergedE)
        return
      }
      await supabase.from('funnel_edges').delete().eq('funnel_id', funnelId)
      await supabase.from('funnel_nodes').delete().eq('funnel_id', funnelId)
      if (nextNodes.length) {
        await supabase.from('funnel_nodes').insert(
          nextNodes.map((n) => ({
            id: n.id,
            funnel_id: n.funnel_id,
            type: n.type,
            label: n.label,
            position_x: n.position_x,
            position_y: n.position_y,
            config: n.config,
          })),
        )
      }
      if (nextEdges.length) {
        await supabase.from('funnel_edges').insert(
          nextEdges.map((e) => ({
            id: e.id,
            funnel_id: e.funnel_id,
            source_node_id: e.source_node_id,
            target_node_id: e.target_node_id,
            label: e.label,
            variant: e.variant,
          })),
        )
      }
    },
    [brandSlug],
  )

  return {
    funnels,
    nodes,
    edges,
    loading,
    error,
    reload,
    createFunnel,
    updateFunnel,
    deleteFunnel,
    addNode,
    updateNode,
    deleteNode,
    addEdge,
    deleteEdge,
    updateEdge,
    getFunnelsForBrand,
    replaceFunnelGraph,
  }
}
