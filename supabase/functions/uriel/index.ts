/**
 * Uriel — Cockpit-Assistent mit Tool-Use (ein Anthropic-Roundtrip pro Zug).
 * Die Agenten-Schleife läuft im Client: der Client führt UI- und Daten-Tools
 * lokal aus (er hat die authentifizierte Supabase-Session) und schickt die
 * tool_results als nächste Nachricht zurück. Diese Function ist der dünne,
 * server-autoritative Kopf: Persona + Anthropic-Zugang.
 * Secrets: ANTHROPIC_API_KEY, optional ANTHROPIC_MODEL.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { buildUrielSystemPrompt } from './persona.ts'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

// Anthropic content blocks sind heterogen (text / tool_use / tool_result) —
// wir reichen sie unverändert durch, daher bewusst lose typisiert.
type AnthropicMessage = { role: 'user' | 'assistant'; content: unknown }
type AnthropicTool = {
  name: string
  description: string
  input_schema: Record<string, unknown>
}

interface Body {
  messages: AnthropicMessage[]
  tools: AnthropicTool[]
  context?: { brandName?: string; brandSlug?: string; date?: string; area?: string }
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')?.trim()
  const anthropicModel = Deno.env.get('ANTHROPIC_MODEL')?.trim() || 'claude-sonnet-5'
  if (!anthropicKey) {
    return json(500, { ok: false, message: 'ANTHROPIC_API_KEY fehlt — Uriel nicht verfügbar.' })
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

  const { messages, tools, context } = body
  if (!Array.isArray(messages) || messages.length === 0) {
    return json(400, { ok: false, message: 'messages required' })
  }

  // Auth: gültige Session genügt (Uriel ist Kevin-global, nicht brand-scoped).
  const userClient = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error: userErr } = await userClient.auth.getUser()
  if (userErr || !user) {
    return json(401, { ok: false, message: 'Invalid session' })
  }

  const system = buildUrielSystemPrompt(context)

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: anthropicModel,
      max_tokens: 4096,
      system,
      messages,
      ...(Array.isArray(tools) && tools.length ? { tools } : {}),
    }),
  })

  if (!res.ok) {
    const t = await res.text()
    return json(502, { ok: false, message: `Anthropic ${res.status}: ${t.slice(0, 500)}` })
  }

  const data = (await res.json()) as {
    content?: unknown[]
    stop_reason?: string
  }
  return json(200, {
    ok: true,
    stop_reason: data.stop_reason ?? 'end_turn',
    content: data.content ?? [],
  })
})
