/**
 * useSidebarSignals — leichte Notification-Indikatoren je Sidebar-Sektion.
 * Liefert nur was die Sidebar als pulsierender Dot braucht (Phase 9).
 */
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useBrandId } from './useBrandId'

export interface SidebarSignals {
  /** Neue Discovery-Signale (z. B. unread oder kürzlich angekommen). */
  discoveryNew: boolean
  /** Follow-ups heute oder überfällig. */
  salesDue: boolean
  /** Deliver-Projekt hat in letzter Zeit Stage gewechselt. */
  deliverProgress: boolean
}

const EMPTY: SidebarSignals = { discoveryNew: false, salesDue: false, deliverProgress: false }

function startOfTomorrowIso(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 1)
  return d.toISOString()
}

function isoDaysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

export function useSidebarSignals(slug: string | undefined): SidebarSignals {
  const brandId = useBrandId(slug)
  const [signals, setSignals] = useState<SidebarSignals>(EMPTY)

  useEffect(() => {
    if (!supabase || !brandId) {
      setSignals(EMPTY)
      return
    }
    let cancelled = false

    const run = async () => {
      const tomorrowIso = startOfTomorrowIso()
      const sevenDaysAgo = isoDaysAgo(7)

      const [salesRes, discoveryRes, deliverRes] = await Promise.all([
        supabase!
          .from('contacts')
          .select('id', { count: 'exact', head: true })
          .eq('brand_id', brandId)
          .not('next_follow_up_at', 'is', null)
          .lt('next_follow_up_at', tomorrowIso)
          .not('pipeline_stage', 'in', '("deal","paused")'),
        supabase!
          .from('discovery_feed_items')
          .select('id', { count: 'exact', head: true })
          .eq('brand_id', brandId)
          .gte('created_at', isoDaysAgo(3)),
        supabase!
          .from('deliver_projects')
          .select('id', { count: 'exact', head: true })
          .eq('brand_id', brandId)
          .eq('status', 'active')
          .gte('updated_at', sevenDaysAgo),
      ])

      if (cancelled) return
      setSignals({
        salesDue: (salesRes.count ?? 0) > 0,
        discoveryNew: (discoveryRes.count ?? 0) > 0,
        deliverProgress: (deliverRes.count ?? 0) > 0,
      })
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [brandId])

  return signals
}
