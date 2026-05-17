import { useCallback, useEffect, useRef, useState } from 'react'
import { streamBrandAssistant } from '../lib/brandAssistantStream'
import { extractFileText } from '../lib/assistantFileExtract'
import { extractYoutubeUrlFromText } from '../lib/youtubeUrl'
import { isMissingSupabaseTableError } from '../lib/supabaseErrors'
import { supabase } from '../lib/supabase'
import type { AssistantAttachment, AssistantMessage } from '../types/assistant'
import { useBrandId } from './useBrandId'

function rowToMessages(raw: unknown): AssistantMessage[] {
  if (!Array.isArray(raw)) return []
  const out: AssistantMessage[] = []
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue
    const o = x as Record<string, unknown>
    const role = o.role === 'assistant' ? 'assistant' : 'user'
    const content = typeof o.content === 'string' ? o.content : ''
    if (!content.trim()) continue
    out.push({
      role,
      content,
      createdAt: typeof o.createdAt === 'string' ? o.createdAt : undefined,
    })
  }
  return out
}

export function useBrandAssistant(brandSlug: string | undefined) {
  const brandId = useBrandId(brandSlug)
  const [messages, setMessages] = useState<AssistantMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingAttachments, setPendingAttachments] = useState<AssistantAttachment[]>([])
  const messagesRef = useRef(messages)
  messagesRef.current = messages
  const convIdRef = useRef<string | null>(null)

  const persist = useCallback(
    async (next: AssistantMessage[]) => {
      if (!supabase || !brandId) return
      const payload = next.map((m) => ({
        role: m.role,
        content: m.content,
        createdAt: m.createdAt ?? new Date().toISOString(),
      }))
      const row = {
        brand_id: brandId,
        messages: payload,
        updated_at: new Date().toISOString(),
      }
      if (convIdRef.current) {
        await supabase
          .from('assistant_conversations')
          .update(row)
          .eq('id', convIdRef.current)
          .eq('brand_id', brandId)
      } else {
        const { data, error: insErr } = await supabase
          .from('assistant_conversations')
          .upsert(row, { onConflict: 'brand_id' })
          .select('id')
          .single()
        if (!insErr && data?.id) convIdRef.current = data.id as string
      }
    },
    [brandId],
  )

  const loadHistory = useCallback(async () => {
    if (!brandId || !supabase) {
      setMessages([])
      setLoadingHistory(false)
      return
    }
    setLoadingHistory(true)
    const { data, error: qErr } = await supabase
      .from('assistant_conversations')
      .select('id, messages')
      .eq('brand_id', brandId)
      .maybeSingle()

    if (qErr && isMissingSupabaseTableError(qErr.message)) {
      setMessages([])
      setLoadingHistory(false)
      return
    }
    if (qErr) {
      setError(qErr.message)
      setLoadingHistory(false)
      return
    }
    convIdRef.current = (data?.id as string) ?? null
    setMessages(rowToMessages(data?.messages))
    setLoadingHistory(false)
  }, [brandId])

  useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  const clearHistory = useCallback(async () => {
    setMessages([])
    setError(null)
    if (!supabase || !brandId) return
    if (convIdRef.current) {
      await supabase
        .from('assistant_conversations')
        .update({ messages: [], updated_at: new Date().toISOString() })
        .eq('id', convIdRef.current)
    }
  }, [brandId])

  const addFileAttachment = useCallback(async (file: File) => {
    const result = await extractFileText(file)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setPendingAttachments((cur) => [
      ...cur,
      {
        type: 'file',
        fileName: file.name,
        fileText: result.text,
        truncated: result.truncated,
      },
    ])
    setError(null)
  }, [])

  const addYoutubeAttachment = useCallback((url: string) => {
    setPendingAttachments((cur) => {
      if (cur.some((a) => a.type === 'youtube' && a.url === url)) return cur
      return [...cur, { type: 'youtube', url }]
    })
  }, [])

  const removeAttachment = useCallback((index: number) => {
    setPendingAttachments((cur) => cur.filter((_, i) => i !== index))
  }, [])

  const sendMessage = useCallback(
    async (text: string, opts?: { attachments?: AssistantAttachment[] }) => {
      if (!brandId) return
      const trimmed = text.trim()
      const atts = opts?.attachments ?? pendingAttachments
      if (!trimmed && atts.length === 0) return

      const now = new Date().toISOString()
      const userMsg: AssistantMessage = {
        role: 'user',
        content: trimmed || '(Anhang ohne Text)',
        createdAt: now,
      }

      const prior = messagesRef.current
      const history = [...prior, userMsg]
      messagesRef.current = history
      setMessages(history)
      setPendingAttachments([])
      setLoading(true)
      setError(null)

      const assistantPlaceholder: AssistantMessage = {
        role: 'assistant',
        content: '',
        createdAt: new Date().toISOString(),
      }
      const withPlaceholder = [...history, assistantPlaceholder]
      messagesRef.current = withPlaceholder
      setMessages(withPlaceholder)

      const apiAttachments = atts.map((a) => {
        if (a.type === 'youtube') return { type: 'youtube' as const, url: a.url }
        return {
          type: 'file' as const,
          fileName: a.fileName,
          fileText: a.fileText,
        }
      })

      await streamBrandAssistant(
        {
          brandId,
          conversationHistory: prior,
          newMessage: userMsg.content,
          attachments: apiAttachments.length ? apiAttachments : undefined,
        },
        (chunk) => {
          setMessages((cur) => {
            const copy = [...cur]
            const last = copy[copy.length - 1]
            if (last?.role === 'assistant') {
              copy[copy.length - 1] = { ...last, content: last.content + chunk }
            }
            messagesRef.current = copy
            return copy
          })
        },
        async () => {
          setLoading(false)
          const final = messagesRef.current
          const last = final[final.length - 1]
          if (last?.role === 'assistant' && last.content.trim()) {
            await persist(final)
          } else if (last?.role === 'assistant') {
            setMessages(history)
            messagesRef.current = history
            setError('Assistent lieferte keine Antwort.')
          }
        },
        (msg) => {
          setLoading(false)
          setError(msg)
          const rolled = prior
          setMessages(rolled)
          messagesRef.current = rolled
        },
      )
    },
    [brandId, pendingAttachments, persist],
  )

  const detectYoutubeInInput = useCallback((text: string) => {
    const url = extractYoutubeUrlFromText(text)
    if (url) addYoutubeAttachment(url)
  }, [addYoutubeAttachment])

  return {
    messages,
    loading,
    loadingHistory,
    error,
    pendingAttachments,
    sendMessage,
    clearHistory,
    addFileAttachment,
    removeAttachment,
    detectYoutubeInInput,
    reloadHistory: loadHistory,
  }
}
