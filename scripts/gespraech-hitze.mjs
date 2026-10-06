#!/usr/bin/env node
/**
 * Gesprächs-Hitze aus dem LinkedIn-Verlauf an die Leads schreiben (idempotent).
 *   node --env-file=runner/.env scripts/gespraech-hitze.mjs [--trocken]
 * Schreibt `leads.profil.gespraech`, setzt bei "heiss" den Topf auf `jetzt` und
 * stellt den Grund voran ("Heiß: fragte nach dem Preis · …").
 */
import { gespraechsHitze } from '../runner/linkedin/gespraechsHitze.mjs'
const U = process.env.SUPABASE_URL, K = process.env.SUPABASE_SERVICE_ROLE_KEY
const kopf = { apikey: K, Authorization: `Bearer ${K}`, 'Content-Type': 'application/json' }
const TROCKEN = process.argv.includes('--trocken')
const alle = async (p) => { const o = []; for (let off = 0; ; off += 1000) { const d = await (await fetch(`${U}/rest/v1/${p}&limit=1000&offset=${off}`, { headers: kopf })).json(); o.push(...d); if (d.length < 1000) return o } }
const th = await alle('linkedin_threads?select=lead_id,name,verlauf,agent_urteil&lead_id=not.is.null&order=id')
const leads = Object.fromEntries((await alle('leads?select=id,klasse_grund,profil&order=id')).map((l) => [l.id, l]))
const zaehl = {}; let n = 0
const liste = []
for (const t of th) {
  const h = gespraechsHitze(t.verlauf, t.agent_urteil)
  if (h.stufe === 'keine') continue
  const l = leads[t.lead_id]; if (!l) continue
  zaehl[h.stufe] = (zaehl[h.stufe] ?? 0) + 1
  const profil = { ...(l.profil ?? {}), gespraech: h }
  if (h.stufe === 'heiss' && profil.topf !== 'vermutlich-inaktiv') profil.topf = 'jetzt'
  const rest = String(l.klasse_grund ?? '').replace(/^(Heiß|Warm|Kalt): [^·]*· /, '')
  const pre = { heiss: 'Heiß', warm: 'Warm', kalt: 'Kalt' }[h.stufe]
  if (h.stufe === 'heiss') liste.push(`${t.name} (${h.grund}, ${h.tage} Tage her)`)
  if (TROCKEN) continue
  const res = await fetch(`${U}/rest/v1/leads?id=eq.${t.lead_id}`, { method: 'PATCH', headers: { ...kopf, Prefer: 'return=minimal' }, body: JSON.stringify({ profil, klasse_grund: `${pre}: ${h.grund} · ${rest}` }) })
  if (res.ok) n++
}
console.log(JSON.stringify(zaehl), `${n} geschrieben`)
console.log(liste.join('\n'))
