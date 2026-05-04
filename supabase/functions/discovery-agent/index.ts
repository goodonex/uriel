/**
 * Discovery Agent — Perplexity (Web) + Claude (Strukturierung)
 * Secrets: PERPLEXITY_API_KEY, ANTHROPIC_API_KEY, optional ANTHROPIC_MODEL
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1"

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
}

interface Body {
  brand_id: string
  market: string
  competitors: string
  niche: string
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

async function perplexityQuery(apiKey: string, userMessage: string): Promise<string> {
  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "sonar",
      messages: [{ role: "user", content: userMessage }],
    }),
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Perplexity ${res.status}: ${t.slice(0, 500)}`)
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  return data.choices?.[0]?.message?.content?.trim() ?? ""
}

async function claudeJson<T>(apiKey: string, model: string, userPrompt: string): Promise<T> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      messages: [{ role: "user", content: userPrompt }],
    }),
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Claude ${res.status}: ${t.slice(0, 500)}`)
  }
  const data = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>
  }
  const text = data.content?.find((c) => c.type === "text")?.text ?? ""
  let t = text.trim()
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim()
  }
  return JSON.parse(t) as T
}

type ClaudeOut = {
  icp_drafts: Array<{
    name: string
    age_range?: string
    location?: string
    pain_points?: string[]
  }>
  word_bank_yes: Array<{ word: string; cluster?: string }>
  word_bank_no: Array<{ word: string; cluster?: string }>
  positioning_statement: string
  content_formats: Array<{ name: string; rationale: string }>
  competitor_insights: Array<{ headline: string; detail: string }>
  tone_of_voice: string
}

function toStoredAnalysis(
  raw: ClaudeOut,
  researchSnippets: string[],
): Record<string, unknown> {
  const icp_drafts = (raw.icp_drafts ?? []).slice(0, 5).map((d) => ({
    name: d.name ?? "ICP",
    age_range: d.age_range ?? "",
    location: d.location ?? "",
    pain_hint: Array.isArray(d.pain_points)
      ? d.pain_points.join(" · ")
      : "",
  }))

  const yes = (raw.word_bank_yes ?? []).slice(0, 8)
  const no = (raw.word_bank_no ?? []).slice(0, 8)
  const word_bank_suggestions = [
    ...yes.map((w) => ({
      word: String(w.word ?? "").trim(),
      type: "yes" as const,
      cluster: (w.cluster ?? "Discovery").trim() || "Discovery",
    })),
    ...no.map((w) => ({
      word: String(w.word ?? "").trim(),
      type: "no" as const,
      cluster: (w.cluster ?? "Discovery").trim() || "Discovery",
    })),
  ].filter((w) => w.word.length > 0)

  const ps = (raw.positioning_statement ?? "").trim()
  const positioning_ideas = ps
    ? ps.split(/(?<=[.!?])\s+/).filter(Boolean).slice(0, 3)
    : []

  return {
    icp_drafts,
    word_bank_suggestions,
    positioning_ideas: positioning_ideas.length ? positioning_ideas : ps ? [ps] : [],
    content_formats: (raw.content_formats ?? []).slice(0, 8).map((c) => ({
      format_name: c.name ?? "",
      rationale: c.rationale ?? "",
    })),
    competitor_insights: (raw.competitor_insights ?? []).slice(0, 6).map((c) => ({
      headline: c.headline ?? "",
      detail: c.detail ?? "",
    })),
    tone_of_voice: (raw.tone_of_voice ?? "").trim(),
    research_snippets: researchSnippets,
  }
}

function buildFeedRows(
  brandId: string,
  analysis: Record<string, unknown>,
): Array<{
  id: string
  brand_id: string
  category: string
  title: string
  summary: string
  signal_strength: string
  recorded_at: string
}> {
  const now = new Date().toISOString()
  const out: Array<{
    id: string
    brand_id: string
    category: string
    title: string
    summary: string
    signal_strength: string
    recorded_at: string
  }> = []

  const comps = analysis.competitor_insights as
    | Array<{ headline: string; detail: string }>
    | undefined
  for (const c of comps ?? []) {
    if (!c?.headline && !c?.detail) continue
    out.push({
      id: crypto.randomUUID(),
      brand_id: brandId,
      category: "competitor",
      title: (c.headline || "Insight").slice(0, 200),
      summary: (c.detail || "").slice(0, 2000),
      signal_strength: "medium",
      recorded_at: now,
    })
  }

  const forms = analysis.content_formats as
    | Array<{ format_name: string; rationale: string }>
    | undefined
  for (const f of forms ?? []) {
    if (!f?.format_name && !f?.rationale) continue
    out.push({
      id: crypto.randomUUID(),
      brand_id: brandId,
      category: "format",
      title: (f.format_name || "Format").slice(0, 200),
      summary: (f.rationale || "").slice(0, 2000),
      signal_strength: "high",
      recorded_at: now,
    })
  }

  const icps = analysis.icp_drafts as
    | Array<{ name: string; pain_hint?: string }>
    | undefined
  for (const d of (icps ?? []).slice(0, 2)) {
    if (!d?.name) continue
    out.push({
      id: crypto.randomUUID(),
      brand_id: brandId,
      category: "icp_search",
      title: `Zielgruppe: ${d.name}`.slice(0, 200),
      summary: (d.pain_hint || "Schmerzpunkt aus Analyse.").slice(0, 2000),
      signal_strength: "low",
      recorded_at: now,
    })
  }

  let filler = 0
  while (out.length < 5 && filler < 3) {
    filler += 1
    out.push({
      id: crypto.randomUUID(),
      brand_id: brandId,
      category: "trend",
      title: `Markttrend / Nische (${filler})`,
      summary:
        "Aggregierte Signale aus Research & Analyse — Details in der Foundation.",
      signal_strength: "medium",
      recorded_at: now,
    })
  }

  return out.slice(0, 8)
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  const perplexityKey = Deno.env.get("PERPLEXITY_API_KEY")?.trim()
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")?.trim()
  const anthropicModel =
    Deno.env.get("ANTHROPIC_MODEL")?.trim() || "claude-sonnet-4-20250514"

  if (!perplexityKey || !anthropicKey) {
    return json(500, {
      ok: false,
      code: "MISSING_API_KEYS",
      message:
        "API Keys fehlen — bitte PERPLEXITY_API_KEY und ANTHROPIC_API_KEY in Supabase Edge Functions Secrets eintragen.",
      docsPath: "docs/open-questions.md",
    })
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!
  const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

  const authHeader = req.headers.get("Authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    return json(401, { ok: false, message: "Unauthorized" })
  }

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return json(400, { ok: false, message: "Invalid JSON body" })
  }

  const { brand_id, market, competitors, niche } = body
  if (!brand_id) {
    return json(400, { ok: false, message: "brand_id required" })
  }

  const userClient = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: authHeader } },
  })

  const {
    data: { user },
    error: userErr,
  } = await userClient.auth.getUser()
  if (userErr || !user) {
    return json(401, { ok: false, message: "Invalid session" })
  }

  const { data: brandRow, error: brandErr } = await userClient
    .from("brands")
    .select("id, user_id")
    .eq("id", brand_id)
    .maybeSingle()

  if (brandErr || !brandRow || brandRow.user_id !== user.id) {
    return json(403, { ok: false, message: "Brand not allowed" })
  }

  const admin = createClient(supabaseUrl, serviceKey)

  const searches = [
    `${niche} Trends Deutschland 2026`,
    `${competitors || "Branche"} Marketing Strategie aktuell`,
    `${market || "Markt"} Zielgruppe Schmerzpunkte`,
    `${niche} Content Formate die performen`,
    `${market || "Markt"} Wettbewerb Deutschland`,
  ]

  const researchSnippets: string[] = []
  try {
    for (const q of searches) {
      const ans = await perplexityQuery(perplexityKey, q)
      researchSnippets.push(`### ${q}\n${ans}`)
    }
  } catch (e) {
    return json(502, {
      ok: false,
      code: "PERPLEXITY_ERROR",
      message: e instanceof Error ? e.message : "Perplexity failed",
    })
  }

  const bundle = researchSnippets.join("\n\n---\n\n")

  const claudePrompt = `Du bist Strategie-Analyst für Personal Brands (DACH).

Marktdaten aus Web-Recherche (Quellen zusammengefasst):
---
${bundle.slice(0, 120_000)}
---

Kontext vom Nutzer:
- Markt / Kontext: ${market || "(nicht angegeben)"}
- Wettbewerber: ${competitors || "(nicht angegeben)"}
- Nische: ${niche || "(nicht angegeben)"}

Analysiere diese Marktdaten für eine Brand im Bereich ${niche || market || "allgemein"}.

Extrahiere und antworte NUR als gültiges JSON (kein Markdown, keine Erklärung außerhalb):
{
  "icp_drafts": [ { "name": string, "age_range"?: string, "location"?: string, "pain_points": string[] } ],
  "word_bank_yes": [ { "word": string, "cluster"?: string } ],
  "word_bank_no": [ { "word": string, "cluster"?: string } ],
  "positioning_statement": string,
  "content_formats": [ { "name": string, "rationale": string } ],
  "competitor_insights": [ { "headline": string, "detail": string } ],
  "tone_of_voice": string
}

Regeln:
- Genau 3 ICPs in icp_drafts, jeweils 2–5 pain_points
- word_bank_yes: 5 Begriffe, word_bank_no: 5 Begriffe (keine Duplikate)
- positioning_statement: höchstens 2 Sätze
- content_formats: 5 Einträge (Formate die gerade performen)
- competitor_insights: 3 Einträge
- tone_of_voice: ein prägnanter Satz Empfehlung`

  let parsed: ClaudeOut
  try {
    parsed = await claudeJson<ClaudeOut>(anthropicKey, anthropicModel, claudePrompt)
  } catch (e) {
    return json(502, {
      ok: false,
      code: "CLAUDE_ERROR",
      message: e instanceof Error ? e.message : "Claude failed",
    })
  }

  const analysis = toStoredAnalysis(parsed, researchSnippets.map((s) => s.slice(0, 1500)))
  const runAt = new Date().toISOString()

  const { data: existing } = await admin
    .from("discovery_foundation")
    .select("id")
    .eq("brand_id", brand_id)
    .maybeSingle()

  const row = {
    id: existing?.id ?? crypto.randomUUID(),
    brand_id,
    market: market ?? "",
    competitors: competitors ?? "",
    niche: niche ?? "",
    analysis,
    analysis_run_at: runAt,
    analysis_status: "complete",
    updated_at: runAt,
  }

  const { error: upErr } = await admin.from("discovery_foundation").upsert(row, {
    onConflict: "brand_id",
  })
  if (upErr) {
    return json(500, { ok: false, message: upErr.message })
  }

  const feedRows = buildFeedRows(brand_id, analysis)
  if (feedRows.length) {
    const { error: feedErr } = await admin.from("discovery_feed_items").insert(feedRows)
    if (feedErr) {
      console.error("[discovery-agent] feed insert:", feedErr.message)
    }
  }

  return json(200, { ok: true, analysis, analysis_run_at: runAt })
})
