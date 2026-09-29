/**
 * Wache für das Abschreiben von Sprachnachrichten (29.09.2026, Fall Hartmut).
 * Geprüft wird ohne Netz: Groq, Audio und Supabase sind nachgestellt.
 *
 * Start: npx tsx scripts/verify-sprachnachrichten.ts
 */
import { offeneSprachnachrichten, sprachnachrichtenAbschreiben, GROQ_URL } from '../runner/linkedin/sprachnachrichten.mjs'

let pass = 0
let fail = 0
function check(label: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) pass++
  else {
    fail++
    console.error(`FEHLGESCHLAGEN: ${label} — erwartet ${JSON.stringify(expected)}, bekommen ${JSON.stringify(actual)}`)
  }
}

// 1. Nur Lead-Nachrichten mit Link warten aufs Abschreiben.
check(
  '1 offene erkannt',
  offeneSprachnachrichten([
    { sender: 'me', text: 'Läuft die Software?', ts: 'a' },
    { sender: 'them', text: '[Sprachnachricht]', ts: 'b', medien_url: 'https://audio/1' },
    { sender: 'them', text: '[Sprachnachricht]', ts: 'c' },
    { sender: 'them', text: '[Sprachnachricht] schon fertig', ts: 'd', medien_url: 'https://audio/2' },
  ]),
  [{ index: 1, url: 'https://audio/1' }],
)

// 2. Ohne Schlüssel passiert nichts.
{
  const r = await sprachnachrichtenAbschreiben({ supabaseUrl: 'https://supa', headers: {}, brandId: 'b', groqKey: '' })
  check('2 ohne Schlüssel', r, { abgeschrieben: 0, grund: 'kein GROQ_API_KEY' })
}

// 3. Durchlauf: Thread holen, Audio laden, Groq fragen, Verlauf + Vorschau zurückschreiben.
{
  const gesendet: Array<{ url: string; body?: string; method?: string }> = []
  const fetchImpl = async (url: string, init: RequestInit = {}) => {
    gesendet.push({ url, method: init.method, body: typeof init.body === 'string' ? init.body : undefined })
    if (url.includes('/rest/v1/linkedin_threads?brand_id')) {
      return new Response(JSON.stringify([{ id: 't1', name: 'Hartmut Schneider', preview: '[Sprachnachricht]', verlauf: [
        { sender: 'me', text: 'Läuft die neue Maklersoftware inzwischen rund?', ts: 'a' },
        { sender: 'them', text: '[Sprachnachricht]', ts: 'b', medien_url: 'https://dms.licdn.com/audio/1' },
      ] }]), { status: 200 })
    }
    if (url === 'https://dms.licdn.com/audio/1') return new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'content-type': 'audio/mp4' } })
    if (url === GROQ_URL) return new Response('Ja, läuft inzwischen, war am Anfang etwas holprig.', { status: 200 })
    return new Response('[]', { status: 200 })
  }
  const r = await sprachnachrichtenAbschreiben({ supabaseUrl: 'https://supa', headers: {}, brandId: 'b', groqKey: 'gsk_test', fetchImpl: fetchImpl as typeof fetch })
  check('3a eine abgeschrieben', r.abgeschrieben, 1)
  const patch = gesendet.find((g) => g.method === 'PATCH')
  const body = patch?.body ? JSON.parse(patch.body) : {}
  check('3b Verlauf trägt den Text', body.verlauf?.[1]?.text, '[Sprachnachricht] Ja, läuft inzwischen, war am Anfang etwas holprig.')
  check('3c Vorschau trägt den Text', body.preview, '[Sprachnachricht] Ja, läuft inzwischen, war am Anfang etwas holprig.')
  check('3d Link bleibt am Eintrag', body.verlauf?.[1]?.medien_url, 'https://dms.licdn.com/audio/1')
}

// 4. Audio nicht ladbar → Fehler gemeldet, nichts geschrieben, nächster Abgleich versucht es wieder.
{
  const gesendet: string[] = []
  const fetchImpl = async (url: string, init: RequestInit = {}) => {
    gesendet.push(init.method ?? 'GET')
    if (url.includes('/rest/v1/linkedin_threads?brand_id')) {
      return new Response(JSON.stringify([{ id: 't1', name: 'X', preview: '[Sprachnachricht]', verlauf: [{ sender: 'them', text: '[Sprachnachricht]', ts: 'b', medien_url: 'https://abgelaufen' }] }]), { status: 200 })
    }
    return new Response('', { status: 403 })
  }
  const r = await sprachnachrichtenAbschreiben({ supabaseUrl: 'https://supa', headers: {}, brandId: 'b', groqKey: 'gsk_test', fetchImpl: fetchImpl as typeof fetch })
  check('4a nichts abgeschrieben', r.abgeschrieben, 0)
  check('4b Fehler gemeldet', r.fehler?.length, 1)
  check('4c kein Schreibversuch', gesendet.includes('PATCH'), false)
}

console.log(`verify-sprachnachrichten: ${pass} ok, ${fail} fehlgeschlagen`)
if (fail > 0) process.exit(1)
