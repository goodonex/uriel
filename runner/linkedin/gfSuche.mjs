/**
 * runner/linkedin/gfSuche.mjs — den Geschäftsführer auf LinkedIn finden (02.10.2026).
 *
 * Kevin: „Kannst du nicht raussuchen, ob der Geschäftsführer auf LinkedIn ist?
 * Und wenn du es nicht findest, dann kommen die als eigenes Ding in die
 * Prüfenliste." Gefunden → „Heute anfragen" mit direktem Profil-Link (erster
 * Kontakt). Nicht gefunden → „Geschäftsführer suchen": Kevin schaut selbst.
 *
 * **Der Weg.** Google-Suche über DataForSEO (`serp/google/organic/live/advanced`,
 * wie `googleAds.mjs`) mit `Name Firma site:linkedin.com/in`. Ein Treffer zählt
 * nur, wenn Vor- UND Nachname im Titel oder Snippet stehen UND die Firma oder
 * ein Rollenwort (Geschäftsführer, Inhaber, Immobilien …) dazu passt.
 * **Im Zweifel `nicht_gefunden`:** Ein falsches Profil in „Heute anfragen" wäre
 * schlimmer als ein Suchlink — Kevin würde die falsche Person vernetzen.
 */
import { dataforseoZugang } from './googleAds.mjs'
import { namensSchluessel } from './entscheider.mjs'
import { protokolliere } from './protokoll.mjs'

const ENDPUNKT = 'https://api.dataforseo.com/v3/serp/google/organic/live/advanced'
const TIMEOUT_MS = Number(process.env.GF_SUCHE_TIMEOUT_MS ?? 45_000)
/** Wie viele Kandidaten pro Lauf gesucht werden (Kosten-Deckel, ~0,002 $ je Suche). */
const MAX_JE_LAUF = Number(process.env.GF_SUCHE_MAX ?? 60)
/** Nach so vielen Tagen ohne Annahme darf der Angestellte doch angeschrieben werden. */
export const GF_WARTEZEIT_TAGE = 14

const ohneAkzent = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const FIRMEN_FUELLWORT = /\b(gmbh|mbh|ag|ug|kg|ohg|gbr|co|se|e\.?k|und|&|immobilien|immobilie|real|estate|gruppe|group|holding|verwaltung|bau|projekt|development|invest|management|makler|partner)\b/g

/** Das unterscheidende Firmenwort: `K-TEAM Immobilien Management GmbH` → `k-team`. Leer, wenn keins übrig bleibt. */
export function firmenKern(firma) {
  const teile = ohneAkzent(firma).replace(FIRMEN_FUELLWORT, ' ').replace(/[^a-z0-9äöüß\s-]/g, ' ').split(/\s+/).filter((w) => w.length >= 3)
  return teile[0] ?? ''
}

/**
 * Welches Profil aus der Trefferliste ist die gesuchte Person? Reine Funktion.
 * @param {{url?: string, title?: string, description?: string}[]} items
 * @returns {{ url: string } | null}
 */
export function profilAusTreffern(items, { name, firma }) {
  const teile = namensSchluessel(name).split(/\s+/).filter(Boolean)
  if (teile.length < 2) return null
  const vor = teile[0]
  const nach = teile[teile.length - 1]
  const kern = firmenKern(firma)
  const passend = []
  for (const it of items ?? []) {
    const url = String(it?.url ?? '')
    if (!/^https?:\/\/([a-z]{2,3}\.)?linkedin\.com\/in\/[^/?#]+/i.test(url)) continue
    const slug = ohneAkzent(decodeURIComponent(url.split('/in/')[1] ?? '').split(/[?#/]/)[0]).replace(/-/g, ' ')
    const titel = ohneAkzent(it?.title ?? '')
    // Die Person IST das Profil, wenn ihr Name vorn im Titel steht („Vorname Nachname - Rolle | LinkedIn") oder in der Adresse.
    // Nur im Snippet zu stehen reicht nicht: So landete am 02.10. „Ralph Justus Maus" bei einer Kollegin, die seine Firma erwähnt.
    const nameImTitel = titel.slice(0, 60).includes(vor) && titel.slice(0, 60).includes(nach) && titel.indexOf(vor) <= 3
    const nameInAdresse = slug.includes(vor) && slug.includes(nach)
    if (!nameImTitel && !nameInAdresse) continue
    const text = ohneAkzent(`${it?.title ?? ''} ${it?.description ?? ''} ${slug}`)
    const firmaPasst = Boolean(kern) && text.includes(kern)
    const rolleStuetzt = /gesch(ä|a)ftsf(ü|u)hrer|inhaber|gr(ü|u)nder|ceo|managing director|founder|owner/.test(text) && /immobili|makler|real estate/.test(text)
    if (firmaPasst || rolleStuetzt) passend.push({ url: url.split('?')[0], firmaPasst })
  }
  if (!passend.length) return null
  // Mehrere verschiedene Personen mit passender Firma → nicht raten.
  const mitFirma = passend.filter((p) => p.firmaPasst)
  const kandidaten = mitFirma.length ? mitFirma : passend
  const urls = [...new Set(kandidaten.map((p) => p.url.toLowerCase()))]
  return urls.length === 1 ? { url: kandidaten[0].url } : null
}

/** Eine Suche. Nie werfen: Fehler → `{ ergebnis: 'fehler' }`, dann bleibt der Kandidat ungesucht. */
export async function sucheLinkedinProfil({ name, firma }, zugang = dataforseoZugang(), fetchFn = fetch) {
  if (!zugang) return { ergebnis: 'fehler', grund: 'keine DataForSEO-Zugangsdaten' }
  const ctrl = new AbortController()
  const uhr = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const keyword = `${name} ${firma} site:linkedin.com/in`.replace(/\s+/g, ' ').trim()
    const res = await fetchFn(ENDPUNKT, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { Authorization: `Basic ${Buffer.from(`${zugang.login}:${zugang.passwort}`).toString('base64')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([{ keyword, location_code: 2276, language_code: 'de', depth: 10 }]),
    })
    if (!res.ok) return { ergebnis: 'fehler', grund: `HTTP ${res.status}` }
    const j = await res.json()
    const task = j?.tasks?.[0]
    if (task?.status_code && task.status_code !== 20000 && task.status_code !== 40102) return { ergebnis: 'fehler', grund: `DataForSEO ${task.status_code}` }
    const items = (task?.result?.[0]?.items ?? []).filter((i) => i?.type === 'organic')
    const treffer = profilAusTreffern(items, { name, firma })
    return treffer ? { ergebnis: 'gefunden', url: treffer.url } : { ergebnis: 'nicht_gefunden' }
  } catch (e) {
    return { ergebnis: 'fehler', grund: String(e?.message ?? e).slice(0, 80) }
  } finally {
    clearTimeout(uhr)
  }
}

/**
 * Alle offenen Kandidaten mit bekanntem Namen suchen, die noch nicht gesucht
 * wurden. Schreibt `linkedin_url`, `suche_ergebnis`, `suche_at` und protokolliert.
 * Platzhalter („Geschäftsführer unbekannt") werden nicht gesucht.
 */
export async function sucheKandidaten({ supabaseUrl, headers, brandId, log = console.log }) {
  const res = await fetch(
    `${supabaseUrl}/rest/v1/entscheider_kandidaten?brand_id=eq.${brandId}&status=eq.offen&suche_ergebnis=is.null&select=id,gf_name,gf_key,firma,quelle_name&order=created_at&limit=${MAX_JE_LAUF}`,
    { headers },
  )
  if (!res.ok) {
    // Ohne Migration 0096 gibt es die Spalte nicht — dann still weiter, nichts kaputt.
    log(`[runner] GF-Suche übersprungen (HTTP ${res.status})`)
    return { gesucht: 0, gefunden: 0 }
  }
  const kandidaten = (await res.json()).filter((k) => !String(k.gf_key).startsWith('unbekannt:'))
  let gefunden = 0
  let gesucht = 0
  const prot = []
  for (const k of kandidaten) {
    const r = await sucheLinkedinProfil({ name: k.gf_name, firma: k.firma })
    if (r.ergebnis === 'fehler') {
      log(`[runner] GF-Suche ${k.gf_name}: ${r.grund}`)
      continue
    }
    gesucht++
    const patch = { suche_ergebnis: r.ergebnis, suche_at: new Date().toISOString(), ...(r.url ? { linkedin_url: r.url } : {}) }
    const up = await fetch(`${supabaseUrl}/rest/v1/entscheider_kandidaten?id=eq.${k.id}`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(patch),
    })
    if (!up.ok) continue
    if (r.url) gefunden++
    prot.push({ art: 'gf_suche', name: k.gf_name, firma: k.firma, entscheidung: r.ergebnis, grund: r.url ?? `über ${k.quelle_name}`, daten: { quelle: k.quelle_name, url: r.url ?? null } })
  }
  await protokolliere({ supabaseUrl, headers, brandId }, prot)
  log(`[runner] GF-Suche: ${gesucht} gesucht, ${gefunden} Profile gefunden`)
  return { gesucht, gefunden }
}

/**
 * Angestellte freigeben, deren GF-Weg erledigt ist (02.10.2026).
 *
 * Kevin: „Wenn der nach 14 Tagen auf nichts geantwortet hat, kann man es
 * später nochmal über den Angestellten probieren." Eine Zeile
 * `[zurückgestellt] erst GF …` wird gelöscht, sobald alle Kandidaten dieses
 * Angestellten `verworfen` sind oder seit {@link GF_WARTEZEIT_TAGE} Tagen
 * `angefragt` ohne Annahme. Dann zählt er wieder als wartend und bekommt in der
 * nächsten Runde seine Erstnachricht.
 */
export async function entscheiderFreigabe({ supabaseUrl, headers, brandId, jetzt = new Date(), log = console.log }) {
  const [kRes, zRes] = await Promise.all([
    fetch(`${supabaseUrl}/rest/v1/entscheider_kandidaten?brand_id=eq.${brandId}&select=quelle_name,status,status_at,gf_key&limit=1000`, { headers }),
    fetch(`${supabaseUrl}/rest/v1/linkedin_erstnachrichten?brand_id=eq.${brandId}&status=eq.uebersprungen&nachricht=like.${encodeURIComponent('[zurückgestellt] erst*')}&select=id,name,firma&limit=1000`, { headers }),
  ])
  if (!kRes.ok || !zRes.ok) return { freigegeben: 0 }
  const kandidaten = await kRes.json()
  const zeilen = await zRes.json()
  const frei = (k) => k.status === 'verworfen' || (k.status === 'angefragt' && k.status_at && jetzt - new Date(k.status_at) >= GF_WARTEZEIT_TAGE * 86_400_000)
  const jeQuelle = new Map()
  for (const k of kandidaten) {
    const q = String(k.quelle_name ?? '').toLowerCase().trim()
    jeQuelle.set(q, [...(jeQuelle.get(q) ?? []), k])
  }
  const prot = []
  let n = 0
  for (const z of zeilen) {
    const ks = jeQuelle.get(String(z.name ?? '').toLowerCase().trim())
    if (!ks?.length || !ks.every(frei)) continue
    const del = await fetch(`${supabaseUrl}/rest/v1/linkedin_erstnachrichten?id=eq.${z.id}&status=eq.uebersprungen`, { method: 'DELETE', headers })
    if (!del.ok) continue
    n++
    prot.push({ art: 'freigabe', name: z.name, firma: z.firma, entscheidung: 'freigegeben', grund: ks.some((k) => k.status === 'angefragt') ? `GF seit ${GF_WARTEZEIT_TAGE} Tagen angefragt, keine Annahme` : 'GF verworfen' })
  }
  if (n) {
    await protokolliere({ supabaseUrl, headers, brandId }, prot)
    log(`[runner] GF-Freigabe: ${n} Angestellte zurück im Vorrat`)
  }
  return { freigegeben: n }
}
