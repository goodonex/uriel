/**
 * Kevins Rückmeldungen an Claude abholen und die neuen Texte zurückschreiben (08.10.2026).
 *
 * Kevin gibt sie in Uriel an jeder Nachricht ab („Claude sagen, was nicht passt",
 * `app/src/cockpit/components/ClaudeFeedback.tsx`) — in Prüfen, Erstnachrichten,
 * Antworten, Follow-ups, Looms und Anfragen an dich. Gespeichert in `ui_settings`
 * unter `nachrichtenFeedback`. Solange ein Eintrag dort steht, fehlt die Nachricht
 * in ihrer Liste und zählt vorerst als erledigt. Wie eine Session damit arbeitet:
 * `.claude/skills/nachrichten-feedback/SKILL.md`.
 *
 *   npx tsx scripts/nachrichten-feedback.ts holen
 *     → JSON auf stdout: je Nachricht Art, Stufe, Lead, aktueller Text, Verlauf,
 *       Kevins Feedback und die Pfade seiner Screenshots (JPEG, mit Read ansehen).
 *       Einträge, deren Nachricht inzwischen anders erledigt ist, räumt es still ab.
 *
 *   npx tsx scripts/nachrichten-feedback.ts setzen <datei.json>
 *     → <datei.json> = [
 *         { "schluessel": "...", "nachricht": "..." }     neuer Text, zurück in die Liste
 *         { "schluessel": "...", "aussortieren": true }   geht nicht raus (Erstnachricht, Anfrage)
 *         { "schluessel": "...", "zurueck": true }        unverändert zurück in die Liste
 *       ]
 *
 * **Warum `setzen` auf gesicherte Regeln besteht.** Erstnachrichten tragen die
 * Regel-Fassung, Entwürfe an Threads ihren Zeitpunkt. Der Mini vergleicht beides
 * mit SEINEM Stand von git. Wäre eine Regeländerung noch nicht gepusht, hielte er
 * die frisch korrigierten Texte für veraltet und schriebe sie über.
 */
import { execSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
// @ts-expect-error — .mjs ohne Typen, dieselbe Fassung wie im Runner
import { regelwerk } from '../runner/regeln/fassung.mjs'

const SCHLUESSEL = 'nachrichtenFeedback'
const ALT_SCHLUESSEL = 'erstnachrichtenFeedback'
const MARKE = /\s*·\s*PRÜFEN:\s*/
const WURZEL = fileURLToPath(new URL('..', import.meta.url))

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
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

type Stufe = 'anfragen' | 'pruefen' | 'erstnachrichten' | 'antworten' | 'followups' | 'looms'
type Eintrag = { text: string; bilder?: string[]; at: string; stufe: Stufe; name: string; firma?: string; nachricht?: string }
type Sammlung = Record<string, Eintrag>

/** `erstnachricht:<id>` → Tabelle `linkedin_erstnachrichten`, `thread:`/`loom:` → `linkedin_threads`, `anfrage:` → `linkedin_anfragen`. */
function ziel(schluessel: string): { art: 'erstnachricht' | 'thread' | 'anfrage'; id: string } {
  const [praefix, ...rest] = schluessel.split(':')
  const id = rest.join(':')
  if (praefix === 'erstnachricht') return { art: 'erstnachricht', id }
  if (praefix === 'thread' || praefix === 'loom') return { art: 'thread', id }
  if (praefix === 'anfrage') return { art: 'anfrage', id }
  throw new Error(`Unbekannter Schlüssel: ${schluessel}`)
}

async function sammlung(): Promise<{ userId: string; werte: Sammlung } | null> {
  const zeilen = (await rest(
    `ui_settings?setting_key=in.(${SCHLUESSEL},${ALT_SCHLUESSEL})&select=user_id,setting_key,setting_value`,
  )) as any[]
  if (!zeilen.length) return null
  const neu = zeilen.find((z) => z.setting_key === SCHLUESSEL)
  const werte: Sammlung = { ...(neu?.setting_value ?? {}) }
  // Noch nicht von der Oberfläche übernommene Einträge aus „Prüfen" (vor dem 08.10.2026).
  const alt = zeilen.find((z) => z.setting_key === ALT_SCHLUESSEL)?.setting_value ?? {}
  for (const [id, e] of Object.entries<any>(alt)) {
    werte[`erstnachricht:${id}`] ??= { text: e.text ?? '', bilder: e.bilder, at: e.at, name: e.name, stufe: 'pruefen' }
  }
  return { userId: (neu ?? zeilen[0]).user_id, werte }
}

async function sammlungSchreiben(userId: string, aendern: (w: Sammlung) => void): Promise<number> {
  // Frisch lesen: Kevin kann während der Session weitere Rückmeldungen abgeben.
  const frisch = (await sammlung())?.werte ?? {}
  aendern(frisch)
  await rest(`ui_settings?on_conflict=user_id,setting_key`, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ user_id: userId, setting_key: SCHLUESSEL, setting_value: frisch, updated_at: new Date().toISOString() }),
  })
  await rest(`ui_settings?user_id=eq.${userId}&setting_key=eq.${ALT_SCHLUESSEL}`, { method: 'DELETE' })
  return Object.keys(frisch).length
}

const BILD_ORDNER = join(tmpdir(), 'uriel-feedback-bilder')

/** Lädt die Screenshots eines Eintrags und legt sie als Dateien ab. */
async function bilderAblegen(name: string, schluessel: string[]): Promise<string[]> {
  if (!schluessel.length) return []
  mkdirSync(BILD_ORDNER, { recursive: true })
  const zeilen = (await rest(
    `ui_settings?setting_key=in.(${schluessel.map((k) => `"${k}"`).join(',')})&select=setting_key,setting_value`,
  )) as any[]
  const basis = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return zeilen.map((z, i) => {
    const pfad = join(BILD_ORDNER, `${basis}-${i + 1}.jpg`)
    const daten = String(z.setting_value?.data ?? '').replace(/^data:image\/\w+;base64,/, '')
    writeFileSync(pfad, Buffer.from(daten, 'base64'))
    return pfad
  })
}

async function bilderLoeschen(schluessel: string[] = []) {
  if (!schluessel.length) return
  await rest(`ui_settings?setting_key=in.(${schluessel.map((k) => `"${k}"`).join(',')})`, { method: 'DELETE' })
}

function verlaufText(t: any): string {
  const eintraege = Array.isArray(t.verlauf) ? t.verlauf : []
  const gegenueber = String(t.name ?? '').trim() || 'Lead'
  const zeilen = eintraege
    .filter((e: any) => e && typeof e.text === 'string' && e.text.trim())
    .map((e: any) => `${e.sender === 'me' ? 'Kevin' : e.sender === 'them' ? gegenueber : '?'}${e.ts ? ` (${String(e.ts).slice(0, 10)})` : ''}: ${e.text.trim()}`)
  if (!zeilen.length) return t.preview ? `${t.last_from === 'me' ? 'Kevin' : gegenueber}: ${t.preview}` : ''
  return zeilen.slice(-12).join('\n')
}

async function holen() {
  const s = await sammlung()
  const eintraege = Object.entries(s?.werte ?? {})
  const texte: any[] = []
  const erledigt: string[] = []
  for (const [schluessel, e] of eintraege) {
    const { art, id } = ziel(schluessel)
    const basis = {
      schluessel,
      art,
      stufe: e.stufe,
      name: e.name,
      feedback: e.text,
      feedback_am: e.at,
    }
    if (art === 'erstnachricht') {
      const [z] = (await rest(`linkedin_erstnachrichten?id=eq.${id}&select=id,name,firma,website,nachricht,status,geprueft_at,lead_id`)) as any[]
      if (!z || z.status !== 'offen') {
        erledigt.push(schluessel)
        continue
      }
      const [firma, ...hinweis] = String(z.firma ?? '').split(MARKE)
      texte.push({
        ...basis,
        firma: firma.trim(),
        website: z.website,
        pruef_hinweis: hinweis.join(' · ').trim() || undefined,
        aktueller_text: z.nachricht,
        lead_id: z.lead_id,
        screenshots: await bilderAblegen(e.name, e.bilder ?? []),
      })
    } else if (art === 'thread') {
      const [t] = (await rest(
        `linkedin_threads?id=eq.${id}&select=id,name,company,profile_url,entwurf,entwurf_at,verlauf,preview,last_from,last_message_at,lead_id`,
      )) as any[]
      if (!t) {
        erledigt.push(schluessel)
        continue
      }
      texte.push({
        ...basis,
        firma: t.company,
        profil: t.profile_url,
        // Follow-ups ohne Agent-Entwurf zeigen eine Vorlage — die steht nur im Eintrag.
        aktueller_text: t.entwurf || e.nachricht || '',
        verlauf: verlaufText(t),
        lead_id: t.lead_id,
        screenshots: await bilderAblegen(e.name, e.bilder ?? []),
      })
    } else {
      const [a] = (await rest(`linkedin_anfragen?id=eq.${id}&select=id,name,headline,firma,website,profile_url,notiz,entwurf,status`)) as any[]
      if (!a || a.status !== 'offen') {
        erledigt.push(schluessel)
        continue
      }
      texte.push({
        ...basis,
        firma: a.firma || a.headline,
        website: a.website,
        profil: a.profile_url,
        notiz_zur_anfrage: a.notiz,
        aktueller_text: a.entwurf ?? e.nachricht ?? '',
        screenshots: await bilderAblegen(e.name, e.bilder ?? []),
      })
    }
  }
  if (erledigt.length && s) {
    for (const k of erledigt) await bilderLoeschen(s.werte[k]?.bilder)
    await sammlungSchreiben(s.userId, (w) => erledigt.forEach((k) => delete w[k]))
  }
  console.log(JSON.stringify({ anzahl: texte.length, anderweitig_erledigt: erledigt.length, texte }, null, 2))
}

function regelnGesichert(): void {
  const dreckig = execSync('git status --porcelain -- runner/regeln', { cwd: WURZEL, encoding: 'utf8' }).trim()
  if (dreckig) {
    throw new Error(`Regeländerungen sind noch nicht committet und gepusht:\n${dreckig}\nErst sichern, dann setzen.`)
  }
  const vorne = execSync('git rev-list --count @{u}..HEAD', { cwd: WURZEL, encoding: 'utf8' }).trim()
  if (vorne !== '0') throw new Error(`${vorne} Commit(s) noch nicht gepusht. Der Mini kennt die neuen Regeln sonst nicht.`)
}

type Auftrag = { schluessel: string; nachricht?: string; aussortieren?: boolean; zurueck?: boolean }

async function setzen(datei: string) {
  const liste = JSON.parse(readFileSync(datei, 'utf8')) as Auftrag[]
  if (liste.some((e) => e.nachricht)) regelnGesichert()
  const { quelle } = regelwerk()
  const s = await sammlung()
  if (!s) throw new Error('Keine Rückmeldungen gespeichert')
  const jetzt = new Date().toISOString()
  const zaehler = { neu: 0, raus: 0, zurueck: 0 }
  for (const e of liste) {
    const { art, id } = ziel(e.schluessel)
    if (e.zurueck) {
      zaehler.zurueck++
    } else if (e.aussortieren) {
      if (art === 'erstnachricht') {
        await rest(`linkedin_erstnachrichten?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'uebersprungen' }) })
      } else if (art === 'anfrage') {
        await rest(`linkedin_anfragen?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'verworfen', status_at: jetzt }) })
      } else {
        throw new Error(`${e.schluessel}: Ein Thread lässt sich nicht aussortieren — „zurueck" oder einen neuen Text setzen.`)
      }
      zaehler.raus++
    } else {
      const text = String(e.nachricht ?? '').trim()
      if (!text) throw new Error(`Leerer Text für ${e.schluessel}`)
      if (art === 'erstnachricht') {
        const [alt] = (await rest(`linkedin_erstnachrichten?id=eq.${id}&select=firma`)) as any[]
        const firma = String(alt?.firma ?? '').split(MARKE)[0].trim()
        // Geprüft: Kevin hat den Lead ja angesehen. Der Text rückt damit zu den Erstnachrichten.
        await rest(`linkedin_erstnachrichten?id=eq.${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ nachricht: text, firma, geprueft_at: jetzt, pruef_url: null, quelle_datei: quelle }),
        })
      } else if (art === 'thread') {
        await rest(`linkedin_threads?id=eq.${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ entwurf: text, entwurf_at: jetzt, entwurf_run_id: 'kevin-feedback' }),
        })
      } else {
        await rest(`linkedin_anfragen?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ entwurf: text, entwurf_at: jetzt }) })
      }
      zaehler.neu++
    }
    await bilderLoeschen(s.werte[e.schluessel]?.bilder)
  }
  const offen = await sammlungSchreiben(s.userId, (w) => liste.forEach((e) => delete w[e.schluessel]))
  console.log(
    `${zaehler.neu} Texte neu, ${zaehler.raus} aussortiert, ${zaehler.zurueck} unverändert zurück. Noch bei Claude: ${offen}.`,
  )
}

const [befehl, arg] = process.argv.slice(2)
if (befehl === 'holen') await holen()
else if (befehl === 'setzen' && arg) await setzen(arg)
else {
  console.error('Aufruf: holen | setzen <datei.json>')
  process.exit(1)
}
