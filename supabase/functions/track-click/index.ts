// track-click — zählt einen Ad-Klick und leitet weiter.
// URL: /functions/v1/track-click?c=<campaign_id>&u=<encoded_destination_url>&k=<utm_content>
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32)
}

function appendUtm(
  target: string,
  c: { utm_source: string; utm_medium: string; utm_campaign: string; utm_content: string },
  override_content?: string,
): string {
  try {
    const u = new URL(target)
    if (c.utm_source) u.searchParams.set('utm_source', c.utm_source)
    if (c.utm_medium) u.searchParams.set('utm_medium', c.utm_medium)
    if (c.utm_campaign) u.searchParams.set('utm_campaign', c.utm_campaign)
    const content = override_content || c.utm_content
    if (content) u.searchParams.set('utm_content', content)
    return u.toString()
  } catch {
    return target
  }
}

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const campaignId = url.searchParams.get('c')
  const dest = url.searchParams.get('u')
  const utmContent = url.searchParams.get('k') ?? ''

  if (!campaignId) return new Response('missing_campaign', { status: 400 })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  const { data: campaign } = await supabase
    .from('ad_campaigns')
    .select('id, brand_id, target_url, utm_source, utm_medium, utm_campaign, utm_content, clicks_count')
    .eq('id', campaignId)
    .maybeSingle()

  if (!campaign) return new Response('unknown_campaign', { status: 404 })

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('cf-connecting-ip') || ''
  const ua = req.headers.get('user-agent') ?? ''
  const referrer = req.headers.get('referer') ?? ''
  const ipHash = ip ? await sha256Hex(`${ip}:${Deno.env.get('SUPABASE_URL') ?? 'salt'}`) : ''

  await supabase.from('ad_clicks').insert({
    campaign_id: campaign.id,
    brand_id: campaign.brand_id,
    referrer: referrer.slice(0, 512),
    user_agent: ua.slice(0, 512),
    ip_hash: ipHash,
    utm_content: utmContent.slice(0, 64),
  })

  await supabase
    .from('ad_campaigns')
    .update({ clicks_count: (campaign.clicks_count ?? 0) + 1 })
    .eq('id', campaign.id)

  const target = (dest && dest.length > 0) ? dest : (campaign.target_url || '/')
  const finalUrl = appendUtm(target, campaign, utmContent)

  return new Response(null, {
    status: 302,
    headers: {
      Location: finalUrl,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  })
})
