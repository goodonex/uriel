/**
 * Anreicherung für den Bestand nachtragen (29.09.2026).
 *
 * Für jeden Lead mit Website: Startseite, Impressum und Team-Seite lesen
 * (`runner/linkedin/anreicherung.mjs`), Nummer/Mail/Alter/Team/Website-Signal
 * ins Profil mischen, Punkte, Topf und Klasse neu rechnen. Ein Abruf je
 * Unternehmen, nicht je Lead — mehrere Kontakte teilen sich eine Domain.
 *
 * Start: node scripts/anreicherung-nachtragen.mjs [--alle] [--limit=N]
 *   --alle   auch Leads, die schon in dieser Fassung angereichert sind
 * Kein Modell, keine bezahlte Abfrage. Idempotent.
 */
import { readFileSync } from 'node:fs'
import { reichereAn, mischeProfil, ANREICHERUNG_FASSUNG } from '../runner/linkedin/anreicherung.mjs'
import { besteNummer } from '../runner/linkedin/kontaktdaten.mjs'
import { bewerte } from '../runner/linkedin/leadProfil.mjs'

const env = readFileSync(new URL('../runner/.env', import.meta.url), 'utf8')
const lies = (k) => env.match(new RegExp(`^${k}=(.+)$`, 'm'))?.[1]?.trim().replace(/^["']|["']$/g, '')
const URL_ = lies('SUPABASE_URL')
const KEY = lies('SUPABASE_SERVICE_ROLE_KEY')
const kopf = { apikey: KEY, Authorization: `Bearer ${KEY}` }
const alle = process.argv.includes('--alle')
const limit = Number(process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1] ?? Infinity)
const PARALLEL = 10

const domainAus = (w) => String(w ?? '').replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase()

let leads = []
for (let o = 0; ; o += 1000) {
  const r = await fetch(`${URL_}/rest/v1/leads?select=id,name,telefon,email,profil&profil->>website=not.is.null&limit=1000&offset=${o}`, { headers: kopf })
  const teil = await r.json()
  leads = leads.concat(teil)
  if (teil.length < 1000) break
}
const offen = leads.filter((l) => domainAus(l.profil?.website) && (alle || Number(l.profil?.anreicherung_fassung ?? 0) < ANREICHERUNG_FASSUNG))
const jeDomain = new Map()
for (const l of offen) {
  const d = domainAus(l.profil.website)
  jeDomain.set(d, [...(jeDomain.get(d) ?? []), l])
}
const domains = [...jeDomain.keys()].slice(0, limit)
console.log(`${offen.length} Leads, ${domains.length} Unternehmen`)

const stat = { unternehmen: 0, erreicht: 0, mobil: 0, fest: 0, mail: 0, leads: 0, fehler: 0 }
let naechster = 0
async function arbeiter() {
  while (naechster < domains.length) {
    const d = domains[naechster++]
    const gruppe = jeDomain.get(d)
    let r
    try {
      r = await reichereAn(gruppe[0].profil.website)
    } catch (e) {
      r = { ok: false, felder: { anreicherung_fehler: String(e?.message ?? e).slice(0, 80) } }
    }
    stat.unternehmen++
    if (r.ok) {
      stat.erreicht++
      if (r.felder.telefon_mobil) stat.mobil++
      else if (r.felder.telefon_fest) stat.fest++
      if (r.felder.email_impressum) stat.mail++
    }
    for (const l of gruppe) {
      const profil = mischeProfil(l.profil, r.felder)
      const b = bewerte(profil)
      const body = {
        profil: { ...profil, punkte: b.punkte, topf: b.topf },
        klasse: b.klasse,
        klasse_grund: b.grund,
        telefon: besteNummer(r.felder) ?? l.telefon ?? '',
        email: l.email || r.felder.email_impressum || '',
      }
      const res = await fetch(`${URL_}/rest/v1/leads?id=eq.${l.id}`, {
        method: 'PATCH',
        headers: { ...kopf, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify(body),
      })
      if (res.ok) stat.leads++
      else {
        stat.fehler++
        if (stat.fehler <= 5) console.error(`Fehler ${l.name}: HTTP ${res.status} ${(await res.text().catch(() => '')).slice(0, 200)}`)
      }
    }
    if (stat.unternehmen % 50 === 0) console.log(new Date().toISOString().slice(11, 19), JSON.stringify(stat))
  }
}
await Promise.all(Array.from({ length: PARALLEL }, arbeiter))
console.log('FERTIG', JSON.stringify(stat))
