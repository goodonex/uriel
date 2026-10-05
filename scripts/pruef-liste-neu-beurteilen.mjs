/**
 * Die offenen Prüf-Fälle noch einmal durch den Prüfer mit den Regeln vom 03.10.2026
 * (Geschäftsführer auf der Seite genügt, Hinweise in Klartext).
 *
 *   node scripts/pruef-liste-neu-beurteilen.mjs          # nur Probelauf, schreibt nichts
 *   node scripts/pruef-liste-neu-beurteilen.mjs --apply  # sichern + Urteile eintragen
 *
 * ok      → Prüf-Marke weg, Text geht in die Erstnachrichten
 * neu/zurueck → bleibt in der Prüf-Liste, mit neuem Klartext-Hinweis
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ansatzFuer, klartextHinweis, pruefeEntwuerfe, schreibeNeu } from '../runner/linkedin/erstnachrichtenAblauf.mjs'

const wurzel = join(import.meta.dirname, '..')
const env = Object.fromEntries(
  readFileSync(join(wurzel, 'runner/.env'), 'utf8').split('\n').filter((z) => /^[A-Z_]+=/.test(z)).map((z) => [z.slice(0, z.indexOf('=')), z.slice(z.indexOf('=') + 1).trim()]),
)
const kopf = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' }
const rest = (p, o = {}) => fetch(`${env.SUPABASE_URL}/rest/v1/${p}`, { headers: kopf, ...o })
const anwenden = process.argv.includes('--apply')
const MARKE = /\s*·\s*PRÜFEN:\s*/

const alle = await (await rest('linkedin_erstnachrichten?select=*&status=eq.offen&geprueft_at=is.null&limit=1000')).json()
const faelle = alle.filter((z) => MARKE.test(z.firma ?? ''))
console.log(`${faelle.length} offene Prüf-Fälle`)

const leads = new Map()
const ids = [...new Set(faelle.map((z) => z.lead_id).filter(Boolean))]
for (let i = 0; i < ids.length; i += 50) {
  const teil = ids.slice(i, i + 50)
  for (const l of await (await rest(`leads?select=id,profil_key,name,headline,profil&id=in.(${teil.join(',')})`)).json()) leads.set(l.id, l)
}
const nachName = new Map()
const vorlage = []
for (const z of faelle) {
  const l = leads.get(z.lead_id)
  if (!l) { console.warn('ohne Lead-Profil:', z.name); continue }
  const { profil: _p, klasse: _k, klasse_grund: _g, ...rest_ } = l.profil ?? {}
  nachName.set(z.name.toLowerCase(), { profil_key: l.profil_key, name: z.name, headline: l.headline, ansatz: undefined, recherche: l.profil ?? {} })
  vorlage.push({ profil_key: l.profil_key, name: z.name, nachricht: z.nachricht, zeile: z })
}

const cwd = wurzel
const lauf = { cliPath: process.env.PATH ?? '', cwd }
const urteile = new Map()
let kosten = 0
for (let i = 0; i < vorlage.length; i += 13) {
  const r = await pruefeEntwuerfe(vorlage.slice(i, i + 13), nachName, lauf)
  kosten += r.kosten
  if (!r.urteile) { console.error(`Batch ${i / 13 + 1}: Prüfer ohne Ergebnis, übersprungen`); continue }
  for (const [k, v] of r.urteile) urteile.set(k, v)
  console.log(`Batch ${i / 13 + 1} fertig`)
}
console.log(`Kosten ca. $${kosten.toFixed(2)}`)

const datei = join(wurzel, `docs/backup-pruef-liste-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`)
if (anwenden) writeFileSync(datei, JSON.stringify(faelle, null, 1))

// Durchgefallene (neu) einmal neu schreiben und noch einmal prüfen, wie im Nacht-Lauf.
const nochmal = vorlage.filter((v) => urteile.get(v.name.toLowerCase())?.urteil === 'neu').map((v) => {
  const lead = nachName.get(v.name.toLowerCase())
  const u = urteile.get(v.name.toLowerCase())
  return { ...lead, ansatz: u.ansatz ?? ansatzFuer(lead).ansatz, hinweis_pruefer: u.hinweis, vorheriger_text: v.nachricht }
})
const neuText = new Map()
if (nochmal.length) {
  const z = await schreibeNeu(nochmal, lauf)
  kosten += z.kosten
  const zweiter = z.nachrichten.map((n) => ({ profil_key: n.profil_key, name: n.name, nachricht: n.nachricht }))
  const p2 = await pruefeEntwuerfe(zweiter, nachName, lauf)
  kosten += p2.kosten
  for (const n of zweiter) {
    const u = p2.urteile?.get(String(n.name).toLowerCase())
    neuText.set(String(n.name).toLowerCase(), { text: n.nachricht, urteil: u?.urteil ?? 'neu', hinweis: u?.hinweis })
  }
}
console.log(`Kosten gesamt ca. $${kosten.toFixed(2)}`)

const zaehl = { frei: 0, bleibt: 0 }
const plan = []
for (const v of vorlage) {
  const k = v.name.toLowerCase()
  const u = urteile.get(k)
  const firmaRein = v.zeile.firma.split(MARKE)[0].trim()
  if (!u) continue
  const n = neuText.get(k)
  const freigabe = u.urteil === 'ok' || n?.urteil === 'ok'
  const patch = freigabe
    ? { firma: firmaRein, geprueft_at: new Date().toISOString(), ...(n?.urteil === 'ok' ? { nachricht: n.text } : {}) }
    : { firma: `${firmaRein} · PRÜFEN: ${klartextHinweis(n?.hinweis || u.hinweis)}`, ...(n ? { nachricht: n.text } : {}) }
  freigabe ? zaehl.frei++ : zaehl.bleibt++
  plan.push({ id: v.zeile.id, name: v.name, patch, freigabe, hinweis: freigabe ? '' : klartextHinweis(n?.hinweis || u.hinweis), neu: !!n })
}
console.log(zaehl)
for (const p of plan) console.log(`${p.freigabe ? 'frei  ' : 'bleibt'}${p.neu ? ' (neu geschrieben)' : ''} ${p.name}${p.hinweis ? ' — ' + p.hinweis : ''}`)
if (!anwenden) { console.log('Probelauf, nichts geschrieben.'); process.exit(0) }
for (const p of plan) {
  const r = await rest(`linkedin_erstnachrichten?id=eq.${p.id}&status=eq.offen`, { method: 'PATCH', body: JSON.stringify(p.patch) })
  if (!r.ok) console.error('Schreiben fehlgeschlagen:', p.name, r.status)
}
console.log('geschrieben, Sicherung:', datei)
