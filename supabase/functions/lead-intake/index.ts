// lead-intake — öffentliches Lead-Formular.
// POST /functions/v1/lead-intake
// Body: { brand_slug, name, email, phone?, message?, company?, campaign?, source?, medium?, content? }
// Schreibt einen Kontakt in `contacts` mit pipeline_stage='first_contact'.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface Body {
  brand_slug: string
  name: string
  email: string
  phone?: string
  message?: string
  company?: string
  /** Honeypot. */
  website?: string
  campaign?: string
  source?: string
  medium?: string
  content?: string
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  let body: Body
  try { body = await req.json() } catch { return json({ error: 'invalid_json' }, 400) }

  if (body.website && body.website.trim().length > 0) {
    return json({ ok: true, suppressed: true })
  }
  if (!body.brand_slug || !body.name || !body.email) {
    return json({ error: 'missing_fields' }, 400)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  const { data: brand } = await supabase
    .from('brands')
    .select('id, name, slug, user_id')
    .eq('slug', body.brand_slug)
    .maybeSingle()
  if (!brand) return json({ error: 'brand_not_found' }, 404)

  let campaignId: string | null = null
  let campaignName = ''
  if (body.campaign && body.campaign.trim()) {
    const { data: c } = await supabase
      .from('ad_campaigns')
      .select('id, name')
      .eq('brand_id', brand.id)
      .eq('utm_campaign', body.campaign.trim())
      .maybeSingle()
    if (c) {
      campaignId = c.id
      campaignName = c.name
    }
  }

  const sourceLabel = campaignName || body.campaign || body.source || 'website'
  const now = new Date().toISOString()
  const activityEntry = {
    id: crypto.randomUUID(),
    at: now,
    text: `Lead via ${sourceLabel} eingegangen${body.message ? ': ' + body.message.slice(0, 240) : ''}`,
  }

  const noteParts: string[] = []
  if (sourceLabel) noteParts.push(`[Quelle: ${sourceLabel}]`)
  if (body.medium) noteParts.push(`[Medium: ${body.medium}]`)
  if (body.content) noteParts.push(`[Content: ${body.content}]`)
  if (body.message) noteParts.push(body.message.trim())

  const insertRow: Record<string, unknown> = {
    brand_id: brand.id,
    name: body.name.trim().slice(0, 200),
    email: body.email.trim().slice(0, 200),
    phone: (body.phone ?? '').trim().slice(0, 60),
    company: (body.company ?? '').trim().slice(0, 160),
    notes: noteParts.join('\n').slice(0, 2000),
    pipeline_stage: 'first_contact',
    last_contact_at: now,
    stage_changed_at: now,
    ad_campaign_id: campaignId,
    activity_log: [activityEntry],
  }

  const { data: contact, error: insErr } = await supabase
    .from('contacts')
    .insert(insertRow)
    .select('id')
    .maybeSingle()

  if (insErr) return json({ error: 'insert_failed', detail: insErr.message }, 500)

  if (campaignId) {
    const { data: cur } = await supabase
      .from('ad_campaigns')
      .select('leads_count')
      .eq('id', campaignId)
      .maybeSingle()
    await supabase
      .from('ad_campaigns')
      .update({ leads_count: (cur?.leads_count ?? 0) + 1 })
      .eq('id', campaignId)
  }

  return json({ ok: true, contact_id: contact?.id })
})
