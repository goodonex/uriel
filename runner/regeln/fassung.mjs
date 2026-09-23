/**
 * runner/regeln/fassung.mjs — welche Regel-Fassung gilt gerade (23.09.2026).
 *
 * Die Regeln für Erstnachrichten liegen seit heute hier im Code statt im
 * Vault-Skill. Der Vault kam auf dem Mac mini nicht an (Stand dort: 16.09.),
 * und Kevin fand im Lauf vom 23.09. keine einzige seiner Regeln vom 22.09.
 * wieder. Der Code dagegen zieht der Runner selbst nach.
 *
 * Die Fassung ist ein Hash über alle Dateien dieses Ordners. Jede
 * Erstnachricht trägt sie in `quelle_datei`; eine offene Nachricht mit einer
 * anderen Fassung ist veraltet und wird in der nächsten Runde neu geschrieben
 * (`scripts/erstnachrichten-input.ts`, `schreibeErstnachrichten`). So gilt
 * eine Regeländerung automatisch für alles, was danach kommt — ohne dass
 * jemand daran denken muss.
 *
 * Gelesen wird bei jedem Aufruf frisch von der Platte: Eine geänderte Regel
 * wirkt im nächsten Lauf, nicht erst nach einem Neustart.
 */
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ORDNER = fileURLToPath(new URL('./erstnachrichten/', import.meta.url))

/** Präfix aller vom Agenten geschriebenen Zeilen — ohne Fassung: vor dem 23.09. entstanden. */
export const QUELLE_PRAEFIX = 'agent:linkedin-erstnachrichten'

/** @returns {{ fassung: string, schreiben: string, pruefen: string, quelle: string }} */
export function regelwerk() {
  const dateien = readdirSync(ORDNER).filter((d) => d.endsWith('.md')).sort()
  const hash = createHash('sha256')
  const inhalt = {}
  for (const d of dateien) {
    const text = readFileSync(join(ORDNER, d), 'utf8')
    hash.update(`${d}\n${text}\n`)
    inhalt[d.replace(/\.md$/, '')] = text
  }
  const fassung = hash.digest('hex').slice(0, 10)
  if (!inhalt.schreiben || !inhalt.pruefen) throw new Error(`Regelwerk unvollständig in ${ORDNER}`)
  return { fassung, schreiben: inhalt.schreiben, pruefen: inhalt.pruefen, quelle: `${QUELLE_PRAEFIX}@${fassung}` }
}

/**
 * Ist diese offene Zeile mit einer älteren Regel-Fassung geschrieben?
 * Von Hand angelegte Zeilen (andere Quelle) und Kevins gesendete bleiben unberührt.
 */
export function istVeraltet(zeile, aktuelleQuelle) {
  const q = String(zeile?.quelle_datei ?? '')
  return zeile?.status === 'offen' && q.startsWith(QUELLE_PRAEFIX) && q !== aktuelleQuelle
}
