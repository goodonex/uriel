/**
 * Brand Assistant — Brand-DNA-aware chat with file + YouTube context.
 * Secrets: ANTHROPIC_API_KEY, optional ANTHROPIC_MODEL
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { loadBrandDna } from './brandDna.ts'
import { fetchYoutubeTranscript } from './youtube.ts'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

interface Attachment {
  type: 'youtube' | 'file'
  url?: string
  fileText?: string
  fileName?: string
}

interface Body {
  brandId: string
  conversationHistory: { role: 'user' | 'assistant'; content: string }[]
  newMessage: string
  attachments?: Attachment[]
  stream?: boolean
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function buildSystemPrompt(brandName: string, dna: string): string {
  return `Du bist der Brand-Assistent für ${brandName}.

Hier ist die vollständige Brand-DNA dieser Brand:
---
${dna}
---

Regeln:
- Antworte IMMER im Tone of Voice der Brand (siehe Brand-DNA).
- Wenn du Inhalte analysierst (Dateien, Videos, Links), beziehe sie KONKRET auf diese Brand-DNA — nicht generisch.
- Liefere nicht nur Zusammenfassungen. Beantworte explizit: Was bedeutet das konkret für diese Brand?
- Nenne drei konkrete Maßnahmen für ${brandName}, basierend auf ICPs und Positioning — spezifisch, nicht generisch.
- Keine erfundenen KPIs oder Scheingenauigkeit bei Prognosen.
- Antworte auf Deutsch, klar strukturiert (Markdown erlaubt).`
}

async function buildAttachmentContext(
  attachments: Attachment[] | undefined,
): Promise<{ blocks: string[]; errors: string[] }> {
  const blocks: string[] = []
  const errors: string[] = []
  if (!attachments?.length) return { blocks, errors }

  for (const att of attachments) {
    if (att.type === 'file' && att.fileText?.trim()) {
      const name = att.fileName ?? 'Datei'
      blocks.push(
        `[Anhang: Datei "${name}"]\n${att.fileText.trim().slice(0, 15_000)}`,
      )
      continue
    }
    if (att.type === 'youtube' && att.url?.trim()) {
      const result = await fetchYoutubeTranscript(att.url.trim())
      if (result.ok) {
        blocks.push(
          `[Anhang: YouTube-Video ${result.videoId}]\nTranskript:\n${result.text.slice(0, 15_000)}`,
        )
      } else if (result.reason === 'no_captions') {
        errors.push(
          'Dieses Video hat keine verfügbaren Untertitel — ich kann den Inhalt nicht lesen.',
        )
      } else {
        errors.push(
          `YouTube-Transkript konnte nicht geladen werden${result.detail ? `: ${result.detail}` : ''}.`,
        )
      }
    }
  }
  return { blocks, errors }
}

function toAnthropicMessages(
  history: Body['conversationHistory'],
  newMessage: string,
  attachmentBlocks: string[],
  attachmentErrors: string[],
): Array<{ role: 'user' | 'assistant'; content: string }> {
  const msgs: Array<{ role: 'user' | 'assistant'; content: string }> = []
  for (const m of history.slice(-24)) {
    if (!m.content?.trim()) continue
    msgs.push({ role: m.role, content: m.content.trim() })
  }

  let userContent = newMessage.trim()
  if (attachmentBlocks.length) {
    userContent += `\n\n---\nKontext aus Anhängen:\n${attachmentBlocks.join('\n\n---\n')}\n\nAnalysiere den Anhang nicht generisch — beziehe ihn direkt auf die Brand-DNA und beantworte, was der Nutzer konkret damit will.`
  }
  if (attachmentErrors.length) {
    userContent += `\n\n[Hinweis System: ${attachmentErrors.join(' ')}]`
  }
  msgs.push({ role: 'user', content: userContent })
  return msgs
}

async function streamAnthropic(
  apiKey: string,
  model: string,
  system: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
): Promise<Response> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      stream: true,
      system,
      messages,
    }),
  })

  if (!res.ok) {
    const t = await res.text()
    return json(502, {
      ok: false,
      message: `Anthropic ${res.status}: ${t.slice(0, 400)}`,
    })
  }

  return new Response(res.body, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

async function completeAnthropic(
  apiKey: string,
  model: string,
  system: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      system,
      messages,
    }),
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Anthropic ${res.status}: ${t.slice(0, 500)}`)
  }
  const data = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>
  }
  return data.content?.find((c) => c.type === 'text')?.text?.trim() ?? ''
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')?.trim()
  const anthropicModel =
    Deno.env.get('ANTHROPIC_MODEL')?.trim() || 'claude-sonnet-5'

  if (!anthropicKey) {
    return json(500, {
      ok: false,
      message: 'ANTHROPIC_API_KEY fehlt — Brand-Assistent nicht verfügbar.',
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return json(401, { ok: false, message: 'Unauthorized' })
  }

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return json(400, { ok: false, message: 'Invalid JSON body' })
  }

  const { brandId, conversationHistory, newMessage, attachments, stream = true } = body
  if (!brandId || !newMessage?.trim()) {
    return json(400, { ok: false, message: 'brandId and newMessage required' })
  }

  const userClient = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: authHeader } },
  })

  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser()
  if (userErr || !user) {
    return json(401, { ok: false, message: 'Invalid session' })
  }

  const { data: brandRow, error: brandErr } = await userClient
    .from('brands')
    .select('id, user_id')
    .eq('id', brandId)
    .maybeSingle()

  if (brandErr || !brandRow || brandRow.user_id !== user.id) {
    return json(403, { ok: false, message: 'Brand not allowed' })
  }

  const { brandName, dnaMarkdown } = await loadBrandDna(userClient, brandId)
  const system = buildSystemPrompt(brandName, dnaMarkdown)

  const { blocks, errors } = await buildAttachmentContext(attachments)

  if (
    attachments?.some((a) => a.type === 'youtube') &&
    errors.some((e) => e.includes('keine verfügbaren Untertitel'))
  ) {
    return json(400, {
      ok: false,
      message: errors.find((e) => e.includes('Untertitel')) ?? errors[0],
    })
  }

  const messages = toAnthropicMessages(
    conversationHistory ?? [],
    newMessage,
    blocks,
    errors,
  )

  if (stream) {
    return streamAnthropic(anthropicKey, anthropicModel, system, messages)
  }

  try {
    const reply = await completeAnthropic(anthropicKey, anthropicModel, system, messages)
    return json(200, { ok: true, reply })
  } catch (e) {
    return json(502, {
      ok: false,
      message: e instanceof Error ? e.message : 'Anthropic failed',
    })
  }
})
