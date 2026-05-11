/**
 * track-open — Liefert ein transparentes 1x1-GIF und markiert die Mail als geöffnet.
 * URL: /functions/v1/track-open?id={tracking_id}
 * Public — kein Auth.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const GIF_BASE64 = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const id = url.searchParams.get('id')

  if (id) {
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        { auth: { persistSession: false, autoRefreshToken: false } },
      )

      // Nur setzen, wenn noch nicht geöffnet (idempotent)
      await supabase
        .from('sales_email_logs')
        .update({ opened_at: new Date().toISOString() })
        .eq('tracking_id', id)
        .is('opened_at', null)
    } catch {
      // Bewusst still — Pixel muss immer 200 + gif liefern
    }
  }

  const bin = Uint8Array.from(atob(GIF_BASE64), (c) => c.charCodeAt(0))
  return new Response(bin, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
      'Access-Control-Allow-Origin': '*',
    },
  })
})
