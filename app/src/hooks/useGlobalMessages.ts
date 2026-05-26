import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useBrandId } from './useBrandId'

export interface GlobalMessageRow {
  id: string
  project_id: string
  sender_name: string | null
  body: string
  created_at: string
  project_name?: string
}

export function useGlobalMessages(brandSlug: string | undefined) {
  const brandId = useBrandId(brandSlug)
  const [messages, setMessages] = useState<GlobalMessageRow[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!brandId || !supabase) {
      setMessages([])
      setUnreadCount(0)
      setLoading(false)
      return
    }

    setLoading(true)

    const { data: projects } = await supabase
      .from('deliver_projects')
      .select('id, name')
      .eq('brand_id', brandId)
      .is('deleted_at', null)

    const projectIds = (projects ?? []).map((p) => p.id as string)
    if (projectIds.length === 0) {
      setMessages([])
      setUnreadCount(0)
      setLoading(false)
      return
    }

    const nameById = new Map(
      (projects ?? []).map((p) => [String(p.id), String(p.name ?? 'Projekt')]),
    )

    const { data, error } = await supabase
      .from('project_messages')
      .select('id, project_id, sender_name, body, created_at, read_at')
      .in('project_id', projectIds)
      .eq('sender_role', 'client')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(40)

    if (error) {
      setMessages([])
      setUnreadCount(0)
    } else {
      const rows = (data ?? []).map((r) => ({
        id: String(r.id),
        project_id: String(r.project_id),
        sender_name: typeof r.sender_name === 'string' ? r.sender_name : null,
        body: String(r.body ?? ''),
        created_at: String(r.created_at ?? ''),
        project_name: nameById.get(String(r.project_id)),
      }))
      setMessages(rows)
      setUnreadCount(rows.filter((r) => {
        const raw = (data ?? []).find((d) => String(d.id) === r.id)
        return raw && !raw.read_at
      }).length)
    }
    setLoading(false)
  }, [brandId])

  useEffect(() => {
    void reload()
    const interval = window.setInterval(() => void reload(), 60_000)
    return () => window.clearInterval(interval)
  }, [reload])

  const markProjectRead = useCallback(
    async (projectId: string) => {
      if (!supabase) return
      const now = new Date().toISOString()
      await supabase
        .from('project_messages')
        .update({ read_at: now })
        .eq('project_id', projectId)
        .eq('sender_role', 'client')
        .is('read_at', null)
        .is('deleted_at', null)
      await reload()
    },
    [reload],
  )

  return { messages, unreadCount, loading, reload, markProjectRead }
}

export function useHubBadgeCount(brandSlug: string | undefined) {
  const brandId = useBrandId(brandSlug)
  const { unreadCount: messageCount } = useGlobalMessages(brandSlug)
  const [extraCount, setExtraCount] = useState(0)

  const reload = useCallback(async () => {
    if (!brandId || !supabase) {
      setExtraCount(0)
      return
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    let count = 0

    const { count: bookingCount } = await supabase
      .from('sales_bookings')
      .select('id', { count: 'exact', head: true })
      .eq('brand_id', brandId)
      .gte('created_at', since)

    const { count: contactCount } = await supabase
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .eq('brand_id', brandId)
      .gte('created_at', since)

    count += bookingCount ?? 0
    count += contactCount ?? 0
    setExtraCount(count)
  }, [brandId])

  useEffect(() => {
    void reload()
    const interval = window.setInterval(() => void reload(), 60_000)
    return () => window.clearInterval(interval)
  }, [reload])

  return messageCount + extraCount
}
