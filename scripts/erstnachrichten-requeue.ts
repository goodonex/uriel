/**
 * Leads zurück in den Vorrat (02.10.2026).
 *
 * Kevin: „zu gut für die Analyse, und die direkt aus der Ansprache raus, macht
 * doch keinen Sinn." Die Namen in `docs/lead-requeue-2026-10-02.json` wurden
 * vom Nacht-Agenten oder Prüfer aussortiert (`status = uebersprungen`), obwohl
 * sie zur Zielgruppe passen. Dieses Skript sichert ihre Zeilen und löscht sie
 * dann — danach zählt `angenommenOhneErstnachricht` sie wieder als wartend, und
 * die nächste Nacht-Runde schreibt sie mit den neuen Regeln (Aufbau S/T).
 *
 * Erst NACH dem Release der neuen Regeln laufen lassen, sonst werden sie nachts
 * mit den alten Regeln wieder aussortiert.
 *
 *   npx tsx scripts/erstnachrichten-requeue.ts          # nur Probelauf
 *   npx tsx scripts/erstnachrichten-requeue.ts --apply  # sichern + löschen
 *
 * Eine andere Namensliste als die vom 02.10. geht als Pfad mit (06.10.2026,
 * Bekiri Djelal — aussortiert als „kein Makler", siehe runner/regeln/zielgruppe.mjs):
 *
 *   npx tsx scripts/erstnachrichten-requeue.ts docs/lead-requeue-2026-10-06.json --apply
 *
 * Es werden nur Zeilen mit Status `uebersprungen` angefasst. Gesendete und
 * offene bleiben immer stehen.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const wurzel = join(import.meta.dirname, '..')
const env = Object.fromEntries(
  readFileSync(join(wurzel, 'runner/.env'), 'utf8')
    .split('\n')
    .filter((z) => /^[A-Z_]+=/.test(z))
    .map((z) => [z.slice(0, z.indexOf('=')), z.slice(z.indexOf('=') + 1).trim()]),
)
const url = env.SUPABASE_URL
const kopf = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` }
const anwenden = process.argv.includes('--apply')
const liste = process.argv.slice(2).find((a) => a.endsWith('.json')) ?? 'docs/lead-requeue-2026-10-02.json'
const namen: string[] = JSON.parse(readFileSync(join(wurzel, liste), 'utf8'))
const norm = (s: string) => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
const gesucht = new Set(namen.map(norm))

const zeilen: any[] = []
for (let off = 0; ; off += 1000) {
  const r = await fetch(`${url}/rest/v1/linkedin_erstnachrichten?select=*&status=eq.uebersprungen&limit=1000&offset=${off}`, { headers: kopf })
  const j = await r.json()
  zeilen.push(...j)
  if (j.length < 1000) break
}
const treffer = zeilen.filter((z) => gesucht.has(norm(z.name)))
const gefunden = new Set(treffer.map((z) => norm(z.name)))
const fehlt = namen.filter((n) => !gefunden.has(norm(n)))
console.log(`${namen.length} Namen · ${treffer.length} Zeilen mit uebersprungen gefunden · ${fehlt.length} ohne Treffer`)
if (fehlt.length) console.log('ohne Treffer:', fehlt.join(', '))

if (!anwenden) {
  console.log('Probelauf — nichts verändert. Mit --apply sichern und löschen.')
  process.exit(0)
}
const sicherung = join(wurzel, `docs/backup-erstnachrichten-requeue-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.json`)
writeFileSync(sicherung, JSON.stringify(treffer, null, 1))
console.log('gesichert:', sicherung)
let weg = 0
for (const z of treffer) {
  const r = await fetch(`${url}/rest/v1/linkedin_erstnachrichten?id=eq.${z.id}&status=eq.uebersprungen`, { method: 'DELETE', headers: kopf })
  if (r.ok) weg++
  else console.error('Löschen fehlgeschlagen:', z.name, r.status)
}
console.log(`${weg} Zeilen gelöscht`)
