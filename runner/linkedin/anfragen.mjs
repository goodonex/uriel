/**
 * runner/linkedin/anfragen.mjs — Anfragen an Kevin (06.10.2026, Migration 0098).
 *
 * Kevin: *„Ich will noch einen Reiter für wenn einer meiner Zielgruppe mich
 * anfragt. Wir haben dafür noch nichts, was einen Text vorbereitet."*
 *
 * Drei Schritte, jeder für sich prüfbar:
 *
 * 1. **`upsertAnfragen`** — die gelesene Eingangsliste (`leseListe('anfragen')`)
 *    nach `linkedin_anfragen`, samt Zielgruppen-Urteil aus derselben Regel wie
 *    überall (`icp.mjs` → `icpRegeln.json`). Off-ICP bekommt sofort einen
 *    Ausblende-Grund und nie einen Text.
 * 2. **`anfragenFuerEntwurf`** — wer noch einen Text braucht.
 * 3. **`bereiteAnfragenVor`** — dieselbe Website-Recherche wie die
 *    Erstnachrichten (`rechercheLeads`), dann EIN Schreib-Lauf mit Kevins
 *    Stimme (`regeln/stimme/herrmann-outreach.md`, Abschnitt „Eingehende
 *    Anfrage aus der Zielgruppe"). Danach die festen Wachen im Code:
 *    keine Striche, keine Emojis, keine Grußformel.
 *
 * **Nichts hier klickt auf LinkedIn.** Annehmen, Ignorieren und Senden macht
 * Kevin selbst; Uriel legt nur den Text bereit.
 */
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { icpUrteil, istArbeitsVorrat } from './icp.mjs'

const STIMME_PFAD = fileURLToPath(new URL('../regeln/stimme/herrmann-outreach.md', import.meta.url))
const MODELL = process.env.ANFRAGEN_MODELL ?? 'opus'
const LAUF_TIMEOUT_MS = Number(process.env.ANFRAGEN_TIMEOUT_MS ?? 8 * 60 * 1000)
/** Höchstens so viele Texte je Lauf — eingehende Anfragen sind ein paar am Tag, kein Rückstau. */
export const ANFRAGEN_JE_LAUF = Number(process.env.ANFRAGEN_JE_LAUF ?? 8)
/** Nach drei gescheiterten Versuchen bleibt die Anfrage ohne Text sichtbar, statt jede Runde Geld zu ziehen. */
export const ANFRAGEN_MAX_VERSUCHE = 3

// ---------------------------------------------------------------------------
// Reine Funktionen (geprüft in scripts/verify-anfragen-an-dich.ts)
// ---------------------------------------------------------------------------

/**
 * Zielgruppe oder nicht — mit Begründung für die eingeklappte Liste.
 * `unklar` bekommt wie überall einen Versuch: Der Schreiber sieht Notiz und
 * Website und darf dann selbst „kein Ziel" sagen. Ein fälschlich
 * ausgeblendeter Makler, der Kevin von sich aus angefragt hat, wäre der
 * teuerste Fehler dieser ganzen Liste.
 */
export function anfrageZielgruppe(headline, name) {
  const u = icpUrteil(headline, name)
  if (istArbeitsVorrat(u.urteil)) return { urteil: u.urteil, grund: u.grund, ausgeblendet: null }
  return {
    urteil: u.urteil,
    grund: u.grund,
    ausgeblendet: `Nicht deine Zielgruppe laut Profil${u.grund ? ` („${u.grund}")` : ''}`,
  }
}

/**
 * Die festen Wachen nach dem Schreiben — Kevins Stil, nicht verhandelbar.
 *
 * - **Keine Striche** (Geviert, Halbgeviert, freistehender Bindestrich): ein
 *   KI-Erkennungszeichen, Kevin schreibt so nicht. Aus „Danke — kurze Frage"
 *   wird „Danke, kurze Frage".
 * - **Keine Emojis**, stehende Anweisung seit 17.06.2026.
 * - **Keine Grußformel** (10.09.2026): Auf LinkedIn steht der Absender am Profil.
 */
export function glaetteAnfrageText(roh) {
  let t = String(roh ?? '').replace(/\r\n/g, '\n').trim()
  // Code-Zäune, falls das Modell den Text doch einpackt.
  t = t.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/, '').trim()
  t = t.replace(/\p{Extended_Pictographic}️?/gu, '')
  // Striche zwischen Satzteilen → Komma. Bindestriche IN Wörtern (Eigentümer-Anfragen) bleiben.
  t = t.replace(/[ \t]*[—–][ \t]*/g, ', ').replace(/[ \t]+-[ \t]+/g, ', ')
  t = t.replace(/,\s*,/g, ',').replace(/,\s*([.?!])/g, '$1').replace(/^,\s*/gm, '')
  // Grußformel am Ende („Beste Grüße\nKevin", „VG Kevin", nur „Kevin").
  t = t.replace(/\n+\s*(beste|viele|liebe|schöne)?\s*grüße[\s\S]*$/i, '')
  t = t.replace(/\n+\s*(vg|lg|bg)\b[\s\S]*$/i, '')
  t = t.replace(/\n+\s*kevin\s*$/i, '')
  t = t.replace(/[ \t]+$/gm, '').replace(/\n{3,}/g, '\n\n')
  return t.trim()
}

/** Der letzte ```json-Block einer Modell-Antwort, oder null. */
export function letzterJsonBlock(text) {
  const treffer = [...String(text ?? '').matchAll(/```json\s*([\s\S]*?)```/g)]
  const roh = treffer.length ? treffer[treffer.length - 1][1] : String(text ?? '').trim()
  try {
    return JSON.parse(roh)
  } catch {
    return null
  }
}

/**
 * Die Antwort des Schreibers in Zeilen für die Datenbank.
 * Unbekannte Schlüssel fliegen raus: Der Schreiber darf keine Person erfinden.
 *
 * @returns {{ entwuerfe: Array<{profil_key: string, nachricht: string}>, ausgeblendet: Array<{profil_key: string, grund: string}> } | null}
 */
export function parseAnfrageAntwort(text, erlaubteKeys) {
  const json = letzterJsonBlock(text)
  if (!json || (!Array.isArray(json.entwuerfe) && !Array.isArray(json.ausgeblendet))) return null
  const erlaubt = new Set(erlaubteKeys)
  const entwuerfe = []
  const ausgeblendet = []
  const gesehen = new Set()
  for (const e of json.entwuerfe ?? []) {
    const key = String(e?.profil_key ?? '').trim().toLowerCase()
    const nachricht = glaetteAnfrageText(e?.nachricht)
    if (!erlaubt.has(key) || gesehen.has(key) || nachricht.length < 20) continue
    gesehen.add(key)
    entwuerfe.push({ profil_key: key, nachricht })
  }
  for (const a of json.ausgeblendet ?? []) {
    const key = String(a?.profil_key ?? '').trim().toLowerCase()
    if (!erlaubt.has(key) || gesehen.has(key)) continue
    gesehen.add(key)
    ausgeblendet.push({ profil_key: key, grund: String(a?.grund ?? '').trim().slice(0, 240) || 'Vom Schreiber als kein Ziel erkannt' })
  }
  return { entwuerfe, ausgeblendet }
}

/** Was der Schreiber über eine Person sieht — das Destillat, keine Rohdaten. */
export function fuerSchreiber(zeile) {
  const r = zeile.recherche ?? null
  return {
    profil_key: zeile.profil_key,
    name: zeile.name,
    headline: zeile.headline,
    notiz: zeile.notiz || '',
    gemeinsame: zeile.gemeinsame || '',
    recherche: r
      ? {
          firma: r.firma ?? '',
          website: r.website ?? '',
          sicher: r.sicher ?? false,
          taetigkeit: r.taetigkeit ?? '',
          geschaeftsmodell: r.geschaeftsmodell ?? '',
          rolle: r.rolle ?? '',
          website_stufe: r.website_stufe ?? '',
          staerke: r.staerke ?? '',
          gesamteindruck: r.gesamteindruck ?? '',
          zielgruppe: r.zielgruppe ?? '',
        }
      : null,
  }
}

/** Der Prompt. Die Regeln selbst stehen in Kevins Stimme, nicht hier. */
export function baueAnfragenPrompt(personen, stimme) {
  return (
    `${stimme}\n\n---\n\n` +
    `# Auftrag: Antworten auf eingehende Vernetzungsanfragen\n\n` +
    `Diese Personen haben Kevin auf LinkedIn VON SICH AUS eine Vernetzungsanfrage geschickt. ` +
    `Kevin nimmt sie gleich an und schickt danach deinen Text. Schreib je Person genau eine Nachricht ` +
    `nach dem Abschnitt „Eingehende Anfrage aus der Zielgruppe" oben. Alle übrigen Regeln der Stimme gelten mit.\n\n` +
    `Wichtig:\n` +
    `- Sie kamen auf Kevin zu. Kein Pitch, keine Analyse, kein Angebot, kein CTA aus der Tabelle.\n` +
    `- \`notiz\` ist ihre Nachricht zur Anfrage. Steht dort etwas, geh darauf ein. Ist sie leer, erfinde keine.\n` +
    `- \`recherche\` ist die geprüfte Website-Recherche. Ist sie null oder \`sicher\` false, erwähne keine Website.\n` +
    `- Keine Gedankenstriche, keine Halbgeviertstriche, keine Emojis, keine Grußformel.\n` +
    `- Ist jemand erkennbar NICHT Kevins Zielgruppe (Coach, Recruiter, Software-, KI- oder Marketing-Anbieter, ` +
    `jemand, der Kevin etwas verkaufen will, Finanzvertrieb), schreib keinen Text, sondern setz ihn auf \`ausgeblendet\` ` +
    `mit einem kurzen Grund für Kevin.\n\n` +
    `Antworte am Ende mit genau einem Block:\n\n` +
    '```json\n{"entwuerfe":[{"profil_key":"…","nachricht":"…"}],"ausgeblendet":[{"profil_key":"…","grund":"…"}]}\n```\n\n' +
    `Personen (JSON):\n\`\`\`json\n${JSON.stringify(personen, null, 2)}\n\`\`\``
  )
}

// ---------------------------------------------------------------------------
// Datenbank
// ---------------------------------------------------------------------------

const STAPEL = 200

async function hole(ctx, pfad) {
  const res = await fetch(`${ctx.supabaseUrl}/rest/v1/${pfad}`, { headers: ctx.headers })
  if (!res.ok) throw new Error(`GET ${pfad.split('?')[0]} HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`)
  return res.json()
}

async function patch(ctx, pfad, body) {
  const res = await fetch(`${ctx.supabaseUrl}/rest/v1/${pfad}`, {
    method: 'PATCH',
    headers: { ...ctx.headers, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`PATCH ${pfad.split('?')[0]} HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`)
}

/**
 * Die gelesene Eingangsliste wegschreiben.
 *
 * Nur gesetzt, was diese Liste weiß: Notiz und Datum fehlen oft und dürfen
 * dann einen früher gelesenen Wert nicht mit Leerem überschreiben — deshalb
 * fliegen die Schlüssel raus, und wie in `netzwerkUpsert.mjs` wird nach
 * Spalten-Form gruppiert (PostgREST verlangt gleiche Schlüssel je Request).
 *
 * Status, Text und Kevins Haken fasst der Lauf nie an.
 */
export async function upsertAnfragen(liste, ctx, { jetzt = new Date() } = {}) {
  const stempel = jetzt.toISOString()
  const zeilen = liste.eintraege.map((e) => {
    const z = anfrageZielgruppe(e.headline, e.name)
    return {
      brand_id: ctx.brandId,
      profil_key: e.profilKey,
      name: e.name,
      headline: e.headline ?? '',
      profile_url: e.profileUrl ?? '',
      gemeinsame: e.gemeinsame ?? '',
      icp_urteil: z.urteil,
      icp_grund: z.grund,
      zuletzt_gesehen_at: stempel,
      nicht_mehr_da_at: null,
      ...(e.notiz ? { notiz: e.notiz } : {}),
      ...(e.eingegangenAt ? { eingegangen_at: e.eingegangenAt } : {}),
      ...(z.ausgeblendet ? { ausgeblendet_grund: z.ausgeblendet } : {}),
    }
  })

  const nachForm = new Map()
  for (const z of zeilen) {
    const form = Object.keys(z).sort().join(',')
    if (!nachForm.has(form)) nachForm.set(form, [])
    nachForm.get(form).push(z)
  }
  let geschrieben = 0
  for (const gruppe of nachForm.values()) {
    for (let i = 0; i < gruppe.length; i += STAPEL) {
      const teil = gruppe.slice(i, i + STAPEL)
      const res = await fetch(`${ctx.supabaseUrl}/rest/v1/linkedin_anfragen?on_conflict=brand_id,profil_key`, {
        method: 'POST',
        headers: { ...ctx.headers, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(teil),
      })
      if (!res.ok) throw new Error(`POST linkedin_anfragen HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}`)
      geschrieben += teil.length
    }
  }

  /**
   * Nicht mehr auf der Liste — nur nach einem VOLLSTÄNDIGEN Lauf (dieselbe
   * Regel wie bei den gesendeten Einladungen, Vorfall vom 12.08.). Heißt:
   * Kevin hat auf LinkedIn angenommen oder ignoriert. Was davon, sagt die
   * Kontaktliste; die Oberfläche liest beides zusammen.
   */
  let nichtMehrDa = 0
  if (liste.vollstaendig) {
    const res = await fetch(
      `${ctx.supabaseUrl}/rest/v1/linkedin_anfragen?brand_id=eq.${ctx.brandId}&status=eq.offen` +
        `&nicht_mehr_da_at=is.null&zuletzt_gesehen_at=lt.${encodeURIComponent(stempel)}&select=profil_key`,
      {
        method: 'PATCH',
        headers: { ...ctx.headers, 'Content-Type': 'application/json', Prefer: 'return=representation' },
        body: JSON.stringify({ nicht_mehr_da_at: stempel }),
      },
    )
    if (res.ok) nichtMehrDa = (await res.json()).length
  }

  return {
    geschrieben,
    zielgruppe: zeilen.filter((z) => !z.ausgeblendet_grund).length,
    ausgeblendet: zeilen.filter((z) => z.ausgeblendet_grund).length,
    nichtMehrDa,
    vollstaendig: liste.vollstaendig === true,
  }
}

/**
 * Wer braucht noch einen Text?
 *
 * Offen, Zielgruppe, ohne Text, unter dem Versuchs-Deckel — und entweder noch
 * auf der Eingangsliste oder schon angenommen. Wer von der Liste
 * verschwunden ist, ohne Kontakt zu sein, wurde ignoriert; für den wird
 * nichts mehr bezahlt.
 */
export async function anfragenFuerEntwurf(ctx, limit = ANFRAGEN_JE_LAUF) {
  const zeilen = await hole(
    ctx,
    `linkedin_anfragen?brand_id=eq.${ctx.brandId}&status=eq.offen&entwurf=is.null&ausgeblendet_grund=is.null` +
      `&icp_urteil=neq.off&entwurf_versuche=lt.${ANFRAGEN_MAX_VERSUCHE}` +
      `&select=id,profil_key,name,headline,profile_url,notiz,gemeinsame,nicht_mehr_da_at,entwurf_versuche,eingegangen_at` +
      `&order=eingegangen_at.desc&limit=${Math.max(limit * 3, 20)}`,
  )
  const weg = zeilen.filter((z) => z.nicht_mehr_da_at)
  let angenommen = new Set()
  if (weg.length) {
    const keys = weg.map((z) => `"${String(z.profil_key).replace(/"/g, '')}"`).join(',')
    const netz = await hole(
      ctx,
      `linkedin_netzwerk?brand_id=eq.${ctx.brandId}&status=eq.angenommen&profil_key=in.(${encodeURIComponent(keys)})&select=profil_key`,
    ).catch(() => [])
    angenommen = new Set(netz.map((n) => n.profil_key))
  }
  return zeilen.filter((z) => !z.nicht_mehr_da_at || angenommen.has(z.profil_key)).slice(0, limit)
}

// ---------------------------------------------------------------------------
// Der Schreib-Lauf
// ---------------------------------------------------------------------------

/** Ein `claude -p`-Lauf ohne Werkzeuge. Wirft nie. */
function schreibLauf(prompt, { cliPath, cwd, budget, signal }) {
  return new Promise((fertig) => {
    const proc = spawn(
      process.env.CLAUDE_BIN ?? 'claude',
      ['-p', prompt, '--output-format', 'json', '--model', MODELL, '--effort', 'high', '--allowedTools', 'Read', '--max-budget-usd', String(budget), '--setting-sources', 'project'],
      { cwd, env: { ...process.env, PATH: cliPath }, stdio: ['ignore', 'pipe', 'pipe'] },
    )
    let aus = ''
    proc.stdout.on('data', (c) => (aus += c))
    proc.stderr.on('data', () => {})
    const stopp = () => proc.kill('SIGKILL')
    signal?.addEventListener('abort', stopp, { once: true })
    const uhr = setTimeout(stopp, LAUF_TIMEOUT_MS)
    const ende = (wert) => {
      clearTimeout(uhr)
      signal?.removeEventListener('abort', stopp)
      fertig(wert)
    }
    proc.on('error', () => ende({ text: '', kosten: 0 }))
    proc.on('close', () => {
      try {
        const h = JSON.parse(aus)
        ende({ text: String(h?.result ?? ''), kosten: Number(h?.total_cost_usd ?? 0) })
      } catch {
        ende({ text: '', kosten: 0 })
      }
    })
  })
}

/**
 * Texte für wartende Anfragen vorbereiten.
 *
 * `rechercheLeads` wird hereingereicht (statt importiert), damit dieser
 * Schritt ohne Browser prüfbar bleibt und der Runner genau DIESELBE Recherche
 * benutzt wie für die Erstnachrichten.
 */
export async function bereiteAnfragenVor(ctx, { rechercheLeads, cliPath, cwd, signal, melde = () => {} }) {
  const offen = await anfragenFuerEntwurf(ctx)
  if (!offen.length) return { geschrieben: 0, ausgeblendet: 0, ohneText: 0, kosten: 0, versucht: 0 }

  melde(`${offen.length} ${offen.length === 1 ? 'Anfrage wird' : 'Anfragen werden'} recherchiert`)
  let kosten = 0
  let leads = offen.map((z) => ({ ...z }))
  try {
    const r = await rechercheLeads(
      offen.map((z) => ({ profil_key: z.profil_key, name: z.name, headline: z.headline, profile_url: z.profile_url })),
      { melde: (t) => melde(`Anfragen: ${t}`), cliPath, cwd, signal },
    )
    kosten += r.kosten ?? 0
    const nachKey = new Map(r.leads.map((l) => [l.profil_key, l.recherche ?? null]))
    leads = leads.map((z) => ({ ...z, recherche: nachKey.get(z.profil_key) ?? null }))
  } catch (e) {
    // Ohne Recherche wird trotzdem geschrieben — nur ohne Website-Bezug. Wer
    // Kevin anfragt, wartet nicht auf einen zweiten Recherche-Versuch.
    console.error('[anfragen] Recherche fehlgeschlagen:', e?.message ?? e)
  }
  if (signal?.aborted) return { geschrieben: 0, ausgeblendet: 0, ohneText: offen.length, kosten, versucht: offen.length }

  let stimme = ''
  try {
    stimme = readFileSync(STIMME_PFAD, 'utf8')
  } catch (e) {
    throw new Error(`Kevins Stimme nicht lesbar (${STIMME_PFAD}): ${e?.message ?? e}`)
  }
  melde(`${leads.length} ${leads.length === 1 ? 'Text wird' : 'Texte werden'} geschrieben`)
  const lauf = await schreibLauf(baueAnfragenPrompt(leads.map(fuerSchreiber), stimme), {
    cliPath,
    cwd,
    budget: 1 + 0.4 * leads.length,
    signal,
  })
  kosten += lauf.kosten
  const antwort = parseAnfrageAntwort(lauf.text, leads.map((l) => l.profil_key))
  const jetzt = new Date().toISOString()
  const nachKey = new Map(leads.map((l) => [l.profil_key, l]))
  let geschrieben = 0
  let ausgeblendet = 0
  const erledigt = new Set()

  for (const e of antwort?.entwuerfe ?? []) {
    const l = nachKey.get(e.profil_key)
    const r = l?.recherche
    await patch(ctx, `linkedin_anfragen?id=eq.${l.id}`, {
      entwurf: e.nachricht,
      entwurf_at: jetzt,
      entwurf_versuche: (l.entwurf_versuche ?? 0) + 1,
      ...(r?.firma ? { firma: String(r.firma) } : {}),
      ...(r?.website && r?.sicher ? { website: String(r.website) } : {}),
      ...(r ? { recherche: fuerSchreiber(l).recherche } : {}),
    })
    erledigt.add(e.profil_key)
    geschrieben++
  }
  for (const a of antwort?.ausgeblendet ?? []) {
    const l = nachKey.get(a.profil_key)
    await patch(ctx, `linkedin_anfragen?id=eq.${l.id}`, {
      ausgeblendet_grund: a.grund,
      entwurf_versuche: (l.entwurf_versuche ?? 0) + 1,
      ...(l.recherche?.firma ? { firma: String(l.recherche.firma) } : {}),
    })
    erledigt.add(a.profil_key)
    ausgeblendet++
  }
  // Wer keinen Text bekam, zählt einen Versuch hoch — nach drei bleibt er ohne Text stehen.
  const ohne = leads.filter((l) => !erledigt.has(l.profil_key))
  for (const l of ohne) {
    await patch(ctx, `linkedin_anfragen?id=eq.${l.id}`, { entwurf_versuche: (l.entwurf_versuche ?? 0) + 1 }).catch(() => {})
  }
  if (!antwort) console.error('[anfragen] Schreib-Lauf ohne verwertbaren json-Block')
  return { geschrieben, ausgeblendet, ohneText: ohne.length, kosten, versucht: leads.length }
}
