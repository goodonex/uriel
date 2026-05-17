import { useCallback, useState } from 'react'
import { hashContent, hashFunnelGraph } from '../lib/contentHash'
import { supabase } from '../lib/supabase'
import type { FunnelEdgeRow, FunnelNodeRow } from '../types/funnel'
import type { SwarmActualOutcome, SwarmMode, SwarmPredictionResult } from '../types/swarm'
import { useBrandId } from './useBrandId'

export interface SwarmPredictionRow {
  id: string
  brand_id: string
  mode: SwarmMode
  subject_ref: string | null
  funnel_id: string | null
  prediction: SwarmPredictionResult
  actual_outcome: SwarmActualOutcome | null
  created_at: string
}

function rowToPrediction(row: Record<string, unknown>): SwarmPredictionRow {
  return {
    id: row.id as string,
    brand_id: row.brand_id as string,
    mode: row.mode as SwarmMode,
    subject_ref: (row.subject_ref as string | null) ?? null,
    funnel_id: (row.funnel_id as string | null) ?? null,
    prediction: row.prediction as SwarmPredictionResult,
    actual_outcome: (row.actual_outcome as SwarmActualOutcome | null) ?? null,
    created_at: row.created_at as string,
  }
}

export function useSwarmPrediction(brandSlug: string | undefined) {
  const brandId = useBrandId(brandSlug)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchCached = useCallback(
    async (opts: {
      mode: SwarmMode
      subjectRef?: string
      funnelId?: string
    }): Promise<SwarmPredictionRow | null> => {
      if (!supabase || !brandId) return null
      let q = supabase
        .from('swarm_predictions')
        .select('*')
        .eq('brand_id', brandId)
        .eq('mode', opts.mode)
        .order('created_at', { ascending: false })
        .limit(1)

      if (opts.subjectRef) {
        q = q.eq('subject_ref', opts.subjectRef)
      }
      if (opts.funnelId) {
        q = q.eq('funnel_id', opts.funnelId)
      }

      const { data, error: qErr } = await q.maybeSingle()
      if (qErr || !data) return null
      return rowToPrediction(data as Record<string, unknown>)
    },
    [brandId],
  )

  const runContentSwarm = useCallback(
    async (
      content: string,
      contentType: string,
    ): Promise<SwarmPredictionRow | null> => {
      if (!supabase || !brandId) {
        setError('Supabase nicht verfügbar')
        return null
      }
      const subjectRef = hashContent(content.trim())
      const cached = await fetchCached({ mode: 'content', subjectRef })
      if (cached) return cached

      setLoading(true)
      setError(null)
      try {
        const { data, error: fnErr } = await supabase.functions.invoke('icp-swarm', {
          body: {
            brandId,
            mode: 'content',
            payload: { content, contentType },
          },
        })
        if (fnErr) throw new Error(fnErr.message)
        const res = data as { ok?: boolean; prediction?: SwarmPredictionResult; message?: string }
        if (!res?.ok || !res.prediction) {
          throw new Error(res.message ?? 'Schwarm-Call fehlgeschlagen')
        }

        const ins = {
          brand_id: brandId,
          mode: 'content' as const,
          subject_ref: subjectRef,
          funnel_id: null,
          prediction: res.prediction,
        }
        const { data: row, error: insErr } = await supabase
          .from('swarm_predictions')
          .insert(ins)
          .select('*')
          .single()
        if (insErr) throw new Error(insErr.message)
        return rowToPrediction(row as Record<string, unknown>)
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Schwarm-Call fehlgeschlagen'
        setError(msg)
        return null
      } finally {
        setLoading(false)
      }
    },
    [brandId, fetchCached],
  )

  const runFunnelSwarm = useCallback(
    async (
      funnelId: string,
      nodes: FunnelNodeRow[],
      edges: FunnelEdgePayload[],
    ): Promise<SwarmPredictionRow | null> => {
      if (!supabase || !brandId) {
        setError('Supabase nicht verfügbar')
        return null
      }
      const graphHash = hashFunnelGraph(
        nodes.map((n) => ({
          id: n.id,
          type: n.type,
          label: n.label,
          config: n.config,
        })),
        edges.map((e) => ({
          source_node_id: e.source_node_id,
          target_node_id: e.target_node_id,
          variant: e.variant,
        })),
      )
      const subjectRef = `${funnelId}:${graphHash}`

      const cached = await fetchCached({
        mode: 'funnel',
        subjectRef,
        funnelId,
      })
      if (cached) return cached

      setLoading(true)
      setError(null)
      try {
        const { data, error: fnErr } = await supabase.functions.invoke('icp-swarm', {
          body: {
            brandId,
            mode: 'funnel',
            payload: {
              funnelNodes: nodes.map((n) => ({
                id: n.id,
                type: n.type,
                label: n.label,
                config: n.config as Record<string, unknown>,
              })),
              funnelEdges: edges.map((e) => ({
                source_node_id: e.source_node_id,
                target_node_id: e.target_node_id,
                label: e.label,
                variant: e.variant,
              })),
            },
          },
        })
        if (fnErr) throw new Error(fnErr.message)
        const res = data as { ok?: boolean; prediction?: SwarmPredictionResult; message?: string }
        if (!res?.ok || !res.prediction) {
          throw new Error(res.message ?? 'Schwarm-Call fehlgeschlagen')
        }

        const ins = {
          brand_id: brandId,
          mode: 'funnel' as const,
          subject_ref: subjectRef,
          funnel_id: funnelId,
          prediction: res.prediction,
        }
        const { data: row, error: insErr } = await supabase
          .from('swarm_predictions')
          .insert(ins)
          .select('*')
          .single()
        if (insErr) throw new Error(insErr.message)
        return rowToPrediction(row as Record<string, unknown>)
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Schwarm-Call fehlgeschlagen'
        setError(msg)
        return null
      } finally {
        setLoading(false)
      }
    },
    [brandId, fetchCached],
  )

  const recordActualOutcome = useCallback(
    async (predictionId: string, actualData: SwarmActualOutcome): Promise<boolean> => {
      if (!supabase || !brandId) return false
      const { error: updErr } = await supabase
        .from('swarm_predictions')
        .update({ actual_outcome: actualData })
        .eq('id', predictionId)
        .eq('brand_id', brandId)
      if (updErr) {
        setError(updErr.message)
        return false
      }
      return true
    },
    [brandId],
  )

  const loadFunnelPrediction = useCallback(
    async (funnelId: string): Promise<SwarmPredictionRow | null> => {
      if (!supabase || !brandId) return null
      const { data } = await supabase
        .from('swarm_predictions')
        .select('*')
        .eq('brand_id', brandId)
        .eq('mode', 'funnel')
        .eq('funnel_id', funnelId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (!data) return null
      return rowToPrediction(data as Record<string, unknown>)
    },
    [brandId],
  )

  return {
    loading,
    error,
    runContentSwarm,
    runFunnelSwarm,
    recordActualOutcome,
    loadFunnelPrediction,
    fetchCached,
  }
}

type FunnelEdgePayload = Pick<
  FunnelEdgeRow,
  'source_node_id' | 'target_node_id' | 'label' | 'variant'
>
