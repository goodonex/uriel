import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Contact, PipelineStage } from '../types/db'
import { useMorningBrief } from './useMorningBrief'

const STORAGE_PREFIX = 'brand-os-followup-read:' as const

function readIds(slug: string): Set<string> {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${slug}`)
    if (!raw) return new Set()
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return new Set()
    return new Set(arr.filter((x): x is string => typeof x === 'string'))
  } catch {
    return new Set()
  }
}

function writeIds(slug: string, ids: Set<string>) {
  localStorage.setItem(`${STORAGE_PREFIX}${slug}`, JSON.stringify([...ids]))
}

const STAGE_LABEL: Record<PipelineStage, string> = {
  first_contact: 'Erstkontakt',
  conversation: 'Gespräch',
  proposal: 'Angebot',
  deal: 'Deal',
  paused: 'Pause',
}

export interface FollowUpNotificationItem {
  id: string
  kind: 'overdue' | 'today'
  contact: Contact
  label: string
}

/** Follow-up Notifications + Morning Brief Sync beim App-Start (über Hook-Mount). */
export function useNotifications(slug: string | undefined) {
  const { data, loading, reload } = useMorningBrief(slug)
  const [readIdsState, setReadIdsState] = useState<Set<string>>(() =>
    slug ? readIds(slug) : new Set(),
  )

  useEffect(() => {
    setReadIdsState(slug ? readIds(slug) : new Set())
  }, [slug])

  const items = useMemo((): FollowUpNotificationItem[] => {
    if (!data) return []
    const out: FollowUpNotificationItem[] = []
    for (const c of data.overdueFollowUps) {
      const name = c.name || c.email || 'Kontakt'
      out.push({
        id: `overdue:${c.id}`,
        kind: 'overdue',
        contact: c,
        label: `${name} — Follow-up überfällig (${STAGE_LABEL[c.pipeline_stage]})`,
      })
    }
    for (const c of data.todayFollowUps) {
      const name = c.name || c.email || 'Kontakt'
      out.push({
        id: `today:${c.id}`,
        kind: 'today',
        contact: c,
        label: `${name} — Follow-up heute fällig`,
      })
    }
    return out
  }, [data])

  const unreadItems = useMemo(
    () => items.filter((it) => !readIdsState.has(it.contact.id)),
    [items, readIdsState],
  )

  const followUpBadgeCount = unreadItems.length

  const markFollowUpRead = useCallback(
    (contactId: string) => {
      if (!slug) return
      setReadIdsState((prev) => {
        const next = new Set(prev)
        next.add(contactId)
        writeIds(slug, next)
        return next
      })
    },
    [slug],
  )

  return {
    morningBrief: data,
    morningBriefLoading: loading,
    reloadMorningBrief: reload,
    followUpItems: items,
    unreadFollowUps: unreadItems,
    followUpBadgeCount,
    markFollowUpRead,
  }
}
