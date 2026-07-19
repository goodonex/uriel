/**
 * Uriel-Voice — ElevenLabs Text-to-Speech Proxy. Der Client schickt Text, wir
 * holen die Audio-Stimme von ElevenLabs (API-Key bleibt serverseitig) und
 * reichen die MP3 durch. Ersetzt die Browser-Roboterstimme.
 * Secrets: ELEVENLABS_API_KEY, optional ELEVENLABS_VOICE_ID, ELEVENLABS_MODEL.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Default: „Adam" — tiefe, ruhige, mehrsprachige Stimme (Jarvis-tauglich, Deutsch ok).
const DEFAULT_VOICE = 'pNInz6obpgDQGcFmaJgB'
// Flash = niedrigste Latenz (multilingual, ~sub-Sekunde). Der Client kann pro
// Anfrage auf „eleven_multilingual_v2" (ausdrucksstärker, langsamer) umschalten.
const DEFAULT_MODEL = 'eleven_flash_v2_5'

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const apiKey = Deno.env.get('ELEVENLABS_API_KEY')?.trim()
  if (!apiKey) {
    return json(503, { ok: false, message: 'ELEVENLABS_API_KEY fehlt — Uriel-Stimme nicht konfiguriert.' })
  }
  const voiceId = Deno.env.get('ELEVENLABS_VOICE_ID')?.trim() || DEFAULT_VOICE
  const model = Deno.env.get('ELEVENLABS_MODEL')?.trim() || DEFAULT_MODEL

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return json(401, { ok: false, message: 'Unauthorized' })

  const userClient = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error: userErr } = await userClient.auth.getUser()
  if (userErr || !user) return json(401, { ok: false, message: 'Invalid session' })

  // GET → die im ElevenLabs-Konto verfügbaren Stimmen auflisten. Free-Tier kann
  // nur eigene Konto-Stimmen per API nutzen; das hier liefert genau die.
  // Braucht „Voices → Read" auf dem Key.
  if (req.method === 'GET') {
    const vr = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': apiKey },
    })
    if (!vr.ok) {
      const t = await vr.text()
      return json(vr.status === 401 ? 403 : 502, {
        ok: false,
        needsVoicesRead: vr.status === 401,
        message:
          vr.status === 401
            ? 'Kein Zugriff auf die Stimmen-Liste — aktiviere „Voices → Read" auf deinem ElevenLabs-Key.'
            : `ElevenLabs ${vr.status}: ${t.slice(0, 200)}`,
      })
    }
    const data = (await vr.json()) as {
      voices?: { voice_id: string; name: string; category?: string }[]
    }
    const voices = (data.voices ?? []).map((v) => ({
      id: v.voice_id,
      name: v.name,
      category: v.category ?? '',
    }))
    return json(200, { ok: true, voices })
  }

  interface VoiceSettings {
    stability?: number
    similarity_boost?: number
    style?: number
    speed?: number
    use_speaker_boost?: boolean
  }
  let body: { text?: string; voiceId?: string; modelId?: string; voiceSettings?: VoiceSettings }
  try {
    body = await req.json()
  } catch {
    return json(400, { ok: false, message: 'Invalid JSON body' })
  }
  const text = body.text?.trim()
  if (!text) return json(400, { ok: false, message: 'text required' })

  const voice = body.voiceId?.trim() || voiceId
  const chosenModel = body.modelId?.trim() || model
  const vs = body.voiceSettings ?? {}
  const voiceSettings = {
    stability: typeof vs.stability === 'number' ? vs.stability : 0.4,
    similarity_boost: typeof vs.similarity_boost === 'number' ? vs.similarity_boost : 0.8,
    style: typeof vs.style === 'number' ? vs.style : 0.2,
    speed: typeof vs.speed === 'number' ? vs.speed : 1.0,
    use_speaker_boost: vs.use_speaker_boost ?? true,
  }
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text: text.slice(0, 2500),
        model_id: chosenModel,
        voice_settings: voiceSettings,
      }),
    },
  )

  if (!res.ok) {
    const t = await res.text()
    return json(502, { ok: false, message: `ElevenLabs ${res.status}: ${t.slice(0, 300)}` })
  }

  return new Response(res.body, {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' },
  })
})
