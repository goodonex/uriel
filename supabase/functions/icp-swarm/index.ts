/**
 * ICP Swarm — simuliert alle Foundation-ICPs auf Content oder Funnel-Struktur.
 * Secrets: ANTHROPIC_API_KEY, optional ANTHROPIC_MODEL
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

type SwarmMode = 'content' | 'funnel'

interface FunnelNodePayload {
  id: string
  type: string
  label: string
  config?: Record<string, unknown>
}

interface FunnelEdgePayload {
  source_node_id: string
  target_node_id: string
  label?: string | null
  variant?: string | null
}

interface Body {
  brandId: string
  mode: SwarmMode
  payload: {
    content?: string
    contentType?: string
    funnelNodes?: FunnelNodePayload[]
    funnelEdges?: FunnelEdgePayload[]
  }
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function claudeJson<T>(apiKey: string, model: string, system: string, user: string): Promise<T> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Anthropic ${res.status}: ${t.slice(0, 500)}`)
  }
  const data = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>
  }
  const text = data.content?.find((c) => c.type === 'text')?.text ?? ''
  let t = text.trim()
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  }
  return JSON.parse(t) as T
}

function formatIcps(
  rows: Array<{
    name: string
    age_range: string | null
    location: string | null
    pain_points: string[] | null
    notes: string | null
    priority: number | null
  }>,
): string {
  return rows
    .map((icp, i) => {
      const pains = (icp.pain_points ?? []).join(', ') || '—'
      return `ICP ${i + 1}: ${icp.name}
Alter: ${icp.age_range ?? '—'}
Ort: ${icp.location ?? '—'}
Priorität: ${icp.priority ?? '—'}
Schmerzpunkte: ${pains}
Notizen: ${icp.notes ?? '—'}`
    })
    .join('\n\n')
}

function formatFunnel(nodes: FunnelNodePayload[], edges: FunnelEdgePayload[]): string {
  const nodeLines = nodes.map(
    (n) => `- [${n.type}] ${n.label} (id: ${n.id})`,
  )
  const edgeLines = edges.map((e) => {
    const v = e.variant ? ` (${e.variant})` : ''
    const lbl = e.label ? ` "${e.label}"` : ''
    return `- ${e.source_node_id} → ${e.target_node_id}${v}${lbl}`
  })
  return `Nodes:\n${nodeLines.join('\n')}\n\nEdges:\n${edgeLines.join('\n')}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')?.trim()
  const anthropicModel =
    Deno.env.get('ANTHROPIC_MODEL')?.trim() || 'claude-sonnet-4-20250514'

  if (!anthropicKey) {
    return json(500, {
      ok: false,
      message:
        'ANTHROPIC_API_KEY fehlt — Schwarm-Prognose nicht möglich.',
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

  const { brandId, mode, payload } = body
  if (!brandId || (mode !== 'content' && mode !== 'funnel')) {
    return json(400, { ok: false, message: 'brandId and mode required' })
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
    .select('id, user_id, name')
    .eq('id', brandId)
    .maybeSingle()

  if (brandErr || !brandRow || brandRow.user_id !== user.id) {
    return json(403, { ok: false, message: 'Brand not allowed' })
  }

  const { data: icps, error: icpErr } = await userClient
    .from('foundation_icps')
    .select('name, age_range, location, pain_points, notes, priority')
    .eq('brand_id', brandId)
    .order('priority', { ascending: true })

  if (icpErr) {
    return json(500, { ok: false, message: icpErr.message })
  }

  if (!icps?.length) {
    return json(400, {
      ok: false,
      message:
        'Keine ICPs in Foundation hinterlegt — Schwarm-Prognose nicht möglich.',
    })
  }

  const systemPrompt = `Du bist ein Markt-Simulator. Du bekommst mehrere Idealkunden-Profile und einen Marketing-Inhalt oder Funnel. Du simulierst wie jedes Profil real darauf reagiert — nicht wie es reagieren sollte. Sei ehrlich, auch unbequem. Keine Höflichkeit.

Antworte NUR mit gültigem JSON (kein Markdown, keine Prosa außerhalb des JSON).

Schema:
{
  "qualitative": {
    "perIcp": [
      {
        "icpName": string,
        "firstReaction": string,
        "whatResonates": string,
        "whatBounces": string,
        "mainObjection": string,
        "wouldAct": boolean
      }
    ],
    "summary": string,
    "biggestRisk": string,
    "strongestElement": string
  },
  "quantitative": {
    "expectedEngagementRate": "low" | "medium" | "high",
    "expectedConversionBand": string,
    "confidenceNote": string
  }
}

Regeln:
- expectedConversionBand: grobe Spanne als Text z.B. "2–4%", NIE Nachkommastellen oder Scheingenauigkeit
- KEINE präzisen Prozentzahlen mit Dezimalstellen erfinden
- confidenceNote ist Pflicht und muss ehrlich sein: "Prognose basiert auf ICP-Modell, nicht auf historischen Kampagnendaten dieser Brand."
- proIcp: ein Eintrag pro geliefertem ICP (gleicher Name)`

  let userPrompt = `Brand: ${brandRow.name}\n\nIdealkunden-Profile:\n${formatIcps(icps)}\n\n`

  if (mode === 'content') {
    const content = (payload.content ?? '').trim()
    if (!content) {
      return json(400, { ok: false, message: 'content required for mode content' })
    }
    const ct = payload.contentType ?? 'generic'
    userPrompt += `Zu bewertender Content (${ct}):\n---\n${content.slice(0, 24_000)}\n---`
  } else {
    const nodes = payload.funnelNodes ?? []
    const edges = payload.funnelEdges ?? []
    if (nodes.length === 0) {
      return json(400, { ok: false, message: 'funnelNodes required for mode funnel' })
    }
    userPrompt += `Zu bewertender Funnel:\n${formatFunnel(nodes, edges)}`
  }

  try {
    const prediction = await claudeJson<Record<string, unknown>>(
      anthropicKey,
      anthropicModel,
      systemPrompt,
      userPrompt,
    )
    const q = prediction.qualitative as Record<string, unknown> | undefined
    const quant = prediction.quantitative as Record<string, unknown> | undefined
    if (!q?.perIcp || !quant?.confidenceNote) {
      return json(502, {
        ok: false,
        message: 'Modell-Antwort unvollständig — bitte erneut versuchen.',
      })
    }
    if (typeof quant.confidenceNote === 'string' && !quant.confidenceNote.includes('ICP')) {
      quant.confidenceNote =
        'Prognose basiert auf ICP-Modell, nicht auf historischen Kampagnendaten dieser Brand.'
    }
    return json(200, { ok: true, prediction })
  } catch (e) {
    return json(502, {
      ok: false,
      message:
        e instanceof Error
          ? `Schwarm-Simulation fehlgeschlagen: ${e.message}`
          : 'Schwarm-Simulation fehlgeschlagen',
    })
  }
})
