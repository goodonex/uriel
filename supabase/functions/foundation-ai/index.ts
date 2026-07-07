/**
 * Foundation AI — Claude-basierte Vorschläge für Brand-Foundation-Felder.
 * Secrets: ANTHROPIC_API_KEY, optional ANTHROPIC_MODEL
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
}

type FoundationField =
  | "positioning_statement"
  | "tone_of_voice"
  | "business_model_who"
  | "business_model_what"
  | "business_model_how"
  | "business_model_for_whom"
  | "business_model_revenue"
  | "icp_notes"

interface Body {
  field: FoundationField
  current_value?: string
  brand_name?: string
  context?: {
    positioning_statement?: string
    tone_of_voice?: string
    business_model?: {
      who?: string
      what?: string
      how?: string
      for_whom?: string
      revenue?: string
    }
    icps?: Array<{
      name?: string
      pain_points?: string[]
      location?: string
      priority?: number
    }>
    word_bank?: { yes?: string[]; no?: string[] }
  }
}

const FIELD_HINTS: Record<FoundationField, { label: string; goal: string; format: string }> = {
  positioning_statement: {
    label: "Positioning Statement",
    goal:
      "Liefere eine prägnante, ehrliche Positionierung. Keine Floskeln, kein Marketing-Sprech. 1–2 Sätze, ca. 20–40 Wörter. Klar formuliert für wen, was und warum.",
    format: "Reiner Fließtext (1–2 Sätze).",
  },
  tone_of_voice: {
    label: "Tone of Voice",
    goal:
      "Beschreibe den Tone of Voice in 4–6 stichpunktartigen Aussagen. Konkrete Charakteristika, keine generischen Buzzwords.",
    format: "Mehrere Zeilen, jede Zeile beginnt mit einem Bullet (• ).",
  },
  business_model_who: {
    label: "Business Model · Wer (du / das Team)",
    goal:
      "Beschreibe das Team / die Person hinter der Brand in 1–2 Sätzen mit Substanz (Expertise, Haltung).",
    format: "Reiner Fließtext (1–2 Sätze).",
  },
  business_model_what: {
    label: "Business Model · Was (Angebot)",
    goal:
      "Beschreibe das Kernangebot konkret und in 1–2 Sätzen. Was wird tatsächlich geliefert?",
    format: "Reiner Fließtext (1–2 Sätze).",
  },
  business_model_how: {
    label: "Business Model · Wie (Prozess)",
    goal:
      "Beschreibe den Prozess / Liefer-Weg in 2–3 stichpunktartigen Schritten. Sehr konkret.",
    format: "Mehrere Zeilen, jede Zeile beginnt mit einem Bullet (• ).",
  },
  business_model_for_whom: {
    label: "Business Model · Für wen (Kunde)",
    goal:
      "Wer ist der ideale Kunde? 1–2 Sätze mit Branche, Stage und psychologischem Profil.",
    format: "Reiner Fließtext (1–2 Sätze).",
  },
  business_model_revenue: {
    label: "Business Model · Womit (Erlöse / Preis)",
    goal:
      "Wie verdient die Brand Geld? 1–2 Sätze mit Modell (Retainer, Projekt, Lizenz) und Preisrange.",
    format: "Reiner Fließtext (1–2 Sätze).",
  },
  icp_notes: {
    label: "ICP Notes",
    goal:
      "Notizen für eine Zielgruppe: Pain Points, Trigger, häufige Einwände. 3–5 Bullet-Points.",
    format: "Mehrere Zeilen, jede Zeile beginnt mit einem Bullet (• ).",
  },
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

function buildContextBlock(ctx: Body["context"], brandName?: string): string {
  const lines: string[] = []
  if (brandName) lines.push(`Brand: ${brandName}`)
  if (ctx?.positioning_statement) lines.push(`Positionierung: ${ctx.positioning_statement}`)
  if (ctx?.tone_of_voice) lines.push(`Tone of Voice: ${ctx.tone_of_voice}`)
  if (ctx?.business_model) {
    const bm = ctx.business_model
    const bmParts: string[] = []
    if (bm.who) bmParts.push(`Wer: ${bm.who}`)
    if (bm.what) bmParts.push(`Was: ${bm.what}`)
    if (bm.how) bmParts.push(`Wie: ${bm.how}`)
    if (bm.for_whom) bmParts.push(`Für wen: ${bm.for_whom}`)
    if (bm.revenue) bmParts.push(`Womit: ${bm.revenue}`)
    if (bmParts.length > 0) lines.push(`Business Model:\n  ${bmParts.join("\n  ")}`)
  }
  if (ctx?.icps && ctx.icps.length > 0) {
    const top = ctx.icps.slice(0, 3).map((i, idx) => {
      const pains = (i.pain_points ?? []).slice(0, 3).join(", ")
      return `  ICP ${idx + 1} (${i.name ?? "—"})${i.location ? " · " + i.location : ""}${pains ? " · Pains: " + pains : ""}`
    })
    lines.push(`ICPs:\n${top.join("\n")}`)
  }
  if (ctx?.word_bank) {
    const yes = (ctx.word_bank.yes ?? []).slice(0, 12).join(", ")
    const no = (ctx.word_bank.no ?? []).slice(0, 8).join(", ")
    if (yes) lines.push(`Wortbank · benutzen: ${yes}`)
    if (no) lines.push(`Wortbank · vermeiden: ${no}`)
  }
  return lines.join("\n")
}

function buildPrompt(body: Body): { system: string; user: string } {
  const hint = FIELD_HINTS[body.field]
  const ctx = buildContextBlock(body.context, body.brand_name)
  const current = body.current_value?.trim()
  const system = [
    "Du bist Senior Brand-Strategist und schreibst auf Deutsch.",
    "Du lieferst genau 3 sehr unterschiedliche, hochwertige Vorschläge für das angefragte Brand-Foundation-Feld.",
    "Antwort ist STRENG JSON: { \"variants\": [string, string, string] }.",
    "Kein Markdown, keine Kommentare, kein Drumherum. Nur das JSON-Objekt.",
  ].join("\n")
  const user = [
    `Feld: ${hint.label}`,
    `Ziel: ${hint.goal}`,
    `Format pro Vorschlag: ${hint.format}`,
    "",
    "Brand-Kontext:",
    ctx || "  (kein Kontext bisher)",
    "",
    current
      ? `Aktueller Text (verbessern / variieren, nicht 1:1 wiederholen):\n${current}`
      : "Aktueller Text: (leer)",
    "",
    "Liefere 3 deutlich unterschiedliche Varianten in einem JSON-Objekt:",
    "{\"variants\": [\"Variante 1\", \"Variante 2\", \"Variante 3\"]}",
  ].join("\n")
  return { system, user }
}

function parseVariants(raw: string): string[] {
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim()
  let obj: unknown
  try {
    obj = JSON.parse(cleaned)
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (!match) return []
    try {
      obj = JSON.parse(match[0])
    } catch {
      return []
    }
  }
  if (!obj || typeof obj !== "object") return []
  const arr = (obj as { variants?: unknown }).variants
  if (!Array.isArray(arr)) return []
  return arr
    .map((x) => (typeof x === "string" ? x.trim() : ""))
    .filter((s) => s.length > 0)
    .slice(0, 3)
}

async function callClaude(
  apiKey: string,
  model: string,
  system: string,
  user: string,
): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      system,
      messages: [{ role: "user", content: user }],
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Anthropic API ${res.status}: ${text}`)
  }
  const data = await res.json() as {
    content?: Array<{ type: string; text?: string }>
  }
  const block = (data.content ?? []).find((c) => c.type === "text")
  return block?.text ?? ""
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }
  if (req.method !== "POST") {
    return json(405, { error: "Method Not Allowed" })
  }
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY")
  if (!apiKey) return json(500, { error: "ANTHROPIC_API_KEY fehlt" })
  const model = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-sonnet-5"

  let body: Body
  try {
    body = await req.json()
  } catch {
    return json(400, { error: "Invalid JSON body" })
  }
  if (!body.field || !(body.field in FIELD_HINTS)) {
    return json(400, { error: "Unbekanntes Feld" })
  }

  const { system, user } = buildPrompt(body)
  try {
    const raw = await callClaude(apiKey, model, system, user)
    const variants = parseVariants(raw)
    if (variants.length === 0) {
      return json(502, { error: "Konnte keine Varianten parsen", raw })
    }
    return json(200, { variants })
  } catch (err) {
    return json(502, { error: (err as Error).message })
  }
})
