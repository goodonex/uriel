import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { ProjectMessage } from '../types/db'

function rowToMessage(row: Record<string, unknown>): ProjectMessage {
  return {
    id: String(row.id ?? ''),
    project_id: String(row.project_id ?? ''),
    sender_role: row.sender_role === 'client' ? 'client' : 'owner',
    sender_name: typeof row.sender_name === 'string' ? row.sender_name : null,
    body: String(row.body ?? ''),
    read_at: typeof row.read_at === 'string' ? row.read_at : null,
    deleted_at: typeof row.deleted_at === 'string' ? row.deleted_at : null,
    created_at: typeof row.created_at === 'string' ? row.created_at : new Date().toISOString(),
  }
}

export function useProjectMessages(
  projectId: string | undefined,
  viewerRole: 'owner' | 'client',
  senderName: string,
) {
  const [messages, setMessages] = useState<ProjectMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  const reload = useCallback(async () => {
    if (!projectId || !supabase) {
      setMessages([])
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error: err } = await supabase
      .from('project_messages')
      .select('*')
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })

    if (err) {
      setError(err.message)
      setMessages([])
    } else {
      setError(null)
      setMessages((data ?? []).map((r) => rowToMessage(r as Record<string, unknown>)))
    }
    setLoading(false)
  }, [projectId])

  useEffect(() => {
    void reload()
    const interval = window.setInterval(() => void reload(), 30_000)
    return () => window.clearInterval(interval)
  }, [reload])

  const markThreadRead = useCallback(async () => {
    if (!projectId || !supabase) return
    const oppositeRole = viewerRole === 'owner' ? 'client' : 'owner'
    const hasUnread = messages.some((m) => m.sender_role === oppositeRole && !m.read_at)
    if (!hasUnread) return

    const now = new Date().toISOString()
    const { error: err } = await supabase
      .from('project_messages')
      .update({ read_at: now })
      .eq('project_id', projectId)
      .eq('sender_role', oppositeRole)
      .is('read_at', null)
      .is('deleted_at', null)

    if (!err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.sender_role === oppositeRole && !m.read_at ? { ...m, read_at: now } : m,
        ),
      )
    }
  }, [messages, projectId, viewerRole])

  useEffect(() => {
    if (!loading) {
      void markThreadRead()
    }
  }, [loading, messages, markThreadRead])

  const send = useCallback(
    async (body: string) => {
      const trimmed = body.trim()
      if (!trimmed || !projectId || !supabase) return { ok: false as const, error: 'empty' }
      setSending(true)
      setError(null)

      const { data, error: insErr } = await supabase
        .from('project_messages')
        .insert({
          project_id: projectId,
          sender_role: viewerRole,
          sender_name: senderName.trim() || null,
          body: trimmed,
        })
        .select('*')
        .maybeSingle()

      if (insErr || !data) {
        setSending(false)
        setError(insErr?.message ?? 'Senden fehlgeschlagen')
        return { ok: false as const, error: insErr?.message ?? 'insert_failed' }
      }

      const msg = rowToMessage(data as Record<string, unknown>)
      setMessages((prev) => [...prev, msg])

      void supabase.functions.invoke('send-email', {
        body: {
          mode: 'project_message',
          project_id: projectId,
          message_id: msg.id,
          sender_role: viewerRole,
        },
      })

      setSending(false)
      return { ok: true as const, message: msg }
    },
    [projectId, senderName, viewerRole],
  )

  const softDelete = useCallback(
    async (messageId: string) => {
      if (!projectId || !supabase || viewerRole !== 'owner') return
      const now = new Date().toISOString()
      const { error: err } = await supabase
        .from('project_messages')
        .update({ deleted_at: now })
        .eq('id', messageId)
        .eq('project_id', projectId)

      if (!err) {
        setMessages((prev) => prev.filter((m) => m.id !== messageId))
      }
    },
    [projectId, viewerRole],
  )

  const unreadCount = messages.filter(
    (m) => m.sender_role !== viewerRole && !m.read_at,
  ).length

  return { messages, loading, error, sending, send, softDelete, reload, unreadCount }
}
