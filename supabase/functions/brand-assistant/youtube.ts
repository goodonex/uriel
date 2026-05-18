/** YouTube transcript via Innertube player + timedtext captions (no API key). */

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

export function extractYoutubeVideoId(raw: string): string | null {
  const s = raw.trim()
  if (!s) return null
  try {
    const u = new URL(s.startsWith('http') ? s : `https://${s}`)
    if (u.hostname === 'youtu.be' || u.hostname.endsWith('.youtu.be')) {
      const id = u.pathname.replace(/^\//, '').split('/')[0]
      return id && id.length >= 6 ? id : null
    }
    if (u.hostname.includes('youtube.com') || u.hostname.includes('youtube-nocookie.com')) {
      const v = u.searchParams.get('v')
      if (v) return v
      const parts = u.pathname.split('/').filter(Boolean)
      if (parts[0] === 'shorts' && parts[1]) return parts[1]
      if (parts[0] === 'embed' && parts[1]) return parts[1]
      if (parts[0] === 'live' && parts[1]) return parts[1]
    }
  } catch {
    /* ignore */
  }
  const m = s.match(/(?:v=|\/)([\w-]{11})(?:\?|&|$)/)
  return m?.[1] ?? null
}

function decodeXmlEntities(t: string): string {
  return t
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
}

function parseTimedTextXml(xml: string): string {
  const parts: string[] = []
  const re = /<text[^>]*>([\s\S]*?)<\/text>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) {
    const chunk = decodeXmlEntities(m[1].replace(/\n/g, ' ').trim())
    if (chunk) parts.push(chunk)
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

type CaptionTrack = { baseUrl?: string; languageCode?: string }

async function fetchCaptionXml(baseUrl: string): Promise<string> {
  const url = baseUrl.includes('fmt=') ? baseUrl : `${baseUrl}&fmt=json3`
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: '*/*' },
  })
  if (!res.ok) throw new Error(`caption_fetch_${res.status}`)
  const text = await res.text()
  if (text.trim().startsWith('{')) {
    try {
      const j = JSON.parse(text) as { events?: Array<{ segs?: Array<{ utf8?: string }> }> }
      const segs: string[] = []
      for (const ev of j.events ?? []) {
        for (const s of ev.segs ?? []) {
          if (s.utf8) segs.push(s.utf8)
        }
      }
      return segs.join(' ').replace(/\s+/g, ' ').trim()
    } catch {
      return parseTimedTextXml(text)
    }
  }
  return parseTimedTextXml(text)
}

export async function fetchYoutubeTranscript(
  videoUrl: string,
): Promise<{ ok: true; text: string; videoId: string } | { ok: false; reason: 'no_captions' | 'invalid_url' | 'fetch_failed'; detail?: string }> {
  const videoId = extractYoutubeVideoId(videoUrl)
  if (!videoId) return { ok: false, reason: 'invalid_url' }

  try {
    const playerRes = await fetch(
      'https://www.youtube.com/youtubei/v1/player?prettyPrint=false',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': UA,
          Origin: 'https://www.youtube.com',
        },
        body: JSON.stringify({
          context: {
            client: {
              clientName: 'WEB',
              clientVersion: '2.20250324.01.00',
              hl: 'de',
              gl: 'DE',
            },
          },
          videoId,
        }),
      },
    )

    if (!playerRes.ok) {
      return { ok: false, reason: 'fetch_failed', detail: `player_${playerRes.status}` }
    }

    const player = (await playerRes.json()) as {
      captions?: {
        playerCaptionsTracklistRenderer?: { captionTracks?: CaptionTrack[] }
      }
    }

    let tracks = player.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? []

    if (!tracks.length) {
      const watchRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
        headers: { 'User-Agent': UA, 'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8' },
      })
      const html = await watchRes.text()
      const match = html.match(/"captionTracks":(\[[\s\S]*?\])/)
      if (match) {
        try {
          tracks = JSON.parse(match[1]) as CaptionTrack[]
        } catch {
          /* ignore */
        }
      }
    }

    if (!tracks.length) {
      return { ok: false, reason: 'no_captions' }
    }

    const track =
      tracks.find((t) => t.languageCode?.startsWith('de')) ??
      tracks.find((t) => t.languageCode?.startsWith('en')) ??
      tracks[0]

    if (!track?.baseUrl) return { ok: false, reason: 'no_captions' }

    const text = await fetchCaptionXml(track.baseUrl)
    if (!text || text.length < 20) {
      return { ok: false, reason: 'no_captions' }
    }

    return { ok: true, text: text.slice(0, 50_000), videoId }
  } catch (e) {
    return {
      ok: false,
      reason: 'fetch_failed',
      detail: e instanceof Error ? e.message : 'unknown',
    }
  }
}
