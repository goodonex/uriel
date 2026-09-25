/**
 * Das Token-Buch (24.09.2026): wer auf diesem Rechner wie viele Tokens
 * verbraucht hat — je Projekt, je Phase, je Tag.
 *
 * **Warum die Sitzungsprotokolle und nicht die Run-Dateien.** Ein gelungener
 * Lauf schreibt in `System/Runs` nur seinen Endtext, keine Kosten (die
 * Freigaben-Queue liest dieses Format, es bleibt so). Die Claude-CLI legt aber
 * JEDE Sitzung ohnehin unter `~/.claude/projects/<ordner>/<id>.jsonl` ab — die
 * `claude -p`-Läufe des Runners genauso wie Kevins Sitzungen in der
 * Desktop-App. Jede Antwort trägt dort ihre `usage`. Damit gibt es die Zahlen
 * auch rückwirkend, ohne dass ein Lauf etwas mitschreiben muss.
 *
 * **Zuordnung.** Jede Zeile trägt ihr eigenes `cwd` — eine Sitzung, die im
 * Scratch-Ordner beginnt und dann ins Projekt wechselt, wird ab dem Wechsel
 * dem Projekt gutgeschrieben. Aufträge an den Mini laufen im Sammelordner
 * `02 Projekte`; für sie steht das Projekt im Titel des Auftrags
 * (`"titel": "laplace A12"` im Eingabeblock des Prompts), und das zweite Wort
 * ist die Phase, wenn es wie eine aussieht.
 *
 * **Wofür (25.09.2026).** Jede Antwort bekommt eine Art:
 * - `bauen` — Kevins Sitzungen in einem Programm-Ordner (einer mit
 *   `package.json`) und die Mini-Aufträge, die ein Programm weiterbauen.
 * - `betrieb` — was ein Programm von selbst verbraucht: nicht-interaktive
 *   `claude -p`-Läufe ohne Auftragstitel. Liegen sie in einem Programm-Ordner
 *   (jophiel, gabriel), gehören sie dem; alles andere startet Uriels Runner
 *   (Routinen im Vault, in `Herrmann & Co`) und gehört Uriel.
 * - `arbeit` — Kevins Sitzungen außerhalb der Programme: Vault, Kundenordner.
 *
 * **Inkrementell.** Beim ersten Durchgang liest es alle Protokolle der
 * letzten Tage einmal ganz (hunderte MB), danach je Datei nur das, was seit
 * dem letzten Mal angehängt wurde.
 */
import { createReadStream } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { hostname } from 'node:os'
import { join, sep } from 'node:path'

/** Nur Sitzungen, die in diesem Fenster noch geschrieben wurden (30 Tage Nutzung + Puffer). */
export const FENSTER_TAGE = 31

/** Sammelzeile für Sitzungen, die zu keinem Projektordner gehören (Vault, Scratch). */
export const OHNE_PROJEKT = 'Vault & Sonstiges'

/** Preise je 1 Mio. Tokens (Eingabe, Ausgabe). Unbekanntes Modell → kein Dollarwert. */
const PREISE = [
  [/fable/i, 10, 50],
  [/opus/i, 5, 25],
  [/sonnet/i, 3, 15],
  [/haiku/i, 1, 5],
]

/** Phasen-Kennung wie `A12`, `K3`, `W1`, `S2b`. */
const PHASE_ID = /^[A-Z]{1,3}\d{1,3}[a-z]?$/

export function neuesBuch() {
  return {
    /** Datei → Lesestand. */
    dateien: new Map(),
    /** Sitzung → Auftragstitel (aus dem ersten Prompt), für Subagenten-Dateien. */
    titel: new Map(),
    /** Sitzung → entrypoint, für Subagenten-Dateien ohne eigenen. */
    einstieg: new Map(),
    /** `projekt|phase|tag|art` → Summen. */
    posten: new Map(),
    /** Stunde (`2026-09-25T10`) → Summe über alles. Für „seit Wochenstart" in der Plan-Rechnung. */
    stunden: new Map(),
    /** Bereits gezählte Antworten (Streaming wiederholt dieselbe id). */
    gezaehlt: new Set(),
  }
}

/** Dollarwert einer Antwort nach Listenpreis. Null, wenn das Modell unbekannt ist. */
export function preisUsd(modell, u) {
  const p = PREISE.find(([re]) => re.test(String(modell ?? '')))
  if (!p) return null
  const [, ein, aus] = p
  const cw1h = Number(u?.cache_creation?.ephemeral_1h_input_tokens ?? 0)
  const cwGesamt = Number(u?.cache_creation_input_tokens ?? 0)
  const cw5m = Math.max(0, cwGesamt - cw1h)
  const summe =
    Number(u?.input_tokens ?? 0) * ein +
    Number(u?.output_tokens ?? 0) * aus +
    Number(u?.cache_read_input_tokens ?? 0) * ein * 0.1 +
    cw5m * ein * 1.25 +
    cw1h * ein * 2
  return summe / 1e6
}

/**
 * Titel eines Mini-Auftrags aus dem Prompt. Der Runner hängt die Eingabe als
 * JSON-Block an — dort steht `"titel": "…"`.
 */
export function titelAusPrompt(text) {
  const m = String(text ?? '').match(/"titel"\s*:\s*"([^"\n]{1,120})"/)
  return m ? m[1].trim() : null
}

/** „laplace A12" → { projekt: 'laplace', phase: 'A12' }, gegen die bekannten Ordner geprüft. */
export function titelZerlegen(titel, projekte) {
  if (!titel) return { projekt: null, phase: null }
  const worte = titel.split(/[\s:]+/).filter(Boolean)
  const erstes = (worte[0] ?? '').toLowerCase()
  const projekt = projekte.find((p) => p.toLowerCase() === erstes) ?? null
  const phase = worte.slice(1).find((w) => PHASE_ID.test(w)) ?? null
  return { projekt, phase }
}

/**
 * Zu welchem Projekt gehört eine Zeile? Der erste Ordner unter `02 Projekte`
 * — auch aus einem Worktree (`uriel/.claude/worktrees/…` bleibt `uriel`).
 * Im Sammelordner selbst oder anderswo entscheidet der Auftragstitel.
 */
export function projektAusCwd(cwd, projekteWurzel) {
  const c = String(cwd ?? '')
  if (!c.startsWith(projekteWurzel + sep)) return null
  const rest = c.slice(projekteWurzel.length + 1)
  return rest.split(sep)[0] || null
}

/**
 * Projekt, Phase und Art einer Antwort. `kontext.programme` sind die Ordner
 * mit Code (`package.json`); `einstieg` ist der `entrypoint` der Sitzung —
 * `sdk-…` heißt nicht-interaktiv (`claude -p`), alles andere hat Kevin getippt.
 */
export function zuordnen({ cwd, titel, einstieg }, kontext) {
  const programme = kontext.programme ?? new Set()
  const ausCwd = projektAusCwd(cwd, kontext.projekteWurzel)
  const ausTitel = titelZerlegen(titel, kontext.projekte ?? [])
  if (ausTitel.projekt) {
    const projekt = ausCwd ?? ausTitel.projekt
    // Die Phase gilt nur, wenn der Titel zum selben Projekt gehört.
    return { projekt, phase: ausTitel.projekt === projekt ? ausTitel.phase : null, art: 'bauen' }
  }
  const interaktiv = !/^sdk/.test(String(einstieg ?? ''))
  if (interaktiv) {
    const projekt = ausCwd ?? OHNE_PROJEKT
    return { projekt, phase: null, art: programme.has(projekt) ? 'bauen' : 'arbeit' }
  }
  return { projekt: ausCwd && programme.has(ausCwd) ? ausCwd : 'uriel', phase: null, art: 'betrieb' }
}

/**
 * Die Nutzung der letzten `tage` Tage je Projekt, getrennt nach Art.
 * `rechner` sagt, woher die Zahlen stammen — der Laptop meldet seine eigenen.
 */
export function nutzung(buch, { tage = 30, jetzt = Date.now(), rechner = null, programme = new Set() } = {}) {
  const ab = new Date(jetzt - (tage - 1) * 86_400_000).toISOString().slice(0, 10)
  const leer = () => ({ tokens: 0, usd: 0 })
  const zeilen = new Map()
  for (const p of buch.posten.values()) {
    if (p.tag < ab) continue
    const z = zeilen.get(p.projekt) ?? {
      projekt: p.projekt,
      programm: programme.has(p.projekt) || p.projekt === 'uriel',
      bauen: leer(),
      betrieb: leer(),
      arbeit: leer(),
      letzte: null,
    }
    const art = z[p.art] ? p.art : 'arbeit'
    z[art].tokens += tokensVon(p)
    z[art].usd += p.usd
    if (p.letzte && (!z.letzte || p.letzte > z.letzte)) z.letzte = p.letzte
    zeilen.set(p.projekt, z)
  }
  const runde = (w) => ({ tokens: w.tokens, usd: Math.round(w.usd * 100) / 100 })
  const liste = [...zeilen.values()]
    .map((z) => ({ ...z, bauen: runde(z.bauen), betrieb: runde(z.betrieb), arbeit: runde(z.arbeit) }))
    .sort((a, b) => b.bauen.tokens + b.betrieb.tokens + b.arbeit.tokens - (a.bauen.tokens + a.betrieb.tokens + a.arbeit.tokens))
  // Stunden der letzten acht Tage: genug, um jeden Wochenstart abzudecken.
  const abStunde = new Date(jetzt - 8 * 86_400_000).toISOString().slice(0, 13)
  const stunden = [...buch.stunden.values()]
    .filter((s) => s.h >= abStunde)
    .sort((a, b) => a.h.localeCompare(b.h))
    .map((s) => ({ h: s.h, tokens: s.tokens, usd: Math.round(s.usd * 100) / 100 }))
  return { rechner, tage, ab, projekte: liste, stunden }
}

function tagVon(iso) {
  return typeof iso === 'string' && iso.length >= 10 ? iso.slice(0, 10) : 'unbekannt'
}

function textAus(content) {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .filter((t) => t && t.type === 'text')
      .map((t) => t.text ?? '')
      .join('\n')
  }
  return ''
}

/**
 * Eine Zeile verbuchen. `datei` trägt den Sitzungs-Zustand (erster Prompt,
 * Titel); `kontext` die Wurzel und die bekannten Projekte.
 */
export function nimmZeile(buch, datei, zeile, kontext) {
  if (!zeile || zeile[0] !== '{') return
  let d
  try {
    d = JSON.parse(zeile)
  } catch {
    return
  }
  if (d.sessionId && !datei.sitzung) datei.sitzung = d.sessionId

  // Der erste echte Prompt verrät bei Mini-Aufträgen Projekt und Phase.
  if (d.type === 'user' && !datei.titelGeprueft && d.message && !d.isMeta) {
    const text = textAus(d.message.content)
    if (text.trim() && !text.startsWith('<')) {
      datei.titelGeprueft = true
      const t = titelAusPrompt(text.slice(0, 200_000))
      if (t) {
        datei.titel = t
        if (datei.sitzung) buch.titel.set(datei.sitzung, t)
      }
    }
  }

  if (d.type !== 'assistant' || !d.message?.usage) return
  const msgId = d.message.id ?? d.uuid
  if (msgId) {
    if (buch.gezaehlt.has(msgId)) return
    buch.gezaehlt.add(msgId)
  }
  const u = d.message.usage
  const titel = datei.titel ?? (d.sessionId ? buch.titel.get(d.sessionId) : null) ?? null
  if (d.entrypoint && !datei.einstieg) {
    datei.einstieg = d.entrypoint
    if (d.sessionId) buch.einstieg.set(d.sessionId, d.entrypoint)
  }
  const einstieg = d.entrypoint ?? datei.einstieg ?? (d.sessionId ? buch.einstieg.get(d.sessionId) : null) ?? ''
  const { projekt, phase, art } = zuordnen({ cwd: d.cwd, titel, einstieg }, kontext)
  const tag = tagVon(d.timestamp)
  const schluessel = `${projekt}|${phase ?? ''}|${tag}|${art}`
  const p =
    buch.posten.get(schluessel) ??
    { projekt, phase, tag, art, ein: 0, aus: 0, cacheSchreiben: 0, cacheLesen: 0, usd: 0, letzte: null }
  p.ein += Number(u.input_tokens ?? 0)
  p.aus += Number(u.output_tokens ?? 0)
  p.cacheSchreiben += Number(u.cache_creation_input_tokens ?? 0)
  p.cacheLesen += Number(u.cache_read_input_tokens ?? 0)
  p.usd += preisUsd(d.message.model, u) ?? 0
  if (typeof d.timestamp === 'string' && (!p.letzte || d.timestamp > p.letzte)) p.letzte = d.timestamp
  buch.posten.set(schluessel, p)
  if (typeof d.timestamp === 'string' && d.timestamp.length >= 13) {
    const h = d.timestamp.slice(0, 13)
    const st = buch.stunden.get(h) ?? { h, tokens: 0, usd: 0 }
    st.tokens += Number(u.input_tokens ?? 0) + Number(u.output_tokens ?? 0) + Number(u.cache_creation_input_tokens ?? 0) + Number(u.cache_read_input_tokens ?? 0)
    st.usd += preisUsd(d.message.model, u) ?? 0
    buch.stunden.set(h, st)
  }
}

/** Alle Tokens eines Postens — Eingabe, Ausgabe und beide Cache-Arten. */
export function tokensVon(p) {
  return p.ein + p.aus + p.cacheSchreiben + p.cacheLesen
}

/** „Air.local" → „Air". Schlüssel des Nutzungs-Spiegels je Rechner. */
export function rechnerName() {
  return (process.env.RECHNER_NAME || hostname().split('.')[0] || 'rechner').replace(/[^\w-]/g, '_')
}

/** Projektordner unter `02 Projekte` und welche davon Programme sind (mit `package.json`). */
export async function projektOrdner(projekteWurzel) {
  let namen = []
  try {
    namen = (await readdir(projekteWurzel, { withFileTypes: true }))
      .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
      .map((e) => e.name)
  } catch {
    /* ohne Projektordner bleibt nur die cwd-Zuordnung */
  }
  const programme = new Set()
  for (const n of namen) {
    try {
      await stat(join(projekteWurzel, n, 'package.json'))
      programme.add(n)
    } catch {
      /* kein Programm */
    }
  }
  return { projekte: namen, programme }
}

async function sammleDateien(wurzel, tiefe = 0, aus = []) {
  let eintraege
  try {
    eintraege = await readdir(wurzel, { withFileTypes: true })
  } catch {
    return aus
  }
  for (const e of eintraege) {
    const p = join(wurzel, e.name)
    if (e.isDirectory() && tiefe < 3 && e.name !== 'memory') await sammleDateien(p, tiefe + 1, aus)
    else if (e.isFile() && e.name.endsWith('.jsonl')) aus.push(p)
  }
  return aus
}

function leseAb(pfad, start, datei, buch, kontext) {
  return new Promise((fertig) => {
    let rest = datei.rest ?? ''
    let gelesen = 0
    const s = createReadStream(pfad, { start, encoding: 'utf8' })
    s.on('data', (brocken) => {
      gelesen += Buffer.byteLength(brocken, 'utf8')
      const teile = (rest + brocken).split('\n')
      rest = teile.pop() ?? ''
      for (const z of teile) nimmZeile(buch, datei, z, kontext)
    })
    s.on('error', () => fertig(0))
    s.on('close', () => {
      datei.rest = rest.length > 5_000_000 ? '' : rest
      fertig(gelesen)
    })
  })
}

/**
 * Bringt das Buch auf den Stand der Platte. Nur geänderte Dateien werden
 * gelesen, und von denen nur der neue Teil.
 */
export async function aktualisiereBuch(buch, { protokollWurzel, projekteWurzel, projekte, programme = new Set(), jetzt = Date.now() }) {
  const kontext = { projekteWurzel, projekte, programme }
  const grenze = jetzt - FENSTER_TAGE * 86_400_000
  const dateien = await sammleDateien(protokollWurzel)
  // Hauptsitzungen vor Subagenten: deren Titel kommt aus der Hauptsitzung.
  dateien.sort((a, b) => a.split(sep).length - b.split(sep).length)
  for (const pfad of dateien) {
    let st
    try {
      st = await stat(pfad)
    } catch {
      continue
    }
    if (st.mtimeMs < grenze) continue
    const datei = buch.dateien.get(pfad) ?? { offset: 0, rest: '', titel: null, titelGeprueft: false, sitzung: null, einstieg: null }
    if (st.size < datei.offset) {
      // Datei wurde ersetzt — von vorn. Bereits gezählte Antworten bleiben
      // über `gezaehlt` ausgeschlossen.
      datei.offset = 0
      datei.rest = ''
    }
    if (st.size > datei.offset) {
      datei.offset += await leseAb(pfad, datei.offset, datei, buch, kontext)
    }
    buch.dateien.set(pfad, datei)
  }
  return buch
}
