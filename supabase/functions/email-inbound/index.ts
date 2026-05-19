/**
 * email-inbound — Resend Inbound Webhook
 * POST /functions/v1/email-inbound
 * Empfänger: leads+{brandSlug}@frameworkos.de
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

function extractEmail(raw: string): string {
  const m = raw.match(/<([^>]+)>/)
  const addr = (m?.[1] ?? raw).trim().toLowerCase()
  return addr
}

function brandSlugFromRecipient(to: string): string | null {
  const m = to.match(/leads\+([a-z0-9-]+)@frameworkos\.de/i)
  return m?.[1]?.toLowerCase() ?? null
}

function previewBody(text: string, html: string): string {
  const raw = text?.trim() || html?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || ''
  return raw.slice(0, 500)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  let payload: Record<string, unknown>
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }

  const data = (payload.data ?? payload) as Record<string, unknown>
  const fromRaw = String(data.from ?? data.sender ?? '')
  const toRaw = Array.isArray(data.to) ? String(data.to[0] ?? '') : String(data.to ?? '')
  const subject = String(data.subject ?? '')
  const text = String(data.text ?? '')
  const html = String(data.html ?? '')

  const brandSlug = brandSlugFromRecipient(toRaw)
  if (!brandSlug) {
    console.warn('[email-inbound] no brand slug in recipient', toRaw)
    return json({ ok: true, matched: false, reason: 'no_brand_slug' })
  }

  const senderEmail = extractEmail(fromRaw)
  if (!senderEmail) return json({ ok: true, matched: false, reason: 'no_sender' })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  const { data: brand } = await supabase
    .from('brands')
    .select('id')
    .eq('slug', brandSlug)
    .maybeSingle()
  if (!brand?.id) return json({ ok: true, matched: false, reason: 'brand_not_found' })

  const { data: contact } = await supabase
    .from('contacts')
    .select('id')
    .eq('brand_id', brand.id)
    .ilike('email', senderEmail)
    .maybeSingle()

  if (!contact?.id) {
    console.warn('[email-inbound] contact not found', senderEmail, brandSlug)
    return json({ ok: true, matched: false, reason: 'contact_not_found' })
  }

  const bodyPreview = previewBody(text, html)
  const { error: insErr } = await supabase.from('sales_email_logs').insert({
    brand_id: brand.id,
    contact_id: contact.id,
    direction: 'inbound',
    subject: subject.slice(0, 500),
    body_preview: bodyPreview,
    sent_at: new Date().toISOString(),
  })

  if (insErr) {
    console.error('[email-inbound] insert failed', insErr.message)
    return json({ error: 'insert_failed', detail: insErr.message }, 500)
  }

  return json({ ok: true, matched: true, contact_id: contact.id })
})
