/**
 * runner/linkedin/googleTreffer.mjs — die ersten Google-Treffer zum Firmennamen (07.10.2026)
 *
 * **Der Anlass.** Die Prüf-Liste schickte Kevin immer wieder los: *„Firma googeln,
 * die ersten fünf Treffer ansehen."* Er tat es und fand die Seite fast jedes Mal
 * als ersten Treffer (Röper, Kern, Siedenburg, Roß, Zollinger). Kevin, 07.10.2026:
 * *„Diese ganze Prüferei hat mich richtig genervt, genau dafür habe ich dich.
 * Das muss funktionieren."* Googeln ist Arbeit des Runners, nicht Kevins.
 *
 * **Der Weg.** Die echte Google-Suche über DataForSEO (`serp/google/organic/live/regular`,
 * ~0,0006 $ je Abfrage), gleiche Zugangsdaten wie `googleAds.mjs`. Das Ergebnis
 * geht als Liste in den Finden-Prompt, damit das Modell nicht aus dem Gedächtnis
 * oder einer eigenen WebSearch rät, sondern in echten Treffern wählt.
 *
 * Nie werfen: Fehlen Zugangsdaten oder schlägt der Abruf fehl, kommt `[]` und
 * `grund` — der Finder sucht dann wie bisher selbst.
 */
import { dataforseoZugang, domainAus } from './googleAds.mjs'

const ENDPUNKT = 'https://api.dataforseo.com/v3/serp/google/organic/live/regular'
/**
 * 60 statt 30 Sekunden (07.10.2026): DataForSEO antwortet meist in 5–15 s, in Spitzen
 * über 30. Dann brach die deutsche Suche ab, der Runner suchte in der Schweiz weiter
 * und fand für Röper, Christoffers, Schmiegel nur Fremdes — „Google-Treffer fehlen".
 */
const TIMEOUT_MS = Number(process.env.GOOGLE_TREFFER_TIMEOUT_MS ?? 60_000)

export const LAND_DE = 2276
export const LAND_CH = 2756
export const LAND_AT = 2040

/** Reine Funktion (ohne Netz prüfbar): DataForSEO-Antwort → höchstens `anzahl` organische Treffer. */
export function trefferAuswerten(antwort, anzahl = 5) {
  const items = antwort?.tasks?.[0]?.result?.[0]?.items
  if (!Array.isArray(items)) return []
  return items
    .filter((x) => x && x.type === 'organic' && x.url)
    .slice(0, anzahl)
    .map((x, i) => ({ platz: i + 1, titel: String(x.title ?? '').slice(0, 120), url: String(x.url), domain: domainAus(x.url), auszug: String(x.description ?? '').slice(0, 160) }))
}

/**
 * @param {string} suche z. B. „Helmut Röper Immobilien"
 * @param {{ land?: number, anzahl?: number, zugang?: ReturnType<typeof dataforseoZugang>, fetchFn?: typeof fetch }} [opt]
 * @returns {Promise<{ treffer: ReturnType<typeof trefferAuswerten>, grund: string }>}
 */
export async function googleTreffer(suche, { land = LAND_DE, anzahl = 5, zugang = dataforseoZugang(), fetchFn = fetch } = {}) {
  const frage = String(suche ?? '').trim()
  if (!frage) return { treffer: [], grund: 'keine Suche' }
  if (!zugang) return { treffer: [], grund: 'DATAFORSEO fehlt' }
  const steuerung = new AbortController()
  const uhr = setTimeout(() => steuerung.abort(), TIMEOUT_MS)
  try {
    const res = await fetchFn(ENDPUNKT, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${zugang.login}:${zugang.passwort}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([{ keyword: frage, location_code: land, language_code: 'de', depth: 10 }]),
      signal: steuerung.signal,
    })
    if (!res.ok) return { treffer: [], grund: `HTTP ${res.status}` }
    return { treffer: trefferAuswerten(await res.json(), anzahl), grund: '' }
  } catch (e) {
    return { treffer: [], grund: String(e?.message ?? e).slice(0, 80) }
  } finally {
    clearTimeout(uhr)
  }
}

/**
 * Deutschland zuerst, dann Schweiz und Österreich, bis ein Lauf Treffer liefert.
 * Ein Abbruch oder Fehler ist kein „nichts gefunden": dasselbe Land dann einmal neu,
 * statt ins nächste Land zu springen.
 */
export async function googleTrefferDach(suche, opt = {}) {
  let letzter = { treffer: [], grund: '' }
  for (const land of [LAND_DE, LAND_CH, LAND_AT]) {
    letzter = await googleTreffer(suche, { ...opt, land })
    if (!letzter.treffer.length && letzter.grund) letzter = await googleTreffer(suche, { ...opt, land })
    if (letzter.treffer.length) return { ...letzter, land }
  }
  return letzter
}
