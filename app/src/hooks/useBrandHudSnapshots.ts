import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface BrandHudCounts {
  pipeline: number | null
  content: number | null
  projects: number | null
}

function startOfMonthIso(): string {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString()
}

/** Live-Mini-Stats pro Brand (Kontakte, Content im Monat, offene Deliver-Projekte). */
export function useBrandHudSnapshots(
  slugToId: Readonly<Record<string, string | undefined>>,
): Record<string, BrandHudCounts> {
  const depsKey = useMemo(
    () =>
      Object.keys(slugToId)
        .sort()
        .map((k) => `${k}:${slugToId[k] ?? ''}`)
        .join('|'),
    [slugToId],
  )

  const [counts, setCounts] = useState<Record<string, BrandHudCounts>>({})

  useEffect(() => {
    const client = supabase
    if (!client || !depsKey) {
      setCounts({})
      return
    }

    const slugs = Object.entries(slugToId)
      .filter(([, id]) => Boolean(id))
      .map(([slug]) => slug)

    if (slugs.length === 0) {
      setCounts({})
      return
    }

    let cancelled = false
    const monthStart = startOfMonthIso()

    void (async () => {
      const next: Record<string, BrandHudCounts> = {}
      await Promise.all(
        slugs.map(async (slug) => {
          const brandId = slugToId[slug]
          if (!brandId) return

          const [pipe, content, proj] = await Promise.all([
            client
              .from('contacts')
              .select('*', { count: 'exact', head: true })
              .eq('brand_id', brandId),
            client
              .from('content_pieces')
              .select('*', { count: 'exact', head: true })
              .eq('brand_id', brandId)
              .gte('updated_at', monthStart),
            client
              .from('deliver_projects')
              .select('*', { count: 'exact', head: true })
              .eq('owner_brand_id', brandId)
              .neq('status', 'completed'),
          ])

          if (cancelled) return
          next[slug] = {
            pipeline: pipe.error ? null : (pipe.count ?? 0),
            content: content.error ? null : (content.count ?? 0),
            projects: proj.error ? null : (proj.count ?? 0),
          }
        }),
      )
      if (!cancelled) setCounts(next)
    })()

    return () => {
      cancelled = true
    }
  }, [depsKey, slugToId])

  return counts
}
