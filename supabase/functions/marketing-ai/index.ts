// Marketing-AI: generiert Texte für Recruiting (Stellenanzeigen) + Ads (Hook/Body/CTA).
// Nutzt Brand-Foundation als Kontext (Positioning, Tone, Business Model, ICPs, Word Bank).
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type Kind = 'recruiting' | 'ad'
type RecruitingField = 'description' | 'requirements' | 'benefits' | 'full'
type AdField = 'hook' | 'body' | 'cta' | 'full'
type Platform = 'linkedin_organic' | 'linkedin_ad' | 'culturefit' | 'meta' | 'google' | 'other'

interface AdCopySiblings {
  hook?: string
  body?: string
  cta?: string
}

interface Body {
  kind: Kind
  field: RecruitingField | AdField
  brand_id?: string
  brand_name?: string
  platform?: Platform
  title?: string
  current_value?: string
  ad_copy?: AdCopySiblings
  context?: {
    positioning_statement?: string
    tone_of_voice?: string
    business_model?: { who?: string; what?: string; how?: string; for_whom?: string; revenue?: string }
    icps?: Array<{ name?: string; pain_points?: string[]; location?: string }>
    word_bank?: { yes?: string[]; no?: string[] }
  }
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

function buildContext(c: Body['context'], brandName?: string): string {
  const lines: string[] = []
  if (brandName) lines.push(`Brand: ${brandName}`)
  if (c?.positioning_statement) lines.push(`Positionierung: ${c.positioning_statement}`)
  if (c?.tone_of_voice) lines.push(`Tone of Voice: ${c.tone_of_voice}`)
  if (c?.business_model) {
    const bm = c.business_model
    const parts: string[] = []
    if (bm.who) parts.push(`Wer: ${bm.who}`)
    if (bm.what) parts.push(`Was: ${bm.what}`)
    if (bm.how) parts.push(`Wie: ${bm.how}`)
    if (bm.for_whom) parts.push(`Für wen: ${bm.for_whom}`)
    if (bm.revenue) parts.push(`Womit: ${bm.revenue}`)
    if (parts.length) lines.push(`Business Model:\n  ${parts.join('\n  ')}`)
  }
  if (c?.icps?.length) {
    const top = c.icps.slice(0, 3).map((i, idx) => {
      const pains = (i.pain_points ?? []).slice(0, 3).join(', ')
      return `  ICP ${idx + 1} (${i.name ?? '—'})${i.location ? ' · ' + i.location : ''}${pains ? ' · Pains: ' + pains : ''}`
    })
    lines.push(`ICPs:\n${top.join('\n')}`)
  }
  if (c?.word_bank) {
    const yes = (c.word_bank.yes ?? []).slice(0, 12).join(', ')
    const no = (c.word_bank.no ?? []).slice(0, 8).join(', ')
    if (yes) lines.push(`Wortbank · benutzen: ${yes}`)
    if (no) lines.push(`Wortbank · vermeiden: ${no}`)
  }
  return lines.join('\n')
}

function adSiblingBlock(b: Body): string {
  if (b.kind !== 'ad' || !b.ad_copy) return ''
  const lines: string[] = []
  const hook = b.ad_copy.hook?.trim()
  const body = b.ad_copy.body?.trim()
  const cta = b.ad_copy.cta?.trim()
  if (b.field !== 'hook' && hook) lines.push(`Hook (bereits fest): ${hook}`)
  if (b.field !== 'body' && body) lines.push(`Body (bereits fest): ${body}`)
  if (b.field !== 'cta' && cta) lines.push(`CTA (bereits fest): ${cta}`)
  if (!lines.length) return ''
  return [
    'Bereits vorhandene Anzeigen-Teile — unbedingt darauf abstimmen, nicht widersprechen:',
    ...lines,
  ].join('\n')
}

function prompt(b: Body): { system: string; user: string } {
  const ctx = buildContext(b.context, b.brand_name)
  const platformHint = b.platform ? `Plattform: ${b.platform}` : ''
  const titleHint = b.title ? `Titel/Kampagne: ${b.title}` : ''
  const current = b.current_value?.trim()

  let role = ''
  let goal = ''
  let format = ''

  if (b.kind === 'recruiting') {
    role = 'Du bist Senior Recruiter + Brand-Copywriter. Du schreibst auf Deutsch.'
    switch (b.field) {
      case 'description':
        goal = 'Schreibe eine knackige Stellenbeschreibung (3-5 Sätze): wer wir sind, was die Aufgabe ist, warum es relevant ist. Keine Floskeln.'
        format = 'Reiner Fließtext, 3-5 Sätze.'
        break
      case 'requirements':
        goal = 'Liste 5-7 wichtige Anforderungen als Bullet-Points. Konkret, nicht generisch. Nutze die ICP-Schmerzpunkte und Word Bank.'
        format = 'Mehrere Zeilen, jede beginnt mit • .'
        break
      case 'benefits':
        goal = 'Liste 5-7 echte Benefits als Bullet-Points. Was macht die Stelle wirklich besonders? Keine Standard-Floskeln.'
        format = 'Mehrere Zeilen, jede beginnt mit • .'
        break
      case 'full':
        goal = 'Komplette Stellenanzeige: 1 Hook-Satz, dann Beschreibung (2-3 Sätze), dann Anforderungen (5 Bullets), dann Benefits (4 Bullets). Klar, ehrlich, brand-stimmig.'
        format = 'Strukturierter Text mit Sektions-Überschriften (## Beschreibung, ## Anforderungen, ## Benefits).'
        break
    }
  } else {
    role = 'Du bist Senior Performance-Copywriter. Du schreibst auf Deutsch.'
    switch (b.field) {
      case 'hook':
        goal = b.ad_copy?.body?.trim()
          ? 'Schreibe einen Hook (max. 8-12 Wörter), der den bereits vorhandenen Body logisch einleitet und zur Ziel-ICP passt.'
          : 'Schreibe einen aufmerksamkeitsstarken Hook (max. 8-12 Wörter), der die Ziel-ICP triggert. Pattern-Interrupt. Keine Cliches.'
        format = 'Ein Satz, max. 12 Wörter.'
        break
      case 'body':
        goal = b.ad_copy?.hook?.trim()
          ? 'Schreibe den Body (2-3 Sätze), der nahtlos an den bereits vorhandenen Hook anschließt — gleicher Ton, keine Wiederholung des Hooks.'
          : 'Body der Anzeige: 2-3 Sätze, die das Problem benennen und die Lösung andeuten. Brand-Tone treffen. Word Bank nutzen.'
        format = '2-3 Sätze Fließtext.'
        break
      case 'cta':
        goal =
          b.ad_copy?.hook?.trim() || b.ad_copy?.body?.trim()
            ? 'CTA (max. 4 Wörter), passend zu Hook und Body — action-orientiert, nicht "Mehr erfahren".'
            : 'Call-to-Action (max. 4 Wörter), action-orientiert. Nicht "Mehr erfahren".'
        format = 'Max. 4 Wörter.'
        break
      case 'full':
        goal = 'Komplette Anzeige: Hook (1 Satz, max. 12 W) + Body (2-3 Sätze) + CTA (max. 4 W). Klar getrennt durch Labels.'
        format = 'Format: HOOK: ... \\n BODY: ... \\n CTA: ...'
        break
    }
  }

  const system = [
    role,
    'Du lieferst genau 3 sehr unterschiedliche, hochwertige Varianten.',
    'Antwort ist STRENG JSON: { "variants": [string, string, string] }.',
    'Kein Markdown, keine Kommentare, kein Drumherum. Nur das JSON-Objekt.',
  ].join('\n')

  const user = [
    `Ziel: ${goal}`,
    `Format pro Vorschlag: ${format}`,
    platformHint,
    titleHint,
    '',
    'Brand-Kontext:',
    ctx || '  (kein Kontext bisher)',
    '',
    adSiblingBlock(b) || null,
    '',
    current ? `Aktueller Text (verbessern / variieren, nicht 1:1 wiederholen):\n${current}` : 'Aktueller Text: (leer)',
    '',
    'Liefere 3 deutlich unterschiedliche Varianten in einem JSON-Objekt:',
    '{"variants": ["Variante 1", "Variante 2", "Variante 3"]}',
  ].filter(Boolean).join('\n')

  return { system, user }
}

function parseVariants(raw: string): string[] {
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()
  let obj: unknown
  try { obj = JSON.parse(cleaned) } catch {
    const m = cleaned.match(/\{[\s\S]*\}/)
    if (!m) return []
    try { obj = JSON.parse(m[0]) } catch { return [] }
  }
  if (!obj || typeof obj !== 'object') return []
  const arr = (obj as { variants?: unknown }).variants
  if (!Array.isArray(arr)) return []
  return arr.map((x) => typeof x === 'string' ? x.trim() : '').filter((s) => s.length > 0).slice(0, 3)
}

async function callClaude(apiKey: string, model: string, system: string, user: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens: 2048, system, messages: [{ role: 'user', content: user }] }),
  })
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${await res.text()}`)
  const data = await res.json() as { content?: Array<{ type: string; text?: string }> }
  return (data.content ?? []).find((c) => c.type === 'text')?.text ?? ''
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' })

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) return json(500, { error: 'anthropic_api_key_missing' })
  const model = Deno.env.get('ANTHROPIC_MODEL') || 'claude-sonnet-5'

  let body: Body
  try { body = await req.json() } catch { return json(400, { error: 'invalid_json' }) }

  if (!body || !body.kind || !body.field) return json(400, { error: 'missing_fields' })

  if (body.brand_id) {
    const auth = req.headers.get('authorization') ?? ''
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: userResp } = await supabase.auth.getUser(auth.replace('Bearer ', ''))
    if (!userResp.user) return json(403, { error: 'unauthorized' })
    const { data: brand } = await supabase.from('brands').select('user_id').eq('id', body.brand_id).maybeSingle()
    if (!brand || brand.user_id !== userResp.user.id) return json(403, { error: 'forbidden' })
  }

  const { system, user } = prompt(body)
  let raw: string
  try {
    raw = await callClaude(apiKey, model, system, user)
  } catch (err) {
    return json(502, { error: 'claude_failed', detail: err instanceof Error ? err.message : String(err) })
  }
  const variants = parseVariants(raw)
  if (variants.length === 0) return json(502, { error: 'no_variants', raw_preview: raw.slice(0, 400) })

  return json(200, { variants })
})
