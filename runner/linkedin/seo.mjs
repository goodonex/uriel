/**
 * runner/linkedin/seo.mjs — wird die Seite ohne Werbung bei Google gefunden? (25.09.2026)
 *
 * **Der Anlass.** Kevin zu starken Seiten: *„deine Webseite ist super gut, aber
 * du schaltest halt einfach nur keine Werbung. Was bringt dir das Tool, wenn
 * kein Traffic drauf kommt? Wir können ja sogar SEO abchecken."* Die Aussage
 * „kaum Traffic" braucht deshalb einen Beleg: die organische Sichtbarkeit.
 *
 * **Der Weg.** DataForSEO Labs `domain_rank_overview` (~0,012 $ je Abfrage),
 * gleicher Zugang wie `googleAds.mjs`. Am 25.09. gemessen: amoreal.de → 27
 * Keywords in den Top 10, ~540 Besuche/Monat; meissler-co.de → 5 / ~285.
 *
 * Nie werfen. Ein kaputter Abruf ist `unbekannt`, nie `gering` — eine falsche
 * „man findet euch nicht"-Aussage wäre schlimmer als gar keine.
 */
import { dataforseoZugang, domainAus, landFuerDomain } from './googleAds.mjs'

const ENDPUNKT = 'https://api.dataforseo.com/v3/dataforseo_labs/google/domain_rank_overview/live'
const TIMEOUT_MS = Number(process.env.SEO_TIMEOUT_MS ?? 45_000)

/**
 * Antwort → Stufe. Reine Funktion (Drift-Wache ohne Netz).
 * `gering`: kaum Top-10-Keywords und kaum Besuche; `stark`: breit sichtbar.
 *
 * @returns {{ seo_sichtbarkeit: 'gering'|'mittel'|'stark'|'unbekannt', seo_top10: number|null, seo_besuche: number|null }}
 */
export function seoAuswerten(antwort) {
  const unbekannt = { seo_sichtbarkeit: 'unbekannt', seo_top10: null, seo_besuche: null }
  const task = antwort?.tasks?.[0]
  if (!task || task.status_code !== 20000) return unbekannt
  const organic = task.result?.[0]?.items?.[0]?.metrics?.organic
  // Kein Eintrag = die Domain rankt für nichts, was DataForSEO kennt.
  if (!organic) return { seo_sichtbarkeit: 'gering', seo_top10: 0, seo_besuche: 0 }
  const top10 = (organic.pos_1 ?? 0) + (organic.pos_2_3 ?? 0) + (organic.pos_4_10 ?? 0)
  const besuche = Math.round(Number(organic.etv) || 0)
  const stufe = top10 >= 40 || besuche >= 1000 ? 'stark' : top10 < 10 && besuche < 150 ? 'gering' : 'mittel'
  return { seo_sichtbarkeit: stufe, seo_top10: top10, seo_besuche: besuche }
}

/** Nie werfen. */
export async function pruefeSeo(website, { zugang = dataforseoZugang(), fetchFn = fetch } = {}) {
  const domain = domainAus(website)
  if (!domain || !zugang) return seoAuswerten(null)
  const steuerung = new AbortController()
  const uhr = setTimeout(() => steuerung.abort(), TIMEOUT_MS)
  try {
    const res = await fetchFn(ENDPUNKT, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${zugang.login}:${zugang.passwort}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([{ target: domain, location_code: landFuerDomain(domain), language_code: 'de' }]),
      signal: steuerung.signal,
    })
    return res.ok ? seoAuswerten(await res.json()) : seoAuswerten(null)
  } catch {
    return seoAuswerten(null)
  } finally {
    clearTimeout(uhr)
  }
}
