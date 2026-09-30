/**
 * runner/linkedin/sprachnachrichten.mjs — Sprachnachrichten von Leads abschreiben (29.09.2026).
 *
 * **Der Anlass.** Hartmut antwortete auf Kevins Frage mit einer Sprachnachricht.
 * Der Abgleich las nur Text: Die Karte im Cockpit war leer, und der
 * Antwort-Agent meldete, der Lead habe noch gar nicht geantwortet. Seit heute
 * steht im Verlauf der Platzhalter `[Sprachnachricht]` samt Link zur
 * Audiodatei (`verlaufAusMessages`). Diese Datei holt die Datei, lässt sie von
 * Groq abschreiben (Whisper) und schreibt den Text in den Verlauf:
 * `[Sprachnachricht] <Text>`. Danach sehen Cockpit und Agent, was er gesagt hat.
 *
 * **Ohne `GROQ_API_KEY` passiert nichts** — der Platzhalter bleibt stehen, und
 * Kevin hört selbst rein. Kosten: Groq rechnet nach Audiominuten ab, bei ein
 * paar Sprachnachrichten im Monat sind das Cent-Beträge.
 *
 * Fehler hier dürfen den Abgleich nie umwerfen: Der Aufrufer fängt alles ab,
 * und eine Nachricht, die heute nicht klappt, wird beim nächsten Abgleich
 * wieder versucht (der Platzhalter bleibt ja stehen).
 */
import { SPRACH_PLATZHALTER } from './verlauf.mjs'

export const GROQ_URL = 'https://api.groq.com/openai/v1/audio/transcriptions'
export const GROQ_MODELL = 'whisper-large-v3-turbo'
/** Höchstens so viele je Abgleich — ein Ausreißer soll keinen Lauf aufhalten. */
export const ABSCHREIBEN_MAX = 10

/** Welche Einträge warten aufs Abschreiben? Nur Lead-Nachrichten mit Link. */
export function offeneSprachnachrichten(verlauf) {
  if (!Array.isArray(verlauf)) return []
  const out = []
  verlauf.forEach((e, index) => {
    if (e && e.sender === 'them' && e.text === SPRACH_PLATZHALTER && typeof e.medien_url === 'string' && e.medien_url) {
      out.push({ index, url: e.medien_url })
    }
  })
  return out
}

/**
 * Die Audiodatei holen. Erst direkt; antwortet LinkedIn ohne Sitzung (401/403,
 * der Normalfall bei /dms/prv/), im angemeldeten Sync-Chrome (`holeImBrowser`).
 */
async function holeAudio(url, { fetchImpl, imBrowser }) {
  const direkt = await fetchImpl(url).catch(() => null)
  if (direkt?.ok) return { daten: await direkt.arrayBuffer(), typ: direkt.headers.get('content-type') || '' }
  if (direkt && direkt.status !== 401 && direkt.status !== 403) throw new Error(`Audio HTTP ${direkt.status}`)
  const hole = imBrowser ?? (await import('./sync.mjs')).holeImBrowser
  return hole(url)
}

/** Eine Audiodatei holen und von Groq abschreiben lassen. Wirft bei jedem Fehler. */
export async function schreibeAb(url, groqKey, { fetchImpl = fetch, imBrowser } = {}) {
  const audio = await holeAudio(url, { fetchImpl, imBrowser })
  // LinkedIn liefert application/octet-stream — Groq braucht einen Audiotyp.
  const typ = /^audio\//.test(audio.typ) ? audio.typ : 'audio/mp4'
  const daten = audio.daten
  const endung = /mpeg|mp3/.test(typ) ? 'mp3' : /ogg|opus/.test(typ) ? 'ogg' : /wav/.test(typ) ? 'wav' : 'm4a'
  const form = new FormData()
  form.append('file', new Blob([daten], { type: typ }), `sprachnachricht.${endung}`)
  form.append('model', GROQ_MODELL)
  form.append('language', 'de')
  form.append('response_format', 'text')
  const res = await fetchImpl(GROQ_URL, { method: 'POST', headers: { Authorization: `Bearer ${groqKey}` }, body: form })
  if (!res.ok) throw new Error(`Groq HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 160)}`)
  const text = (await res.text()).trim()
  if (!text) throw new Error('Groq lieferte leeren Text')
  return text
}

/**
 * Alle offenen Sprachnachrichten der Marke abschreiben und zurückschreiben.
 * Gibt eine Zusammenfassung zurück, nie einen Wurf.
 */
export async function sprachnachrichtenAbschreiben({ supabaseUrl, headers, brandId, groqKey, fetchImpl = fetch, imBrowser }) {
  if (!groqKey) return { abgeschrieben: 0, grund: 'kein GROQ_API_KEY' }
  const filter = encodeURIComponent(JSON.stringify([{ text: SPRACH_PLATZHALTER }]))
  const res = await fetchImpl(
    `${supabaseUrl}/rest/v1/linkedin_threads?brand_id=eq.${brandId}&verlauf=cs.${filter}&select=id,name,verlauf,preview`,
    { headers },
  )
  if (!res.ok) return { abgeschrieben: 0, grund: `Abfrage HTTP ${res.status}` }
  const zeilen = await res.json()

  let abgeschrieben = 0
  const fehler = []
  for (const z of zeilen) {
    if (abgeschrieben >= ABSCHREIBEN_MAX) break
    const offen = offeneSprachnachrichten(z.verlauf)
    if (!offen.length) continue
    const verlauf = z.verlauf.map((e) => ({ ...e }))
    let geaendert = false
    for (const { index, url } of offen) {
      try {
        const text = await schreibeAb(url, groqKey, { fetchImpl, imBrowser })
        verlauf[index].text = `${SPRACH_PLATZHALTER} ${text}`
        geaendert = true
        abgeschrieben++
      } catch (e) {
        fehler.push(`${z.name}: ${e?.message ?? e}`)
      }
    }
    if (!geaendert) continue
    const letzte = verlauf[verlauf.length - 1]
    const patch = { verlauf }
    if (z.preview === SPRACH_PLATZHALTER && letzte?.text?.startsWith(SPRACH_PLATZHALTER + ' ')) patch.preview = letzte.text
    await fetchImpl(`${supabaseUrl}/rest/v1/linkedin_threads?id=eq.${z.id}`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }).catch((e) => fehler.push(`${z.name}: Schreiben ${e?.message ?? e}`))
  }
  return { abgeschrieben, fehler }
}
