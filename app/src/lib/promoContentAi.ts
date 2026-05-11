import type { ContentChannel, ContentFormat, ICP, WordBankEntry } from '../types/db'

export function buildFoundationPromptParts(args: {
  brandName: string
  positioningStatement: string
  toneOfVoice: string
  icps: ICP[]
  wordBankYes: WordBankEntry[]
}): { icpNamesAndPainpoints: string; jaWoerter: string } {
  const icpLines = args.icps.map((i) => {
    const pains = (i.pain_points ?? []).filter(Boolean).join('; ')
    return `${i.name}${pains ? ` — Schmerzpunkte: ${pains}` : ''}`
  })
  const ja = args.wordBankYes.map((w) => w.word).filter(Boolean)
  return {
    icpNamesAndPainpoints: icpLines.join('\n') || '—',
    jaWoerter: ja.join(', ') || '—',
  }
}

export function ideaFormatToContentFormat(format: string): ContentFormat {
  switch (format) {
    case 'mail':
      return 'email'
    case 'artikel':
      return 'article'
    case 'karussell':
      return 'carousel'
    case 'ad':
      return 'other'
    case 'post':
    case 'reel':
    case 'story':
      return format
    default:
      return 'post'
  }
}

export function ideaKanalToChannel(kanal: string): ContentChannel {
  const k = kanal.toLowerCase()
  if (k === 'linkedin') return 'linkedin'
  if (k === 'instagram') return 'instagram'
  if (k === 'tiktok') return 'tiktok'
  if (k === 'website' || k === 'web') return 'website'
  if (k === 'mail' || k === 'email' || k === 'e-mail') return 'email'
  return 'linkedin'
}

function para(text: string): Record<string, unknown> {
  return {
    type: 'paragraph',
    content: text ? [{ type: 'text', text }] : [],
  }
}

export function buildTipTapFromIdeaTexts(parts: {
  hook?: string
  skript?: string
  cta?: string
  hashtags?: string[]
}): Record<string, unknown> {
  const paragraphs: Record<string, unknown>[] = []
  if (parts.hook?.trim()) paragraphs.push(para(parts.hook.trim()))
  if (parts.skript?.trim()) paragraphs.push(para(parts.skript.trim()))
  if (parts.cta?.trim()) paragraphs.push(para(parts.cta.trim()))
  if (parts.hashtags?.length) {
    paragraphs.push(
      para(parts.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ')),
    )
  }
  if (paragraphs.length === 0) {
    return { type: 'doc', content: [{ type: 'paragraph' }] }
  }
  return { type: 'doc', content: paragraphs }
}

export interface AnthropicContentResult {
  hook: string
  haupttext: string
  cta: string
  hashtags: string[]
  a_roll: string
  b_roll: string
}

export function getAnthropicApiKey(): string | undefined {
  const env = import.meta.env as Record<string, string | undefined>
  return env.VITE_ANTHROPIC_API_KEY?.trim() || env.ANTHROPIC_API_KEY?.trim()
}

export async function generateAnthropicContent(args: {
  brandName: string
  positioningStatement: string
  toneOfVoice: string
  icpNamesAndPainpoints: string
  jaWoerter: string
  format: string
  kanal: string
  titelHint: string
}): Promise<AnthropicContentResult> {
  const key = getAnthropicApiKey()
  if (!key) throw new Error('Kein API Key')

  const system = `Du bist ein Content-Stratege für die Brand ${args.brandName}. Erstelle Content der zur Brand passt und die Zielgruppe wirklich anspricht.`

  const user = `Brand Info:
Positioning: ${args.positioningStatement}
Ton: ${args.toneOfVoice}
Zielgruppe: ${args.icpNamesAndPainpoints}
Ja-Wörter: ${args.jaWoerter}

Erstelle für das Format '${args.format}' auf '${args.kanal}':
Titel/Thema: ${args.titelHint || '(frei wählen)'}

Antworte NUR als JSON, ohne Markdown-Fences:
{
  "hook": "string (erster Satz der stoppt)",
  "haupttext": "string (der Kern-Content)",
  "cta": "string (Call to Action)",
  "hashtags": ["string", "string"],
  "a_roll": "string (was vor der Kamera passiert)",
  "b_roll": "string (Ergänzungsbilder/-videos)"
}

Die hashtags-Array muss genau 5 Einträge haben.`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  })

  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error(t || `Anthropic ${res.status}`)
  }

  const json = (await res.json()) as {
    content?: { type: string; text?: string }[]
  }
  const text =
    json.content?.map((b) => (b.type === 'text' ? b.text ?? '' : '')).join('') ?? ''
  let cleaned = text.trim()
  const fence = cleaned.match(/^```(?:json)?\s*([\s\S]*?)```$/m)
  if (fence) cleaned = fence[1].trim()

  const parsed = JSON.parse(cleaned) as Record<string, unknown>
  const hashtagsRaw = parsed.hashtags
  const hashtags = Array.isArray(hashtagsRaw)
    ? hashtagsRaw.map((h) => String(h)).filter(Boolean).slice(0, 5)
    : []

  while (hashtags.length < 5) hashtags.push('')

  return {
    hook: String(parsed.hook ?? ''),
    haupttext: String(parsed.haupttext ?? ''),
    cta: String(parsed.cta ?? ''),
    hashtags,
    a_roll: String(parsed.a_roll ?? ''),
    b_roll: String(parsed.b_roll ?? ''),
  }
}
