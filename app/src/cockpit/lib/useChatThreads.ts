import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { streamBrandAssistant } from '../../lib/brandAssistantStream'
import { supabase } from '../../lib/supabase'
import type { Contact } from '../../types/db'
import { useActiveBrand } from './activeBrand'

export interface ChatThread {
  id: string
  contact_id: string | null
  title: string
  updated_at: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

/**
 * Kontext-Präambel für kontakt-gebundene Threads: fließt als erste
 * History-Nachricht in den brand-assistant (dessen System-Prompt = Brand-DNA).
 */
function contactPreamble(contact: Contact): { role: 'user'; content: string } {
  const parts = [
    `KONTEXT für diesen Chat: Du hilfst Kevin, Nachrichten an einen konkreten Lead zu beantworten.`,
    `Kontakt: ${contact.name}${contact.company ? ` (${contact.company})` : ''}`,
    `Pipeline-Stage: ${contact.pipeline_stage}`,
    contact.entscheider_name ? `Entscheider: ${contact.entscheider_name}` : null,
    contact.next_follow_up_at ? `Nächstes Follow-up geplant: ${contact.next_follow_up_at}` : null,
    ``,
    `Regeln: Wenn Kevin eine empfangene Nachricht (z.B. aus LinkedIn) einfügt, entwirf die Antwort in Kevins Stimme — kurz, Du-Form, kanal-passend (DM = 2-4 Sätze), ein Ziel pro Nachricht, keine Floskeln. Wenn er Fragen zum Kontakt stellt, antworte knapp.`,
  ].filter((l): l is string => l !== null)
  return { role: 'user', content: parts.join('\n') }
}

interface UseChatThreadsResult {
  threads: ChatThread[]
  tableMissing: boolean
  error: string | null
  createThread: (contact?: Contact | null) => Promise<ChatThread | null>
  archiveThread: (id: string) => Promise<void>
  loadMessages: (threadId: string) => Promise<ChatMessage[]>
  /** sendet, persistiert beides, liefert die Assistent-Antwort */
  sendMessage: (
    thread: ChatThread,
    history: ChatMessage[],
    text: string,
    contact: Contact | null,
  ) => Promise<ChatMessage>
  refresh: () => Promise<void>
}

export function useChatThreads(): UseChatThreadsResult {
  const { user } = useAuth()
  const { activeBrand } = useActiveBrand()
  const [threads, setThreads] = useState<ChatThread[]>([])
  const [tableMissing, setTableMissing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!supabase || !user || !activeBrand) return
    const { data, error: err } = await supabase
      .from('chat_threads')
      .select('id, contact_id, title, updated_at')
      .eq('user_id', user.id)
      .eq('brand_id', activeBrand.id)
      .eq('archived', false)
      .order('updated_at', { ascending: false })
      .limit(20)
    if (err) {
      if (err.code === 'PGRST205' || err.code === '42P01' || err.message.includes('Could not find the table')) {
        setTableMissing(true)
      } else {
        setError(err.message)
      }
      return
    }
    setTableMissing(false)
    setThreads((data as ChatThread[]) ?? [])
  }, [user, activeBrand])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const createThread = useCallback(
    async (contact?: Contact | null): Promise<ChatThread | null> => {
      if (!supabase || !user || !activeBrand) return null
      const title = contact ? (contact.company || contact.name) : 'Neuer Chat'
      const { data, error: err } = await supabase
        .from('chat_threads')
        .insert({
          user_id: user.id,
          brand_id: activeBrand.id,
          contact_id: contact?.id ?? null,
          title,
        })
        .select('id, contact_id, title, updated_at')
        .single()
      if (err) {
        setError(err.message)
        return null
      }
      const thread = data as ChatThread
      setThreads((t) => [thread, ...t])
      return thread
    },
    [user, activeBrand],
  )

  const archiveThread = useCallback(async (id: string) => {
    if (!supabase) return
    setThreads((t) => t.filter((x) => x.id !== id))
    await supabase.from('chat_threads').update({ archived: true }).eq('id', id)
  }, [])

  const loadMessages = useCallback(async (threadId: string): Promise<ChatMessage[]> => {
    if (!supabase) return []
    const { data } = await supabase
      .from('chat_messages')
      .select('id, role, content, created_at')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true })
      .limit(100)
    return (data as ChatMessage[]) ?? []
  }, [])

  const sendMessage = useCallback(
    async (
      thread: ChatThread,
      history: ChatMessage[],
      text: string,
      contact: Contact | null,
    ): Promise<ChatMessage> => {
      if (!supabase || !user || !activeBrand) throw new Error('Nicht verbunden')

      // 1. User-Nachricht persistieren
      await supabase.from('chat_messages').insert({
        thread_id: thread.id,
        user_id: user.id,
        role: 'user',
        content: text,
      })

      // 2. Assistent fragen — Kontakt-Kontext als Präambel in die History
      const preamble = contact ? [contactPreamble(contact)] : []
      const reply = await new Promise<string>((resolve, reject) => {
        let acc = ''
        void streamBrandAssistant(
          {
            brandId: activeBrand.id,
            conversationHistory: [
              ...preamble,
              ...history.map((m) => ({ role: m.role, content: m.content })),
            ],
            newMessage: text,
          },
          (chunk) => {
            acc += chunk
          },
          () => resolve(acc),
          (msg) => reject(new Error(msg)),
        )
      })

      // 3. Antwort persistieren
      const { data } = await supabase
        .from('chat_messages')
        .insert({
          thread_id: thread.id,
          user_id: user.id,
          role: 'assistant',
          content: reply,
        })
        .select('id, role, content, created_at')
        .single()

      void refresh() // updated_at-Sortierung nachziehen
      return (
        (data as ChatMessage) ?? {
          id: `tmp-${Date.now()}`,
          role: 'assistant',
          content: reply,
          created_at: new Date().toISOString(),
        }
      )
    },
    [user, activeBrand, refresh],
  )

  return { threads, tableMissing, error, createThread, archiveThread, loadMessages, sendMessage, refresh }
}
