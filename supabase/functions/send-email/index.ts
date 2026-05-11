/**
 * send-email — Versendet eine E-Mail via Resend + injectet einen Open-Tracking-Pixel
 *                und schreibt einen Eintrag in sales_email_logs.
 *
 * Aufrufer (Client): per supabase.functions.invoke('send-email', { body })
 * Aufrufer (Worker process-sequences): mit Service-Role-Auth.
 *
 * Secrets: RESEND_API_KEY, optional RESEND_FROM_EMAIL, RESEND_FROM_NAME, PUBLIC_API_BASE
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface SendBody {
  brand_id: string
  contact_id: string
  subject: string
  body: string
  template_id?: string | null
  sequence_id?: string | null
  enrollment_id?: string | null
  from_email?: string | null
  from_name?: string | null
}

interface ResendResp {
  id?: string
  message?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405)
  }

  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
  if (!RESEND_API_KEY) return json({ error: 'resend_api_key_missing' }, 500)

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const PUBLIC_API_BASE = Deno.env.get('PUBLIC_API_BASE') ?? SUPABASE_URL

  const auth = req.headers.get('authorization') ?? ''
  // Wenn der Aufruf vom Client kommt, validieren wir gegen die User-JWT.
  // Wenn intern (Worker), erlauben wir Service-Role-Auth (kein User).
  const isInternal = auth.includes(SERVICE_ROLE)

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: isInternal
      ? undefined
      : { headers: { Authorization: auth } },
  })

  let payload: SendBody
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }

  if (!payload.brand_id || !payload.contact_id || !payload.subject || !payload.body) {
    return json({ error: 'missing_fields' }, 400)
  }

  // Kontakt + E-Mail-Adresse laden (Service-Role umgeht RLS; für externe Aufrufer prüfen wir
  // unten via brand_id ownership-check)
  const { data: contact, error: cErr } = await supabase
    .from('contacts')
    .select('id, brand_id, email, name')
    .eq('id', payload.contact_id)
    .maybeSingle()

  if (cErr || !contact) return json({ error: 'contact_not_found' }, 404)
  if (contact.brand_id !== payload.brand_id) return json({ error: 'brand_mismatch' }, 403)
  if (!contact.email) return json({ error: 'contact_has_no_email' }, 400)

  // Brand laden (für Owner-Check + Defaults)
  const { data: brand } = await supabase
    .from('brands')
    .select('id, user_id, name')
    .eq('id', payload.brand_id)
    .maybeSingle()
  if (!brand) return json({ error: 'brand_not_found' }, 404)

  if (!isInternal) {
    // Auth-Token validieren → user_id muss zur brand passen
    const { data: userResp } = await supabase.auth.getUser(auth.replace('Bearer ', ''))
    if (!userResp.user || userResp.user.id !== brand.user_id) {
      return json({ error: 'unauthorized' }, 403)
    }
  }

  // Tracking-ID + Pixel-URL bauen
  const trackingId = crypto.randomUUID()
  const pixelUrl = `${PUBLIC_API_BASE}/functions/v1/track-open?id=${trackingId}`

  const fromEmail =
    (payload.from_email && payload.from_email.trim()) ||
    Deno.env.get('RESEND_FROM_EMAIL') ||
    'noreply@example.com'
  const fromName =
    (payload.from_name && payload.from_name.trim()) ||
    Deno.env.get('RESEND_FROM_NAME') ||
    brand.name ||
    'Brand OS'

  // HTML-Body bauen (mit Pixel) — bei Plain-Text wandeln wir Zeilenumbrüche in <br>
  const htmlBody = wrapHtml(payload.body, pixelUrl)
  const textBody = stripHtml(payload.body)

  // Resend-API
  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: `${fromName} <${fromEmail}>`,
      to: [contact.email],
      subject: payload.subject,
      html: htmlBody,
      text: textBody,
      headers: {
        'X-Tracking-Id': trackingId,
      },
    }),
  })

  const resendJson: ResendResp = await resendRes.json().catch(() => ({}))
  if (!resendRes.ok) {
    return json(
      { error: 'resend_failed', detail: resendJson.message ?? 'unknown' },
      resendRes.status,
    )
  }

  // Log schreiben
  const { data: log, error: lErr } = await supabase
    .from('sales_email_logs')
    .insert({
      brand_id: payload.brand_id,
      contact_id: payload.contact_id,
      template_id: payload.template_id ?? null,
      sequence_id: payload.sequence_id ?? null,
      enrollment_id: payload.enrollment_id ?? null,
      subject: payload.subject,
      body_preview: textBody.slice(0, 240),
      tracking_id: trackingId,
      direction: 'outbound',
      resend_id: resendJson.id ?? '',
      from_email: fromEmail,
      from_name: fromName,
      to_email: contact.email,
    })
    .select('id')
    .maybeSingle()

  if (lErr) {
    return json({ error: 'log_insert_failed', detail: lErr.message }, 500)
  }

  // Letzter-Kontakt + Activity-Log
  await supabase
    .from('contacts')
    .update({ last_contact_at: new Date().toISOString() })
    .eq('id', payload.contact_id)

  return json({
    ok: true,
    log_id: log?.id,
    tracking_id: trackingId,
    resend_id: resendJson.id,
  })
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function wrapHtml(rawBody: string, pixelUrl: string): string {
  // Erkennt grob, ob der Body bereits HTML enthält
  const looksLikeHtml = /<\w+[^>]*>/.test(rawBody)
  const inner = looksLikeHtml
    ? rawBody
    : `<p style="font-family:system-ui,Helvetica,sans-serif;font-size:14px;line-height:1.55;color:#1a1a1a;white-space:pre-wrap;">${escapeHtml(rawBody)}</p>`
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#fafafa;">
<div style="max-width:600px;margin:0 auto;background:#ffffff;padding:32px;border-radius:8px;">
${inner}
</div>
<img src="${pixelUrl}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;" />
</body></html>`
}

function stripHtml(s: string): string {
  return s
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .trim()
}
