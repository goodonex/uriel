/**
 * Kevins Feedback aus der Stufe „Prüfen" abholen und die neuen Texte zurückschreiben (05.10.2026).
 *
 * Das Feedback schreibt Kevin in Uriel (`PruefListe.tsx`), gespeichert in
 * `ui_settings` unter `erstnachrichtenFeedback`. Wie eine Session damit
 * arbeitet, steht in `.claude/skills/erstnachrichten-feedback/SKILL.md`.
 *
 *   npx tsx scripts/erstnachrichten-feedback.ts holen
 *     → JSON auf stdout: je Text Name, Firma, Website, Prüf-Hinweis, alter Text, Kevins Feedback
 *
 *   npx tsx scripts/erstnachrichten-feedback.ts setzen <datei.json>
 *     → <datei.json> = [{ "id": "...", "nachricht": "..." } | { "id": "...", "aussortieren": true }]
 *       Schreibt den neuen Text, setzt den Prüf-Haken (Kevin hat den Lead ja angesehen),
 *       stempelt die aktuelle Regel-Fassung und nimmt das Feedback aus der Sammlung.
 *
 * **Warum `setzen` auf saubere Regeln besteht.** Jede Erstnachricht trägt die
 * Regel-Fassung (Hash über `runner/regeln/erstnachrichten/`). Der Mini rechnet
 * sie aus SEINEM Stand von git. Würde hier mit einer ungesicherten Regeländerung
 * gestempelt, hielte der Mini die frisch korrigierten Texte für veraltet und
 * schriebe sie in der nächsten Runde über — Kevins Korrektur wäre weg.
 */
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
// @ts-expect-error — .mjs ohne Typen, dieselbe Fassung wie im Runner
import { regelwerk } from '../runner/regeln/fassung.mjs'

const SCHLUESSEL = 'erstnachrichtenFeedback'
const MARKE = /\s*·\s*PRÜFEN:\s*/
const WURZEL = new URL('..', import.meta.url).pathname

const env = Object.fromEntries(
  readFileSync(new URL('../runner/.env', import.meta.url), 'utf8')
    .split('\n')
    .filter((z) => z.includes('=') && !z.trim().startsWith('#'))
    .map((z) => [z.slice(0, z.indexOf('=')).trim(), z.slice(z.indexOf('=') + 1).trim()] as [string, string]),
)
const url = (env.SUPABASE_URL ?? '').replace(/\/$/, '')
const key = env.SUPABASE_SERVICE_ROLE_KEY ?? ''
if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY fehlen (runner/.env)')
const kopf = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }

async function rest(pfad: string, init: RequestInit = {}) {
  const res = await fetch(`${url}/rest/v1/${pfad}`, { ...init, headers: { ...kopf, ...(init.headers ?? {}) } })
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${pfad} HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return res.status === 204 ? null : res.json()
}

type Eintrag = { text: string; name: string; at: string }

async function sammlung(): Promise<{ userId: string; werte: Record<string, Eintrag> } | null> {
  const zeilen = (await rest(`ui_settings?setting_key=eq.${SCHLUESSEL}&select=user_id,setting_value`)) as any[]
  if (!zeilen.length) return null
  return { userId: zeilen[0].user_id, werte: zeilen[0].setting_value ?? {} }
}

async function holen() {
  const s = await sammlung()
  const ids = Object.keys(s?.werte ?? {})
  if (!ids.length) {
    console.log(JSON.stringify({ anzahl: 0, texte: [] }, null, 2))
    return
  }
  const zeilen = (await rest(
    `linkedin_erstnachrichten?id=in.(${ids.join(',')})&select=id,name,firma,website,nachricht,status,geprueft_at,lead_id`,
  )) as any[]
  // Nur, was noch in der Prüf-Liste steht. Gesendetes oder Aussortiertes ist erledigt.
  const texte = zeilen
    .filter((z) => z.status === 'offen' && !z.geprueft_at)
    .map((z) => {
      const [firma, ...hinweis] = String(z.firma ?? '').split(MARKE)
      return {
        id: z.id,
        name: z.name,
        firma: firma.trim(),
        website: z.website,
        pruef_hinweis: hinweis.join(' · ').trim(),
        alter_text: z.nachricht,
        feedback: s!.werte[z.id].text,
        feedback_am: s!.werte[z.id].at,
        lead_id: z.lead_id,
      }
    })
  console.log(JSON.stringify({ anzahl: texte.length, texte }, null, 2))
}

function regelnGesichert(): void {
  const dreckig = execSync('git status --porcelain -- runner/regeln', { cwd: WURZEL, encoding: 'utf8' }).trim()
  if (dreckig) {
    throw new Error(`Regeländerungen sind noch nicht committet und gepusht:\n${dreckig}\nErst sichern, dann setzen.`)
  }
  const vorne = execSync('git rev-list --count @{u}..HEAD', { cwd: WURZEL, encoding: 'utf8' }).trim()
  if (vorne !== '0') throw new Error(`${vorne} Commit(s) noch nicht gepusht. Der Mini kennt die neuen Regeln sonst nicht.`)
}

async function setzen(datei: string) {
  const liste = JSON.parse(readFileSync(datei, 'utf8')) as { id: string; nachricht?: string; aussortieren?: boolean }[]
  regelnGesichert()
  const { quelle } = regelwerk()
  const s = await sammlung()
  const jetzt = new Date().toISOString()
  let geschrieben = 0
  let raus = 0
  for (const e of liste) {
    if (e.aussortieren) {
      await rest(`linkedin_erstnachrichten?id=eq.${e.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'uebersprungen' }) })
      raus++
    } else {
      const text = String(e.nachricht ?? '').trim()
      if (!text) throw new Error(`Leerer Text für ${e.id}`)
      const [alt] = (await rest(`linkedin_erstnachrichten?id=eq.${e.id}&select=firma`)) as any[]
      const firma = String(alt?.firma ?? '').split(MARKE)[0].trim()
      await rest(`linkedin_erstnachrichten?id=eq.${e.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ nachricht: text, firma, geprueft_at: jetzt, pruef_url: null, quelle_datei: quelle }),
      })
      geschrieben++
    }
    if (s) delete s.werte[e.id]
  }
  if (s) {
    await rest(`ui_settings?user_id=eq.${s.userId}&setting_key=eq.${SCHLUESSEL}`, {
      method: 'PATCH',
      body: JSON.stringify({ setting_value: s.werte, updated_at: jetzt }),
    })
  }
  console.log(`${geschrieben} Texte neu, ${raus} aussortiert, Fassung ${quelle}. Offen in der Sammlung: ${Object.keys(s?.werte ?? {}).length}`)
}

const [befehl, arg] = process.argv.slice(2)
if (befehl === 'holen') await holen()
else if (befehl === 'setzen' && arg) await setzen(arg)
else {
  console.error('Aufruf: holen | setzen <datei.json>')
  process.exit(1)
}
