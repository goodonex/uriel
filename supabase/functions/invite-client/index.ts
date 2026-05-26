/**
 * invite-client — Legt Client-Auth-User an, verknüpft user_roles, sendet Magic-Link per Resend.
 *
 * POST { project_id, client_email, client_name? }
 * Auth: Owner-JWT (Brand muss Projekt besitzen)
 *
 * Secrets: RESEND_API_KEY, RESEND_FROM_EMAIL, RESEND_FROM_NAME, PUBLIC_APP_URL
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface InviteBody {
  project_id: string
  client_email: string
  client_name?: string
}

interface ResendResp {
  id?: string
  message?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ success: false, error: 'method_not_allowed' }, 405)

  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
  if (!RESEND_API_KEY) return json({ success: false, error: 'resend_api_key_missing' }, 500)

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const PUBLIC_APP_URL = (Deno.env.get('PUBLIC_APP_URL') ?? 'http://localhost:5173').replace(/\/$/, '')

  const auth = req.headers.get('authorization') ?? ''
  if (!auth.startsWith('Bearer ')) {
    return json({ success: false, error: 'unauthorized' }, 401)
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: userResp, error: authErr } = await supabase.auth.getUser(auth.replace('Bearer ', ''))
  if (authErr || !userResp.user) {
    return json({ success: false, error: 'unauthorized' }, 401)
  }
  const ownerId = userResp.user.id

  let payload: InviteBody
  try {
    payload = await req.json()
  } catch {
    return json({ success: false, error: 'invalid_json' }, 400)
  }

  const clientEmail = payload.client_email?.trim().toLowerCase()
  const clientName = payload.client_name?.trim() || clientEmail?.split('@')[0] || 'Kunde'
  if (!payload.project_id || !clientEmail) {
    return json({ success: false, error: 'missing_fields' }, 400)
  }

  const { data: project, error: pErr } = await supabase
    .from('deliver_projects')
    .select('id, name, owner_brand_id, client_welcome_text, client_stage, deleted_at')
    .eq('id', payload.project_id)
    .maybeSingle()

  if (pErr || !project || project.deleted_at) {
    return json({ success: false, error: 'project_not_found' }, 404)
  }

  const { data: brand, error: bErr } = await supabase
    .from('brands')
    .select('id, name, slug, user_id')
    .eq('id', project.owner_brand_id)
    .maybeSingle()

  if (bErr || !brand || brand.user_id !== ownerId) {
    return json({ success: false, error: 'forbidden' }, 403)
  }

  let userId: string
  let existingUser = false

  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email: clientEmail,
    email_confirm: true,
    user_metadata: { full_name: clientName },
  })

  if (createErr) {
    const msg = createErr.message.toLowerCase()
    if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
      const found = await findUserByEmail(supabase, clientEmail)
      if (!found) return json({ success: false, error: 'user_lookup_failed' }, 500)
      userId = found
      existingUser = true
    } else {
      return json({ success: false, error: 'create_user_failed', detail: createErr.message }, 500)
    }
  } else {
    userId = created.user.id
  }

  const portalUrl = `${PUBLIC_APP_URL}/portal/${payload.project_id}`

  const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: clientEmail,
    options: { redirectTo: portalUrl },
  })

  if (linkErr || !linkData?.properties?.action_link) {
    return json(
      { success: false, error: 'magic_link_failed', detail: linkErr?.message ?? 'no link' },
      500,
    )
  }

  const magicLink = linkData.properties.action_link

  const { error: roleErr } = await supabase.from('user_roles').upsert(
    {
      user_id: userId,
      role: 'client',
      project_id: payload.project_id,
      client_slug: brand.slug,
    },
    { onConflict: 'user_id' },
  )

  if (roleErr) {
    return json({ success: false, error: 'role_upsert_failed', detail: roleErr.message }, 500)
  }

  const projectPatch: Record<string, unknown> = {
    client_email: clientEmail,
    client_name: clientName,
    updated_at: new Date().toISOString(),
  }
  if (!project.client_stage) {
    projectPatch.client_stage = 'onboarding'
  }

  const { error: updErr } = await supabase
    .from('deliver_projects')
    .update(projectPatch)
    .eq('id', payload.project_id)

  if (updErr) {
    return json({ success: false, error: 'project_update_failed', detail: updErr.message }, 500)
  }

  await supabase.from('activity_log').insert({
    brand_id: brand.id,
    actor_id: ownerId,
    entity_type: 'project',
    entity_id: payload.project_id,
    action: 'client_invited',
    summary: `Client eingeladen: ${clientEmail}`,
    metadata: { email: clientEmail, existing_user: existingUser },
  })

  const welcomeText =
    typeof project.client_welcome_text === 'string' && project.client_welcome_text.trim()
      ? project.client_welcome_text.trim()
      : ''

  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? 'noreply@example.com'
  const fromName = Deno.env.get('RESEND_FROM_NAME') ?? brand.name ?? 'Brand OS'

  const htmlBody = buildWelcomeHtml({
    projectName: project.name,
    brandName: brand.name,
    clientName,
    magicLink,
    portalUrl,
    welcomeText,
  })

  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: `${fromName} <${fromEmail}>`,
      to: [clientEmail],
      subject: `Dein Zugang zum Projekt „${project.name}"`,
      html: htmlBody,
      text: buildWelcomeText({
        projectName: project.name,
        brandName: brand.name,
        clientName,
        magicLink,
        portalUrl,
        welcomeText,
      }),
    }),
  })

  const resendJson: ResendResp = await resendRes.json().catch(() => ({}))
  if (!resendRes.ok) {
    return json(
      {
        success: false,
        error: 'resend_failed',
        detail: resendJson.message ?? 'unknown',
        user_id: userId,
        portal_url: portalUrl,
        existing_user: existingUser,
      },
      resendRes.status,
    )
  }

  return json({
    success: true,
    user_id: userId,
    portal_url: portalUrl,
    existing_user: existingUser,
    resend_id: resendJson.id,
  })
})

async function findUserByEmail(
  supabase: ReturnType<typeof createClient>,
  email: string,
): Promise<string | null> {
  let page = 1
  const perPage = 200
  while (page <= 10) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
    if (error || !data?.users?.length) return null
    const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
    if (match) return match.id
    if (data.users.length < perPage) break
    page++
  }
  return null
}

function buildWelcomeHtml(opts: {
  projectName: string
  brandName: string
  clientName: string
  magicLink: string
  portalUrl: string
  welcomeText: string
}): string {
  const welcomeBlock = opts.welcomeText
    ? `<p style="font-size:14px;line-height:1.6;color:#444;margin:16px 0;">${escapeHtml(opts.welcomeText)}</p>`
    : ''
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#fafafa;">
<div style="max-width:560px;margin:0 auto;background:#fff;padding:32px;border-radius:12px;font-family:system-ui,sans-serif;">
  <h1 style="font-size:22px;margin:0 0 8px;color:#111;">Willkommen, ${escapeHtml(opts.clientName)}!</h1>
  <p style="font-size:14px;line-height:1.6;color:#444;margin:0 0 16px;">
    ${escapeHtml(opts.brandName)} hat dich zum Projekt <strong>${escapeHtml(opts.projectName)}</strong> eingeladen.
  </p>
  ${welcomeBlock}
  <p style="margin:24px 0;">
    <a href="${opts.magicLink}" style="display:inline-block;background:#111;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">
      Zum Kundenportal
    </a>
  </p>
  <p style="font-size:12px;color:#888;line-height:1.5;">
    Oder öffne diesen Link nach dem Login:<br/>
    <a href="${opts.portalUrl}" style="color:#666;">${opts.portalUrl}</a>
  </p>
</div></body></html>`
}

function buildWelcomeText(opts: {
  projectName: string
  brandName: string
  clientName: string
  magicLink: string
  portalUrl: string
  welcomeText: string
}): string {
  const lines = [
    `Willkommen, ${opts.clientName}!`,
    '',
    `${opts.brandName} hat dich zum Projekt „${opts.projectName}" eingeladen.`,
    '',
  ]
  if (opts.welcomeText) lines.push(opts.welcomeText, '')
  lines.push(`Zum Portal: ${opts.magicLink}`, '', `Portal-URL: ${opts.portalUrl}`)
  return lines.join('\n')
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}
