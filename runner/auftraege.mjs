/**
 * Aufträge auf dem Mini (24.09.2026): was läuft, wie weit ist es, was kommt
 * noch, und was kostet es an Tokens.
 *
 * Kevins Satz dazu: wenn laplace seit gestern mit fünf Phasen läuft, will er
 * sehen, dass Phase 3 bei 46 % steht, 1 und 2 durch sind, 4 und 5 noch
 * kommen — und daneben, wie viele Tokens verbraucht sind von denen, die
 * geplant sind. Und was seit Tagen brach liegt.
 *
 * **Woher die Phasen kommen, in dieser Reihenfolge:**
 * 1. `FORTSCHRITT.json` im Projektordner — die genaue Quelle. Ein Auftrag
 *    schreibt dort seine Phasen und den Stand der laufenden hinein.
 * 2. `STAND.md` mit Phasen als Checkliste (`- [x] **K1 …**`), wie laplace sie
 *    führt. Abschnitte je Kette (`# KETTE 4 …`), Schluss mit `KETTE 4: FERTIG`.
 *
 * **Prozent der laufenden Phase:** aus der Datei, wenn sie es sagt; sonst aus
 * eingerückten Unterpunkten; sonst geschätzt aus den Tokens, die die Phase
 * schon verbraucht hat, gegen den Schnitt der fertigen Phasen derselben Kette
 * — dann steht „geschätzt" daneben, und es geht nie über 95 %.
 *
 * Reine Funktionen bis auf `sammleAuftraege` — geprüft per
 * `npx tsx scripts/verify-auftraege.ts`.
 */
import { existsSync } from 'node:fs'
import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { tokensVon } from './tokenBuch.mjs'

/** So lange nach der letzten Antwort gilt ein Auftrag als laufend. */
export const LAEUFT_MIN = 15
/** Ab hier liegt ein offener Auftrag brach. */
export const BRACH_STUNDEN = 24
/** Fertige Aufträge bleiben so lange sichtbar. */
export const FERTIG_SICHTBAR_TAGE = 3

const PHASE_ZEILE = /^- \[( |x|X)\]\s+(?:\*\*)?([A-Z]{1,3}\d{1,3}[a-z]?)\b[.:]?\s*(.*)$/
const UNTERPUNKT = /^\s{2,}- \[( |x|X)\]/
const SCHLUSS = /^KETTE(?: \d+)?: FERTIG\s*$/

function phasenTitel(rest) {
  let t = rest
  const zu = t.indexOf('**')
  if (zu >= 0) t = t.slice(0, zu)
  t = t.replace(/\s+[—–-]\s.*$/, '').replace(/[✅]/g, '').trim()
  return t.replace(/[.:]$/, '').trim()
}

/**
 * `STAND.md` in Abschnitte (eine Überschrift erster Ebene je Kette) mit ihren
 * Phasen zerlegen.
 */
export function parseStand(text) {
  const abschnitte = []
  const neu = (titel) => ({ titel, fertig: false, phasen: [], ausPhasenTeil: [], sonst: [] })
  let akt = neu('')
  let phase = null
  // Steht eine Überschrift „## Phasen …" im Abschnitt, zählen nur Checklisten
  // darunter — „## Was Kevin selbst tun muss" ist auch eine Checkliste.
  let imPhasenTeil = false
  const abschliessen = () => {
    akt.phasen = akt.ausPhasenTeil.length ? akt.ausPhasenTeil : akt.sonst
    const { ausPhasenTeil: _a, sonst: _s, ...rest } = akt
    abschnitte.push(rest)
  }
  for (const zeile of String(text ?? '').split('\n')) {
    if (/^# /.test(zeile)) {
      abschliessen()
      akt = neu(zeile.slice(2).trim())
      phase = null
      imPhasenTeil = false
      continue
    }
    if (/^## /.test(zeile)) {
      imPhasenTeil = /phasen/i.test(zeile)
      phase = null
      continue
    }
    if (SCHLUSS.test(zeile)) akt.fertig = true
    const m = zeile.match(PHASE_ZEILE)
    if (m) {
      phase = { id: m[2], titel: phasenTitel(m[3]), erledigt: m[1] !== ' ', unter: { erledigt: 0, gesamt: 0 } }
      ;(imPhasenTeil ? akt.ausPhasenTeil : akt.sonst).push(phase)
      continue
    }
    if (phase && UNTERPUNKT.test(zeile)) {
      phase.unter.gesamt += 1
      if (!/\[ \]/.test(zeile)) phase.unter.erledigt += 1
    }
  }
  abschliessen()
  return abschnitte.filter((a) => a.phasen.length > 0)
}

/** Der Abschnitt, an dem gerade gearbeitet wird — sonst der oberste. */
export function aktiverAbschnitt(abschnitte) {
  return abschnitte.find((a) => !a.fertig && a.phasen.some((p) => !p.erledigt)) ?? abschnitte[0] ?? null
}

/** „KETTE 4 (ab 2026-09-20) — vom …" → Startdatum. */
export function startAusTitel(titel) {
  const m = String(titel ?? '').match(/(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : null
}

/**
 * `FORTSCHRITT.json` lesen. Erlaubt ist ein Auftrag (`{ titel, phasen }`)
 * oder mehrere (`{ auftraege: [...] }`).
 */
export function parseFortschritt(roh) {
  const liste = Array.isArray(roh?.auftraege) ? roh.auftraege : roh?.phasen ? [roh] : []
  return liste
    .filter((a) => Array.isArray(a?.phasen) && a.phasen.length)
    .map((a) => ({
      titel: String(a.titel ?? 'Auftrag'),
      gestartet: typeof a.gestartet === 'string' ? a.gestartet.slice(0, 10) : null,
      budgetTokens: Number.isFinite(Number(a.budgetTokens)) && Number(a.budgetTokens) > 0 ? Number(a.budgetTokens) : null,
      notiz: typeof a.notiz === 'string' ? a.notiz : null,
      fertig: a.status === 'fertig',
      phasen: a.phasen.map((p, i) => {
        const status = ['fertig', 'laeuft', 'offen', 'fehler'].includes(p?.status) ? p.status : 'offen'
        const prozent = Number(p?.prozent)
        return {
          id: String(p?.id ?? `P${i + 1}`),
          titel: String(p?.titel ?? ''),
          erledigt: status === 'fertig',
          status,
          prozent: Number.isFinite(prozent) ? Math.max(0, Math.min(100, Math.round(prozent))) : null,
          schritt: typeof p?.schritt === 'string' ? p.schritt : null,
          unter: { erledigt: 0, gesamt: 0 },
        }
      }),
    }))
}

function mittel(zahlen) {
  return zahlen.length ? zahlen.reduce((a, b) => a + b, 0) / zahlen.length : null
}

/**
 * Aus Phasen + Token-Posten wird die Karte: Status je Phase, Prozent der
 * laufenden, Gesamtfortschritt, Verbrauch und Hochrechnung.
 *
 * `posten` sind die Token-Posten DIESES Projekts ab Kettenstart.
 */
export function bewerteAuftrag({ phasen, posten, budgetTokens = null, fertigMarke = false }) {
  const jePhase = new Map()
  let verbraucht = 0
  let usd = 0
  for (const p of posten) {
    const t = tokensVon(p)
    verbraucht += t
    usd += p.usd
    if (p.phase) jePhase.set(p.phase, (jePhase.get(p.phase) ?? 0) + t)
  }

  const fertigeTokens = phasen.filter((p) => p.erledigt).map((p) => jePhase.get(p.id) ?? 0).filter((t) => t > 0)
  const schnitt = mittel(fertigeTokens)
  const aktIndex = fertigMarke ? -1 : phasen.findIndex((p) => !p.erledigt)

  const karte = phasen.map((p, i) => {
    const tokens = jePhase.get(p.id) ?? 0
    if (p.erledigt) return { id: p.id, titel: p.titel, status: 'fertig', prozent: 100, geschaetzt: false, tokens, schritt: null }
    if (i !== aktIndex) {
      return { id: p.id, titel: p.titel, status: p.status === 'fehler' ? 'fehler' : 'offen', prozent: 0, geschaetzt: false, tokens, schritt: null }
    }
    let prozent = null
    let geschaetzt = false
    if (p.prozent != null) prozent = p.prozent
    else if (p.unter.gesamt > 0) prozent = Math.round((p.unter.erledigt / p.unter.gesamt) * 100)
    else if (schnitt && tokens > 0) {
      prozent = Math.min(95, Math.round((tokens / schnitt) * 100))
      geschaetzt = true
    }
    return {
      id: p.id,
      titel: p.titel,
      status: p.status === 'fehler' ? 'fehler' : 'laeuft',
      prozent,
      geschaetzt,
      tokens,
      schritt: p.schritt ?? null,
    }
  })

  const n = karte.length
  const fertigZahl = karte.filter((p) => p.status === 'fertig').length
  const akt = aktIndex >= 0 ? karte[aktIndex] : null
  const gesamtProzent = n ? Math.round(((fertigZahl + (akt?.prozent ?? 0) / 100) / n) * 100) : 0

  let geplant = null
  let geplantArt = null
  if (budgetTokens) {
    geplant = budgetTokens
    geplantArt = 'vorgabe'
  } else if (schnitt) {
    const offenNachAkt = karte.filter((p, i) => p.status !== 'fertig' && i !== aktIndex).length
    const restAkt = akt ? Math.max(0, schnitt - (akt.tokens ?? 0)) : 0
    geplant = Math.round(verbraucht + restAkt + offenNachAkt * schnitt)
    geplantArt = 'hochrechnung'
  }

  return {
    phasen: karte,
    aktuell: aktIndex >= 0 ? aktIndex : null,
    gesamtProzent: fertigMarke ? 100 : gesamtProzent,
    fertig: fertigMarke || (n > 0 && fertigZahl === n),
    tokens: { verbraucht, usd: Math.round(usd * 100) / 100, geplant, geplantArt, schnittJePhase: schnitt ? Math.round(schnitt) : null },
  }
}

/** Laufend, pausiert, brach, fertig oder vom Wächter gestoppt. */
export function zustandVon({ fertig, letzteAktivitaet, waechterBeendet = null, jetzt = Date.now() }) {
  if (fertig) return 'fertig'
  const t = letzteAktivitaet ? new Date(letzteAktivitaet).getTime() : null
  const alterMin = t == null ? Infinity : (jetzt - t) / 60_000
  if (alterMin <= LAEUFT_MIN) return 'laeuft'
  if (waechterBeendet) return 'gestoppt'
  if (alterMin >= BRACH_STUNDEN * 60) return 'brach'
  return 'pausiert'
}

/** Der Wächter einer Kette (laplace: `tools/kette-zustand.json` + Grenzen aus `tools/kette.mjs`). */
async function leseWaechter(ordner) {
  const zustandDatei = join(ordner, 'tools', 'kette-zustand.json')
  if (!existsSync(zustandDatei)) return null
  try {
    const z = JSON.parse(await readFile(zustandDatei, 'utf8'))
    const zaehler = Object.keys(z)
      .filter((k) => /^jobsKette\d+$/.test(k))
      .sort((a, b) => Number(b.slice(9)) - Number(a.slice(9)))[0]
    let maxJobs = null
    let stichtag = null
    try {
      const code = await readFile(join(ordner, 'tools', 'kette.mjs'), 'utf8')
      const m = code.match(/const MAX_JOBS = (\d+)/)
      if (m) maxJobs = Number(m[1])
      const s = code.match(/const ENDE_AM = new Date\('([^']+)'\)/)
      if (s) stichtag = s[1]
    } catch {
      /* Grenzen sind Zugabe */
    }
    return {
      jobs: zaehler ? Number(z[zaehler] ?? 0) : null,
      maxJobs,
      stichtag,
      beendet: z.beendet ?? null,
      fehlschlaege: Number(z.fehlschlaege ?? 0),
      ruheBis: z.ruheBis ?? null,
      letzterTitel: z.letzterTitel ?? null,
    }
  } catch {
    return null
  }
}

function spaetestes(...isos) {
  return isos.filter(Boolean).sort().pop() ?? null
}

/**
 * Alle Aufträge unter `02 Projekte` einsammeln. `buch` ist das Token-Buch
 * (`tokenBuch.mjs`), bereits aktualisiert.
 */
export async function sammleAuftraege({ projekteWurzel, buch, jetzt = Date.now() }) {
  let ordner = []
  try {
    ordner = (await readdir(projekteWurzel, { withFileTypes: true }))
      .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
      .map((e) => e.name)
  } catch {
    return { erzeugt: new Date(jetzt).toISOString(), auftraege: [], weitere: [] }
  }

  const postenJeProjekt = new Map()
  for (const p of buch.posten.values()) {
    const l = postenJeProjekt.get(p.projekt) ?? []
    l.push(p)
    postenJeProjekt.set(p.projekt, l)
  }

  const auftraege = []
  const mitAuftrag = new Set()

  for (const name of ordner) {
    const pfad = join(projekteWurzel, name)
    const quellen = []
    const fortschrittDatei = join(pfad, 'FORTSCHRITT.json')
    const standDatei = join(pfad, 'STAND.md')

    if (existsSync(fortschrittDatei)) {
      try {
        const st = await stat(fortschrittDatei)
        for (const a of parseFortschritt(JSON.parse(await readFile(fortschrittDatei, 'utf8')))) {
          quellen.push({ ...a, quelle: 'FORTSCHRITT.json', geaendert: st.mtime.toISOString() })
        }
      } catch (e) {
        console.error(`[auftraege] ${name}/FORTSCHRITT.json unlesbar:`, e?.message ?? e)
      }
    }
    if (!quellen.length && existsSync(standDatei)) {
      try {
        const st = await stat(standDatei)
        const a = aktiverAbschnitt(parseStand(await readFile(standDatei, 'utf8')))
        if (a) {
          quellen.push({
            titel: a.titel.replace(/\s*\(ab \d{4}-\d{2}-\d{2}\)/, ''),
            gestartet: startAusTitel(a.titel),
            budgetTokens: null,
            notiz: null,
            fertig: a.fertig,
            phasen: a.phasen.map((p) => ({ ...p, status: p.erledigt ? 'fertig' : 'offen', prozent: null, schritt: null })),
            quelle: 'STAND.md',
            geaendert: st.mtime.toISOString(),
          })
        }
      } catch (e) {
        console.error(`[auftraege] ${name}/STAND.md unlesbar:`, e?.message ?? e)
      }
    }
    if (!quellen.length) continue

    const waechter = await leseWaechter(pfad)
    const allePosten = postenJeProjekt.get(name) ?? []
    const eineQuelle = quellen.length === 1
    for (const q of quellen) {
      // Bei mehreren Aufträgen in einem Projekt lassen sich die Tokens nicht
      // sauber trennen — dann trägt nur der erste sie, statt sie doppelt zu zählen.
      const posten = eineQuelle || q === quellen[0] ? allePosten.filter((p) => !q.gestartet || p.tag >= q.gestartet) : []
      const bewertet = bewerteAuftrag({ phasen: q.phasen, posten, budgetTokens: q.budgetTokens, fertigMarke: q.fertig })
      const letzteToken = posten.map((p) => p.letzte).filter(Boolean).sort().pop() ?? null
      const letzteAktivitaet = spaetestes(letzteToken, q.geaendert)
      const zustand = zustandVon({
        fertig: bewertet.fertig,
        letzteAktivitaet,
        waechterBeendet: waechter && !bewertet.fertig ? waechter.beendet : null,
        jetzt,
      })
      if (zustand === 'fertig' && letzteAktivitaet && jetzt - new Date(letzteAktivitaet).getTime() > FERTIG_SICHTBAR_TAGE * 86_400_000) {
        continue
      }
      mitAuftrag.add(name)
      auftraege.push({
        projekt: name,
        titel: q.titel,
        quelle: q.quelle,
        gestartet: q.gestartet,
        notiz: q.notiz,
        zustand,
        letzteAktivitaet,
        seitStunden: letzteAktivitaet ? Math.round((jetzt - new Date(letzteAktivitaet).getTime()) / 3_600_000) : null,
        ...bewertet,
        waechter,
      })
    }
  }

  // Aktivität ohne Phasenplan: Projekte, an denen in den letzten sieben Tagen
  // gearbeitet wurde. Dort steht nur, was verbraucht wurde.
  const grenzeTag = new Date(jetzt - 7 * 86_400_000).toISOString().slice(0, 10)
  const weitere = []
  for (const [projekt, posten] of postenJeProjekt) {
    if (mitAuftrag.has(projekt)) continue
    const juengst = posten.filter((p) => p.tag >= grenzeTag)
    if (!juengst.length) continue
    const tokens = juengst.reduce((n, p) => n + tokensVon(p), 0)
    const usd = juengst.reduce((n, p) => n + p.usd, 0)
    const letzteAktivitaet = juengst.map((p) => p.letzte).filter(Boolean).sort().pop() ?? null
    weitere.push({
      projekt,
      tokens7Tage: tokens,
      usd7Tage: Math.round(usd * 100) / 100,
      letzteAktivitaet,
      laeuft: zustandVon({ fertig: false, letzteAktivitaet, jetzt }) === 'laeuft',
    })
  }
  weitere.sort((a, b) => String(b.letzteAktivitaet).localeCompare(String(a.letzteAktivitaet)))

  const RANG = { laeuft: 0, pausiert: 1, gestoppt: 2, brach: 3, fertig: 4 }
  auftraege.sort((a, b) => RANG[a.zustand] - RANG[b.zustand] || String(b.letzteAktivitaet).localeCompare(String(a.letzteAktivitaet)))

  return { erzeugt: new Date(jetzt).toISOString(), auftraege, weitere }
}
