import { useCallback, useMemo } from 'react'
import { foundationHealth } from '../lib/foundationHealth'
import type { Contact } from '../types/db'
import { useContacts } from './useContacts'
import { useContentPieces } from './useContentPieces'
import { useDeliverProjects } from './useDeliverProjects'
import { useDiscoveryFeed } from './useDiscoveryFeed'
import { useICPs } from './useICPs'
import { usePositioning } from './usePositioning'
import { useWordBank } from './useWordBank'

export interface MorningBriefData {
  todayFollowUps: Contact[]
  overdueFollowUps: Contact[]
  pipelineUpdates: number
  contentPiecesLive: number
  discoverySignalsNew: number
  foundationHealth: number
  activeProjects: number
  recommendation: string
}

function startOfTodayMs(): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function endOfTodayMs(): number {
  const d = new Date()
  d.setHours(23, 59, 59, 999)
  return d.getTime()
}

function startOfWeekMondayMs(): number {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? 6 : day - 1
  const mon = new Date(now)
  mon.setDate(now.getDate() - diff)
  mon.setHours(0, 0, 0, 0)
  return mon.getTime()
}

export function useMorningBrief(slug: string | undefined) {
  const contacts = useContacts(slug)
  const pieces = useContentPieces(slug)
  const feed = useDiscoveryFeed(slug)
  const icps = useICPs(slug)
  const positioning = usePositioning(slug)
  const wordBank = useWordBank(slug)
  const deliver = useDeliverProjects(slug)

  const reload = useCallback(() => {
    void contacts.reload()
    void pieces.reload()
    void feed.reload()
  }, [contacts, feed, pieces])

  const data = useMemo((): MorningBriefData | null => {
    if (!slug) return null

    const startToday = startOfTodayMs()
    const endToday = endOfTodayMs()
    const weekStart = startOfWeekMondayMs()
    const weekAgo = Date.now() - 7 * 86400000

    const withFollowUp = contacts.items.filter((c) => Boolean(c.next_follow_up_at))
    const overdueFollowUps = withFollowUp
      .filter((c) => {
        const t = new Date(c.next_follow_up_at as string).getTime()
        return Number.isFinite(t) && t < startToday
      })
      .sort((a, b) =>
        String(a.next_follow_up_at).localeCompare(String(b.next_follow_up_at)),
      )

    const todayFollowUps = withFollowUp
      .filter((c) => {
        const t = new Date(c.next_follow_up_at as string).getTime()
        return Number.isFinite(t) && t >= startToday && t <= endToday
      })
      .sort((a, b) =>
        String(a.next_follow_up_at).localeCompare(String(b.next_follow_up_at)),
      )

    const pipelineUpdates = contacts.items.filter(
      (c) => c.updated_at && new Date(c.updated_at).getTime() >= weekStart,
    ).length

    const contentPiecesLive = pieces.items.filter((p) => {
      if (!p.published_at) return false
      const t = new Date(p.published_at).getTime()
      return Number.isFinite(t) && t >= weekAgo
    }).length

    const discoverySignalsNew = feed.items.filter(
      (i) => !i.archived_at && new Date(i.recorded_at).getTime() >= weekAgo,
    ).length

    const fh = foundationHealth({
      icps: icps.items,
      positioning: positioning.item,
      wordBank: wordBank.items,
    })

    const activeProjects = deliver.items.filter((p) => p.status === 'active').length

    let recommendation = 'Alles im grünen Bereich — Fokus auf Akquise.'
    if (overdueFollowUps.length > 0) {
      recommendation = `${overdueFollowUps.length} überfällige Follow-ups — heute priorisieren`
    } else if (contentPiecesLive === 0) {
      recommendation = 'Noch kein Content live — Promo braucht Aufmerksamkeit'
    } else if (fh < 80) {
      recommendation = 'Foundation unvollständig — fehlende Felder ausfüllen'
    }

    return {
      todayFollowUps,
      overdueFollowUps,
      pipelineUpdates,
      contentPiecesLive,
      discoverySignalsNew,
      foundationHealth: fh,
      activeProjects,
      recommendation,
    }
  }, [
    contacts.items,
    deliver.items,
    feed.items,
    icps.items,
    pieces.items,
    positioning.item,
    slug,
    wordBank.items,
  ])

  const loading =
    contacts.loading ||
    pieces.loading ||
    feed.loading ||
    icps.loading ||
    positioning.loading ||
    wordBank.loading ||
    deliver.loading

  return { data, loading, reload }
}
