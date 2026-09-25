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
 * **Inkrementell.** Beim ersten Durchgang liest es alle Protokolle der
 * letzten Tage einmal ganz (hunderte MB), danach je Datei nur das, was seit
 * dem letzten Mal angehängt wurde.
 */
import { createReadStream } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { join, sep } from 'node:path'

/** Nur Sitzungen, die in diesem Fenster noch geschrieben wurden. */
export const FENSTER_TAGE = 21

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
    /** `projekt|phase|tag` → Summen. */
    posten: new Map(),
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
  const ausTitel = titelZerlegen(titel, kontext.projekte)
  const projekt = projektAusCwd(d.cwd, kontext.projekteWurzel) ?? ausTitel.projekt ?? null
  if (!projekt) return
  // Die Phase gilt nur, wenn der Titel zum selben Projekt gehört.
  const phase = ausTitel.projekt === projekt ? ausTitel.phase : null
  const tag = tagVon(d.timestamp)
  const schluessel = `${projekt}|${phase ?? ''}|${tag}`
  const p =
    buch.posten.get(schluessel) ??
    { projekt, phase, tag, ein: 0, aus: 0, cacheSchreiben: 0, cacheLesen: 0, usd: 0, letzte: null }
  p.ein += Number(u.input_tokens ?? 0)
  p.aus += Number(u.output_tokens ?? 0)
  p.cacheSchreiben += Number(u.cache_creation_input_tokens ?? 0)
  p.cacheLesen += Number(u.cache_read_input_tokens ?? 0)
  p.usd += preisUsd(d.message.model, u) ?? 0
  if (typeof d.timestamp === 'string' && (!p.letzte || d.timestamp > p.letzte)) p.letzte = d.timestamp
  buch.posten.set(schluessel, p)
}

/** Alle Tokens eines Postens — Eingabe, Ausgabe und beide Cache-Arten. */
export function tokensVon(p) {
  return p.ein + p.aus + p.cacheSchreiben + p.cacheLesen
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
export async function aktualisiereBuch(buch, { protokollWurzel, projekteWurzel, projekte, jetzt = Date.now() }) {
  const kontext = { projekteWurzel, projekte }
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
    const datei = buch.dateien.get(pfad) ?? { offset: 0, rest: '', titel: null, titelGeprueft: false, sitzung: null }
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
