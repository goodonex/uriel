import { readInvokeErrorBody, withTimeout } from './functionInvoke'
import { supabase, isSupabaseConfigured } from './supabase'
import type { AssistantMessage } from '../types/assistant'

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

type InvokePayload = BrandAssistantRequest & { stream?: boolean }

const INVOKE_TIMEOUT_MS = 120_000

function serializeHistory(history: AssistantMessage[]) {
  return history.map((m) => ({ role: m.role, content: m.content }))
}

async function invokeComplete(req: InvokePayload): Promise<{ reply?: string; error?: string }> {
  if (!supabase) return { error: 'Supabase nicht konfiguriert.' }

  try {
    const { data, error } = await withTimeout(
      supabase.functions.invoke<{
        ok?: boolean
        reply?: string
        message?: string
      }>('brand-assistant', {
        body: {
          ...req,
          conversationHistory: serializeHistory(req.conversationHistory),
          stream: false,
        },
      }),
      INVOKE_TIMEOUT_MS,
      'Brand-Assistent',
    )

    if (error) {
      const ctx = await readInvokeErrorBody(error)
      const raw = (error as Error).message ?? 'invoke_failed'
      const detail = ctx?.message ?? raw
      const rawLower = raw.toLowerCase()
      if (
        detail.includes('404') ||
        detail.toLowerCase().includes('not found') ||
        detail.toLowerCase().includes('function not found') ||
        rawLower.includes('failed to send a request to the edge function')
      ) {
        return {
          error:
            'Edge Function „brand-assistant“ ist nicht erreichbar (noch nicht deployed oder Netzwerk). Im Projektordner: supabase functions deploy brand-assistant',
        }
      }
      return { error: detail }
    }

    if (data && typeof data === 'object' && data.ok === false && data.message) {
      return { error: data.message }
    }

    if (data?.reply?.trim()) return { reply: data.reply.trim() }
    if (data?.message) return { error: data.message }
    return { error: 'Assistent lieferte keine Antwort (leere API-Antwort).' }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Assistent-Anfrage fehlgeschlagen.' }
  }
}

/** Liefert die Assistenten-Antwort (primär via invoke — zuverlässig wie Discovery). */
export async function streamBrandAssistant(
  req: BrandAssistantRequest,
  onToken: (chunk: string) => void,
  onDone: () => void,
  onError: (msg: string) => void,
): Promise<void> {
  if (!isSupabaseConfigured) {
    onError('Supabase nicht konfiguriert.')
    return
  }

  const complete = await invokeComplete(req)
  if (complete.error) {
    onError(complete.error)
    return
  }
  if (complete.reply) {
    onToken(complete.reply)
    onDone()
    return
  }
  onError('Assistent lieferte keine Antwort.')
}
