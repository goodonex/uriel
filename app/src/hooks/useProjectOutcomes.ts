import { useCallback, useEffect, useState } from 'react'
import { computeProjectOutcomes, type ProjectOutcomes } from '../lib/projectOutcomes'
import { supabase } from '../lib/supabase'
import { useBrandId } from './useBrandId'

const EMPTY: ProjectOutcomes = { totalLeads: 0, projectedRevenue: 0 }

export function useProjectOutcomes(
  brandSlug: string | undefined,
  projectId: string | undefined,
) {
  const brandId = useBrandId(brandSlug)
  const [outcomes, setOutcomes] = useState<ProjectOutcomes>(EMPTY)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!projectId || !supabase) {
      setOutcomes(EMPTY)
      setLoading(false)
      return
    }

    setLoading(true)
    let query = supabase
      .from('contacts')
      .select('portal_lead_status, potenzial_betrag')
      .eq('deliver_project_id', projectId)

    if (brandId) {
      query = query.eq('brand_id', brandId)
    }

    const { data, error } = await query

    if (error) {
      setOutcomes(EMPTY)
    } else {
      setOutcomes(computeProjectOutcomes((data ?? []) as Parameters<typeof computeProjectOutcomes>[0]))
    }
    setLoading(false)
  }, [brandId, projectId])

  useEffect(() => {
    void reload()
    const interval = window.setInterval(() => void reload(), 60_000)
    return () => window.clearInterval(interval)
  }, [reload])

  return { outcomes, loading, reload }
}
