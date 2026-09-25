/**
 * runner/linkedin/googleAds.mjs — schaltet die Firma Google-Anzeigen? (22.09.2026)
 *
 * **Der Anlass.** Amoreal schaltet seit Mai Google-Anzeigen. Die Meta-
 * Werbebibliothek zeigt das nicht (und umgekehrt), und bis heute wurde nur
 * Meta geprüft — und auch das nur bei starken Seiten. Eine Nachricht „ihr
 * schaltet keine Anzeigen" wäre bei Amoreal falsch gewesen. Kevin: Google
 * VOR dem Schreiben prüfen, für JEDEN Lead mit Website.
 *
 * **Der Weg.** Das Google-Anzeigen-Transparenzcenter über DataForSEO
 * (`serp/google/ads_search/live/advanced`, ~0,002 $ je Abfrage) mit der
 * Domain als Ziel. Am 22.09. gemessen: amoreal.de → 1 Treffer „Amoreal GmbH",
 * first_shown 2026-05-07, last_shown 2026-09-21; meissler-co.de → Status
 * 40102 „No Search Results".
 *
 * **Zugangsdaten.** `DATAFORSEO_LOGIN`/`DATAFORSEO_PASSWORD` aus `runner/.env`
 * (Projektstandard für Runner-Secrets). Fehlen sie dort, liest der Runner
 * `~/.seo-skill/.env` — dieselbe Datei, die der seo-research-Skill benutzt.
 * Fehlen sie ganz, ist das Ergebnis `unbekannt`, nie `nein`: Ein falsches
 * „ihr schaltet nicht" ist genau der Fehler, den diese Datei verhindern soll.
 */
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const ENDPUNKT = 'https://api.dataforseo.com/v3/serp/google/ads_search/live/advanced'
const TIMEOUT_MS = Number(process.env.GOOGLE_ADS_TIMEOUT_MS ?? 45_000)
/** Zuletzt gesehen innerhalb dieser Tage → „läuft gerade". Älter → lief früher, jetzt nicht. */
export const AKTIV_FENSTER_TAGE = 45

/** Zugangsdaten: Prozess-Env (aus runner/.env) zuerst, sonst die Datei des SEO-Skills. */
export function dataforseoZugang(env = process.env, skillDatei = join(homedir(), '.seo-skill', '.env')) {
  let login = String(env.DATAFORSEO_LOGIN ?? '').trim()
  let passwort = String(env.DATAFORSEO_PASSWORD ?? '').trim()
  if (!login || !passwort) {
    try {
      for (const zeile of readFileSync(skillDatei, 'utf8').split('\n')) {
        const m = zeile.match(/^\s*(?:export\s+)?(DATAFORSEO_LOGIN|DATAFORSEO_PASSWORD)\s*=\s*(.*)\s*$/)
        if (!m) continue
        const wert = m[2].replace(/^["']|["']$/g, '').trim()
        if (m[1] === 'DATAFORSEO_LOGIN' && !login) login = wert
        if (m[1] === 'DATAFORSEO_PASSWORD' && !passwort) passwort = wert
      }
    } catch {
      /* keine Datei → unten leer */
    }
  }
  return login && passwort ? { login, passwort } : null
}

/** `https://www.amoreal.de/kontakt` → `amoreal.de`. Leer, wenn keine Domain erkennbar. */
export function domainAus(website) {
  const roh = String(website ?? '').trim().split(/\s+/)[0]
  if (!roh) return ''
  try {
    const host = new URL(/^https?:\/\//i.test(roh) ? roh : `https://${roh}`).hostname.toLowerCase()
    return host.replace(/^www\d?\./, '')
  } catch {
    return ''
  }
}

/**
 * Land der Abfrage aus der Domain (25.09.2026): Schweizer und österreichische
 * Makler schalten in ihrem Land — eine Abfrage für Deutschland sähe ihre
 * Anzeigen nicht und meldete fälschlich „nein".
 */
export function landFuerDomain(domain) {
  const d = String(domain ?? '').toLowerCase()
  if (d.endsWith('.ch') || d.endsWith('.li')) return 2756
  if (d.endsWith('.at')) return 2040
  return 2276
}

const tagVon = (zeit) => (typeof zeit === 'string' && /^\d{4}-\d{2}-\d{2}/.test(zeit) ? zeit.slice(0, 10) : '')

/**
 * Die DataForSEO-Antwort in die drei Felder übersetzen. Reine Funktion, damit
 * die Drift-Wache sie ohne Netz prüfen kann.
 *
 * @returns {{ google_ads_aktiv: 'ja'|'nein'|'unbekannt', google_ads_seit: string, google_ads_zuletzt: string, google_ads_anzahl: number|null, google_ads_werbender: string }}
 */
export function googleAdsAuswerten(antwort, jetzt = new Date()) {
  const unbekannt = { google_ads_aktiv: 'unbekannt', google_ads_seit: '', google_ads_zuletzt: '', google_ads_anzahl: null, google_ads_werbender: '' }
  const task = antwort?.tasks?.[0]
  if (!task) return unbekannt
  // 40102 = „No Search Results": das Transparenzcenter kennt keine Anzeige dieser Domain.
  if (task.status_code === 40102) return { ...unbekannt, google_ads_aktiv: 'nein', google_ads_anzahl: 0 }
  if (task.status_code !== 20000) return unbekannt
  const ergebnis = task.result?.[0]
  const items = (Array.isArray(ergebnis?.items) ? ergebnis.items : []).filter((x) => x && x.type === 'ads_search')
  if (!items.length) return { ...unbekannt, google_ads_aktiv: 'nein', google_ads_anzahl: 0 }
  const erste = items.map((x) => tagVon(x.first_shown)).filter(Boolean).sort()
  const letzte = items.map((x) => tagVon(x.last_shown)).filter(Boolean).sort()
  const zuletzt = letzte[letzte.length - 1] ?? ''
  const alterTage = zuletzt ? (jetzt.getTime() - new Date(`${zuletzt}T00:00:00Z`).getTime()) / 86_400_000 : Infinity
  return {
    google_ads_aktiv: alterTage <= AKTIV_FENSTER_TAGE ? 'ja' : 'nein',
    google_ads_seit: erste[0] ?? '',
    google_ads_zuletzt: zuletzt,
    google_ads_anzahl: Number.isFinite(Number(ergebnis?.se_results_count)) && Number(ergebnis.se_results_count) > 0 ? Number(ergebnis.se_results_count) : items.length,
    google_ads_werbender: String(items[0]?.title ?? '').slice(0, 120),
  }
}

/** Nie werfen — ein kaputter Abruf ist `unbekannt`. */
export async function pruefeGoogleAds(website, { zugang = dataforseoZugang(), fetchFn = fetch } = {}) {
  const domain = domainAus(website)
  if (!domain || !zugang) return { ...googleAdsAuswerten(null), google_ads_grund: !domain ? 'keine Domain' : 'DATAFORSEO fehlt' }
  const steuerung = new AbortController()
  const uhr = setTimeout(() => steuerung.abort(), TIMEOUT_MS)
  try {
    const res = await fetchFn(ENDPUNKT, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${zugang.login}:${zugang.passwort}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([{ target: domain, location_code: landFuerDomain(domain), platform: 'all', depth: 40 }]),
      signal: steuerung.signal,
    })
    if (!res.ok) return { ...googleAdsAuswerten(null), google_ads_grund: `HTTP ${res.status}` }
    return { ...googleAdsAuswerten(await res.json()), google_ads_grund: '' }
  } catch (e) {
    return { ...googleAdsAuswerten(null), google_ads_grund: String(e?.message ?? e).slice(0, 80) }
  } finally {
    clearTimeout(uhr)
  }
}
