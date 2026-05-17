import { supabase, isSupabaseConfigured } from './supabase'
import type { AssistantMessage } from '../types/assistant'

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? ''
const SUPABASE_ANON = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? ''

export interface BrandAssistantRequest {
  brandId: string
  conversationHistory: AssistantMessage[]
  newMessage: string
  attachments?: Array<{
    type: 'youtube' | 'file'
    url?: string
    fileText?: string
    fileName?: string
  }>
}

export async function getAccessToken(): Promise<string | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

/** Stream assistant reply token-by-token (Anthropic SSE passthrough). */
export async function streamBrandAssistant(
  req: BrandAssistantRequest,
  onToken: (chunk: string) => void,
  onDone: () => void,
  onError: (msg: string) => void,
): Promise<void> {
  if (!isSupabaseConfigured || !SUPABASE_URL) {
    onError('Supabase nicht konfiguriert.')
    return
  }
  const token = await getAccessToken()
  if (!token) {
    onError('Nicht angemeldet.')
    return
  }

  const res = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/brand-assistant`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_ANON,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...req,
      conversationHistory: req.conversationHistory.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      stream: true,
    }),
  })

  const ct = res.headers.get('content-type') ?? ''

  if (!res.ok) {
    let msg = `Assistent-Fehler (${res.status})`
    try {
      const j = (await res.json()) as { message?: string }
      if (j.message) msg = j.message
    } catch {
      /* ignore */
    }
    onError(msg)
    return
  }

  if (!ct.includes('text/event-stream') || !res.body) {
    try {
      const j = (await res.json()) as { reply?: string; message?: string }
      if (j.reply) {
        onToken(j.reply)
        onDone()
        return
      }
      onError(j.message ?? 'Leere Antwort.')
    } catch {
      onError('Unerwartete Antwort vom Assistenten.')
    }
    return
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const payload = line.slice(6).trim()
        if (!payload || payload === '[DONE]') continue
        try {
          const evt = JSON.parse(payload) as {
            type?: string
            delta?: { type?: string; text?: string }
          }
          if (
            evt.type === 'content_block_delta' &&
            evt.delta?.type === 'text_delta' &&
            typeof evt.delta.text === 'string'
          ) {
            onToken(evt.delta.text)
          }
        } catch {
          /* partial JSON — skip */
        }
      }
    }
    onDone()
  } catch (e) {
    onError(e instanceof Error ? e.message : 'Stream unterbrochen.')
  }
}
