/**
 * Discovery Feed Refresh — Perplexity (Signale), Archiv >90 Tage.
 * Auth: x-discovery-cron-secret === DISCOVERY_CRON_SECRET (Cron)
 *    oder Authorization: Bearer <User-JWT> + body.brand_id (manuell).
 * Secret: PERPLEXITY_API_KEY (optional ANTHROPIC_* nicht nötig).
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1"

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-discovery-cron-secret",
}

function json(status: number, b: Record<string, unknown>) {
  return new Response(JSON.stringify(b), {
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

function extractJsonObject(text: string): Record<string, unknown> | null {
  let t = text.trim()
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim()
  }
  const start = t.indexOf("{")
  const end = t.lastIndexOf("}")
  if (start === -1 || end <= start) return null
  try {
    return JSON.parse(t.slice(start, end + 1)) as Record<string, unknown>
  } catch {
    return null
  }
}

type FeedItem = {
  category: "competitor" | "format" | "trend" | "icp_search"
  title: string
  summary: string
  signal_strength: "low" | "medium" | "high"
}

async function fetchNewFeedItems(
  apiKey: string,
  niche: string,
  market: string,
  competitors: string,
): Promise<FeedItem[]> {
  const p = `Du bist Research-Analyst DACH / Deutschland 2026.
Nische: "${niche || "nicht angegeben"}". Markt/Kontext: "${market || "nicht angegeben"}". Wettbewerber: "${competitors || "nicht angegeben"}".

Liefere NUR gültiges JSON (kein Markdown):
{"items":[
  {"category":"trend","title":string,"summary":string,"signal_strength":"low"|"medium"|"high"},
  ...
]}
Regeln:
- 5 bis 7 items gesamt
- Mindestens 2 category "trend" (Trend-Themen in der Nische)
- Mindestens 2 category "competitor" (konkrete Wettbewerber-Aktivitäten / Kampagnen / Positionierung)
- Mindestens 2 category "format" (Content-Formate die aktuell performen)
- Kurze title (max 120 Zeichen), summary mit konkretem Signal (max 800 Zeichen)
- signal_strength realistisch setzen`

  const raw = await perplexityQuery(apiKey, p)
  const obj = extractJsonObject(raw)
  const items = obj?.items
  if (!Array.isArray(items)) return []

  const out: FeedItem[] = []
  const allowedCat = new Set(["competitor", "format", "trend", "icp_search"])
  const allowedSig = new Set(["low", "medium", "high"])

  for (const it of items) {
    if (!it || typeof it !== "object") continue
    const o = it as Record<string, unknown>
    const cat = String(o.category ?? "")
    const title = String(o.title ?? "").trim().slice(0, 200)
    const summary = String(o.summary ?? "").trim().slice(0, 2000)
    const sig = String(o.signal_strength ?? "medium")
    if (!allowedCat.has(cat) || !title) continue
    const signal_strength = allowedSig.has(sig)
      ? (sig as FeedItem["signal_strength"])
      : "medium"
    out.push({
      category: cat as FeedItem["category"],
      title,
      summary,
      signal_strength,
    })
  }
  return out.slice(0, 8)
}

async function archiveOld(
  client: ReturnType<typeof createClient>,
  brandId: string,
): Promise<void> {
  const cutoff = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString()
  const archivedAt = new Date().toISOString()
  await client
    .from("discovery_feed_items")
    .update({ archived_at: archivedAt })
    .eq("brand_id", brandId)
    .is("archived_at", null)
    .lt("recorded_at", cutoff)
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  const perplexityKey = Deno.env.get("PERPLEXITY_API_KEY")?.trim()
  if (!perplexityKey) {
    return json(500, {
      ok: false,
      code: "MISSING_API_KEYS",
      message:
        "API Keys fehlen — bitte PERPLEXITY_API_KEY in Supabase Edge Functions Secrets eintragen.",
      docsPath: "docs/open-questions.md",
    })
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!
  const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const cronSecret = Deno.env.get("DISCOVERY_CRON_SECRET")?.trim()

  const headerCron = req.headers.get("x-discovery-cron-secret")?.trim()
  const authHeader = req.headers.get("Authorization")
  const isCron = Boolean(cronSecret && headerCron && headerCron === cronSecret)

  let brandIds: string[] = []
  const admin = createClient(supabaseUrl, serviceKey)

  if (isCron) {
    const { data: rows, error: e1 } = await admin
      .from("discovery_foundation")
      .select("brand_id")
    if (e1) {
      return json(500, { ok: false, message: e1.message })
    }
    brandIds = [...new Set((rows ?? []).map((r: { brand_id: string }) => r.brand_id))]
  } else {
    if (!authHeader?.startsWith("Bearer ")) {
      return json(401, { ok: false, message: "Unauthorized" })
    }
    let body: { brand_id?: string }
    try {
      body = (await req.json()) as { brand_id?: string }
    } catch {
      return json(400, { ok: false, message: "Invalid JSON body" })
    }
    if (!body.brand_id) {
      return json(400, { ok: false, message: "brand_id required" })
    }

    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user },
      error: uErr,
    } = await userClient.auth.getUser()
    if (uErr || !user) {
      return json(401, { ok: false, message: "Invalid session" })
    }

    const { data: brandRow, error: bErr } = await userClient
      .from("brands")
      .select("id, user_id")
      .eq("id", body.brand_id)
      .maybeSingle()

    if (bErr || !brandRow || brandRow.user_id !== user.id) {
      return json(403, { ok: false, message: "Brand not allowed" })
    }
    brandIds = [body.brand_id]
  }

  const userDb =
    !isCron && authHeader
      ? createClient(supabaseUrl, supabaseAnon, {
          global: { headers: { Authorization: authHeader } },
        })
      : null

  let processed = 0
  let inserted = 0

  for (const brandId of brandIds) {
    const client = isCron ? admin : userDb!
    const { data: foundation, error: fErr } = await admin
      .from("discovery_foundation")
      .select("market, competitors, niche")
      .eq("brand_id", brandId)
      .maybeSingle()

    if (fErr || !foundation) continue

    const niche = (foundation.niche as string) ?? ""
    const market = (foundation.market as string) ?? ""
    const competitors = (foundation.competitors as string) ?? ""

    let items: FeedItem[] = []
    try {
      items = await fetchNewFeedItems(perplexityKey, niche, market, competitors)
    } catch (e) {
      console.error("[discovery-feed-refresh] perplexity:", e)
      continue
    }

    if (items.length) {
      const now = new Date().toISOString()
      const rows = items.map((it) => ({
        id: crypto.randomUUID(),
        brand_id: brandId,
        category: it.category,
        title: it.title,
        summary: it.summary,
        signal_strength: it.signal_strength,
        recorded_at: now,
      }))
      const { error: insErr } = await client.from("discovery_feed_items").insert(rows)
      if (insErr) {
        console.error("[discovery-feed-refresh] insert:", insErr.message)
        continue
      }
      inserted += rows.length
    }

    await archiveOld(client, brandId)
    processed += 1
  }

  return json(200, { ok: true, brands_processed: processed, items_inserted: inserted })
})
