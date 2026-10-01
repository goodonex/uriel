import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Der ICP-Filter für den Runner (18.08.2026) — Zwilling von
 * `app/src/cockpit/lib/icp.ts`, mit DERSELBEN Regel-Datei.
 *
 * Warum es ihn braucht: Der Entwurfs-Agent schrieb Antworten für jeden, der
 * zurückgeschrieben hat — auch für Coaches, Recruiter und KI-Verkäufer, die
 * Kevin akquirieren wollten. Am 18.08. waren das 9 von 30 Entwürfen; Kevins
 * Urteil: „absolute Token-Verschwendung". Ein Off-ICP bekommt jetzt keinen
 * Entwurf mehr — der Thread bleibt sichtbar, nur der Agent lässt ihn liegen.
 *
 * Die Wortlisten liegen bewusst NICHT hier, sondern in
 * `app/src/cockpit/lib/icpRegeln.json`: zwei Kopien würden auseinanderlaufen,
 * sobald Kevin einen Begriff ergänzt — und dann sortierte die Oberfläche
 * anders, als der Agent schreibt. `scripts/verify-icp.ts` prüft, dass beide
 * Seiten dieselben Urteile fällen.
 */

const HIER = dirname(fileURLToPath(import.meta.url))
const REGEL_PFAD = join(HIER, '..', '..', 'app', 'src', 'cockpit', 'lib', 'icpRegeln.json')

let regeln = null
function ladeRegeln() {
  if (regeln) return regeln
  regeln = JSON.parse(readFileSync(REGEL_PFAD, 'utf8'))
  return regeln
}

function normalisiere(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function trifft(text, liste) {
  for (const wort of liste) {
    if (text.includes(normalisiere(wort))) return wort
  }
  return null
}

/**
 * @param {string|null} headline — die LinkedIn-Headline (Feld `company`).
 * @param {string|null} [name]
 * @returns {{urteil: 'kern'|'rand'|'unklar'|'off', grund: string|null}}
 */
export function icpUrteil(headline, name) {
  const r = ladeRegeln()
  const text = normalisiere(`${headline ?? ''} ${name ?? ''}`)
  if (!text.trim()) return { urteil: 'unklar', grund: null }

  // Wettbewerb zuerst — schlägt auch die Makler-Klammer darunter.
  const hart = trifft(text, r.hart_off ?? [])
  if (hart) return { urteil: 'off', grund: hart }

  const kern = trifft(text, r.kern)
  const off = trifft(text, r.off)
  // Wer sich selbst Makler nennt, bleibt drin — auch mit „Berater" in der Zeile.
  const nenntSichMakler = /immobilienmakler|maklerbuero|makler \||\| makler|immobilienberater/.test(text)
  if (off && !nenntSichMakler) return { urteil: 'off', grund: off }
  if (kern) return { urteil: 'kern', grund: kern }
  const rand = trifft(text, r.rand)
  if (rand) return { urteil: 'rand', grund: rand }
  return { urteil: 'unklar', grund: null }
}

/** Gehört die Person in Kevins Arbeitsvorrat? `unklar` zählt bewusst dazu. */
export function istArbeitsVorrat(urteil) {
  return urteil !== 'off'
}

/**
 * Gehört dieser THREAD in Kevins Antworten- und Nachfass-Spur? (01.10.2026)
 *
 * Eine Regel für Anzeige und Entwurfs-Agent, Zwilling von `threadImVorrat` in
 * `app/src/cockpit/lib/icp.ts` (`scripts/verify-icp.ts` hält beide gleich).
 *
 * Anlass: Metin Moser-Balci (privates Fachwerkhaus, sucht einen Statiker) stand
 * seit August in jedem Entwurfs-Lauf und in Kevins Antworten. Seine Headline
 * ergibt `unklar`, und das Urteil „kontakt" des Agenten hielt ihn nur aus dem
 * Nachfassen raus, nicht aus den Antworten. Kevin: *„so uninteressant"*. Und
 * umgekehrt fehlte Manuel Rees: vom Agenten als `lead` erkannt, von der
 * Headline als `off` geworfen.
 *
 * Darum gilt: Wer die Nachricht gelesen hat, sticht die Headline — in beide
 * Richtungen. `kontakt` und `akquise` sind raus, `lead` ist drin. Nur ohne
 * Agenten-Urteil entscheidet die Wortliste.
 */
export function threadImVorrat(thread) {
  const urteil = typeof thread?.agent_urteil === 'string' ? thread.agent_urteil.trim() : ''
  if (urteil === 'akquise') return false
  // `kontakt` gilt nur für das, was der Agent gelesen hat. Schreibt die Person
  // danach neu (der Makler, der abgesagt hatte, meldet sich doch), wird neu
  // geurteilt, statt sie für immer auszublenden. `akquise` bleibt dauerhaft.
  if (urteil === 'kontakt') return kontaktUeberholt(thread) ? istArbeitsVorrat(icpUrteil(thread?.company, thread?.name).urteil) : false
  if (urteil === 'lead') return true
  return istArbeitsVorrat(icpUrteil(thread?.company, thread?.name).urteil)
}

/** Hat die Person NACH dem Kontakt-Urteil noch einmal geschrieben? */
export function kontaktUeberholt(thread) {
  if (thread?.last_from !== 'them') return false
  const urteilAt = Date.parse(thread?.agent_urteil_at ?? '')
  const letzte = Date.parse(thread?.last_message_at ?? '')
  return Number.isFinite(urteilAt) && Number.isFinite(letzte) && letzte > urteilAt
}
