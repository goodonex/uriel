/**
 * runner/linkedin/erstnachrichtenAblauf.mjs — Ansatz vor dem Schreiben,
 * Prüfer nach dem Schreiben (23.09.2026).
 *
 * Kevin ging am 23.09. die ersten sieben neu geschriebenen Erstnachrichten
 * durch; fünf konnten nicht raus. Purschke bekam einen Wertrechner als
 * „leeres Formular" vorgehalten, den es als ordentliches Tool gibt. Kraus und
 * Paggalo bekamen eine Analyse zu Seiten, die Kevin selbst nicht besser bauen
 * könnte. Hilgeland, der bei Maus nur selbstständig mitarbeitet, bekam die
 * Maus-Seite kritisiert. Kevin: *„Ich möchte, dass wir einen Weg definieren
 * … dass es immer von A bis Z eingehalten wird. Das macht es vielleicht am
 * Anfang ein bisschen teurer."*
 *
 * Deshalb zwei Stellen, an denen nicht mehr das Schreib-Modell entscheidet:
 *
 * 1. **`ansatzFuer`** — der Code legt fest, welche Art Nachricht jemand
 *    bekommt, bevor ein Wort geschrieben ist. Starke Seiten ohne
 *    Wow-Potenzial bekommen gar keine (Kevin: *„Die Seite ist zu gut, eine
 *    Analyse wird dann nicht so viel bringen"*).
 * 2. **`pruefeEntwuerfe`** — ein zweiter, unabhängiger Lauf liest jede
 *    Nachricht gegen `runner/regeln/erstnachrichten/pruefen.md`, samt Kevins
 *    eigenen Urteilen als Prüffälle. Was durchfällt, wird einmal neu
 *    geschrieben und erneut geprüft; fällt es wieder durch, kommt es nicht in
 *    Kevins Liste.
 */
import { spawn } from 'node:child_process'
import { regelwerk } from '../regeln/fassung.mjs'
import { parseErstnachrichtenRoh } from './erstnachrichtenEntwuerfe.mjs'

/** Opus: Der Prüfer ist die letzte Stelle vor Kevins Namen. */
const MODELL = process.env.ERSTNACHRICHTEN_PRUEFER_MODELL ?? 'claude-opus-5'
const LAUF_TIMEOUT_MS = Number(process.env.ERSTNACHRICHTEN_PRUEFER_TIMEOUT_MS ?? 8 * 60 * 1000)

const jahrAus = (t) => {
  const m = String(t ?? '').match(/(19|20)\d{2}/)
  return m ? Number(m[0]) : null
}

/**
 * Welche Art Nachricht bekommt dieser Lead? Reine Funktion, damit sie sich
 * prüfen lässt (`scripts/verify-erstnachrichten-ablauf.ts`).
 *
 * @returns {{ ansatz: string } | { zurueck: string }}
 */
export function ansatzFuer(lead, heute = new Date()) {
  const r = lead?.recherche ?? {}
  const eigeneFirma = String(r.firma ?? '').toLowerCase()
  const stationen = Array.isArray(r.stationen) ? r.stationen : []
  const nebenher = stationen.filter(
    (s) => s?.selbststaendig && String(s.firma ?? '').trim() && !eigeneFirma.includes(String(s.firma).toLowerCase().slice(0, 8)),
  )

  // Nicht Entscheider der Firma, deren Seite wir sehen — aber eigene Firma nebenher (Hilgeland, 22./23.09.).
  if (r.rolle === 'angestellt' || r.rolle_impressum === 'angestellt') {
    if (nebenher.length) return { ansatz: 'nebenfirma' }
    // Reine Angestellte hat `entscheiderZuerst` schon zurückgestellt; wer hier ankommt, ist Konzern-Marketing.
  }

  const website = String(r.website ?? '').trim()
  if (r.erreichbar === 'offline' || r.erreichbar === 'umbau') return { ansatz: 'seite-offline' }
  if (!website || r.sicher === false) {
    const jahr = heute.getFullYear()
    const frisch = stationen.some((s) => s?.selbststaendig && (jahrAus(s.seit) ?? 0) >= jahr - 1)
    return { ansatz: frisch ? 'frisch-ohne-seite' : 'keine-seite' }
  }

  const stufe = String(r.website_stufe ?? '')
  const wow = String(r.wow_potenzial ?? '')
  /**
   * Nur wirklich starke Seiten warten (25.09.2026). Bis heute stellte schon
   * „Wow knapp" zurück — in einer Nacht 9 von 14, darunter solide und sogar
   * schwache Seiten. Kevin: *„das von dreißig zwei, drei übrig bleiben, macht
   * überhaupt gar keinen Sinn."* Knapp heißt jetzt Analyse-Ansatz.
   */
  if (stufe === 'stark' || wow === 'nein') {
    return {
      zurueck: `[zurückgestellt] Seite stark — wir bauen keine sichtbar bessere (Stufe ${stufe || '?'}, Wow ${wow || '?'}). Eigener Ansatz offen.`,
    }
  }
  if (wow !== 'ja' && wow !== 'knapp') {
    return { zurueck: `[prüfen] Wow-Potenzial der Seite nicht beurteilt — Recherche vor dem 23.09. oder unvollständig` }
  }
  if (String(r.geschaeftsmodell ?? '') === 'projektentwickler') return { ansatz: 'projektentwickler' }
  if (stufe === 'schwach' || r.zeitgemaess === 'nein' || ['optik-veraltet', 'kaum-inhalt'].includes(r.elefant_typ)) {
    return { ansatz: 'seite-ist-das-thema' }
  }
  return { ansatz: 'analyse' }
}

/** Den letzten ```json-Block einer Antwort lesen. */
function letzterJsonBlock(text) {
  const treffer = [...String(text ?? '').matchAll(/```json\s*([\s\S]*?)```/g)]
  if (!treffer.length) return null
  try {
    return JSON.parse(treffer[treffer.length - 1][1])
  } catch {
    return null
  }
}

/** Ein `claude -p`-Lauf ohne Werkzeuge. Nie werfen. */
function lauf(prompt, { cliPath, cwd, budget }) {
  return new Promise((fertig) => {
    const proc = spawn(
      process.env.CLAUDE_BIN ?? 'claude',
      ['-p', prompt, '--output-format', 'json', '--model', MODELL, '--effort', 'high', '--allowedTools', 'Read', '--max-budget-usd', String(budget), '--setting-sources', 'project'],
      { cwd, env: { ...process.env, PATH: cliPath }, stdio: ['ignore', 'pipe', 'pipe'] },
    )
    let aus = ''
    proc.stdout.on('data', (c) => (aus += c))
    proc.stderr.on('data', () => {})
    const uhr = setTimeout(() => proc.kill('SIGKILL'), LAUF_TIMEOUT_MS)
    proc.on('error', () => {
      clearTimeout(uhr)
      fertig({ text: '', kosten: 0 })
    })
    proc.on('close', () => {
      clearTimeout(uhr)
      try {
        const h = JSON.parse(aus)
        fertig({ text: String(h?.result ?? ''), kosten: Number(h?.total_cost_usd ?? 0) })
      } catch {
        fertig({ text: '', kosten: 0 })
      }
    })
  })
}

/** Was Prüfer und Nachschreiber über einen Lead sehen — das Destillat ohne Rohdaten. */
function fuerModell(lead) {
  const r = lead.recherche ?? {}
  const { profil: _p, klasse: _k, klasse_grund: _g, ...rest } = r
  return { profil_key: lead.profil_key, name: lead.name, headline: lead.headline, ansatz: lead.ansatz, recherche: rest }
}

/**
 * Jede Nachricht gegen das Regelwerk prüfen.
 *
 * **Fällt der Prüfer selbst aus** (kein JSON, Zeitlimit), gilt nichts als
 * geprüft: Der Aufrufer schreibt dann gar keine Zeile, und die Leads bleiben
 * für die nächste Runde im Vorrat. Lieber ein Tag Verzug als eine
 * ungeprüfte Nachricht in Kevins Liste.
 *
 * @returns {Promise<{ urteile: Map<string, {urteil: string, hinweis: string}> | null, kosten: number }>}
 */
export async function pruefeEntwuerfe(nachrichten, leadsNachName, { cliPath, cwd }) {
  if (!nachrichten.length) return { urteile: new Map(), kosten: 0 }
  const { pruefen, schreiben } = regelwerk()
  const vorlage = nachrichten.map((n) => {
    const lead = leadsNachName.get(String(n.name).toLowerCase())
    return { ...(lead ? fuerModell(lead) : { profil_key: n.profil_key, name: n.name }), nachricht: n.nachricht }
  })
  const prompt =
    `${pruefen}\n\n---\n\n# Anhang: das Regelwerk des Schreibers (schreiben.md)\n\n${schreiben}\n\n---\n\n` +
    `Prüfe diese ${vorlage.length} Nachrichten:\n\n\`\`\`json\n${JSON.stringify(vorlage, null, 2)}\n\`\`\``
  const { text, kosten } = await lauf(prompt, { cliPath, cwd, budget: 1 + 0.3 * vorlage.length })
  const json = letzterJsonBlock(text)
  if (!Array.isArray(json?.urteile)) return { urteile: null, kosten }
  const urteile = new Map()
  for (const u of json.urteile) {
    const urteil = ['ok', 'neu', 'zurueck'].includes(u?.urteil) ? u.urteil : 'neu'
    urteile.set(String(u?.name ?? '').toLowerCase(), { urteil, hinweis: String(u?.hinweis ?? '').trim().slice(0, 300) })
  }
  return { urteile, kosten }
}

/**
 * Durchgefallene einmal neu schreiben lassen — mit dem Hinweis des Prüfers.
 * Dasselbe Regelwerk wie der erste Lauf, nur weniger Leads.
 *
 * @returns {Promise<{ nachrichten: any[], uebersprungen: any[], kosten: number }>}
 */
export async function schreibeNeu(leads, { cliPath, cwd }) {
  if (!leads.length) return { nachrichten: [], uebersprungen: [], kosten: 0 }
  const { schreiben } = regelwerk()
  const input = { leads: leads.map((l) => ({ ...fuerModell(l), hinweis_pruefer: l.hinweis_pruefer, vorheriger_text: l.vorheriger_text })) }
  const prompt =
    `${schreiben}\n\n---\n\nZweiter Versuch: Der Prüfer hat deine ersten Texte zu diesen Leads abgelehnt. ` +
    `Lies je Lead \`hinweis_pruefer\` und schreib neu. Wiederhole nicht, was abgelehnt wurde.\n\n` +
    `Eingabedaten (JSON):\n\`\`\`json\n${JSON.stringify(input, null, 2)}\n\`\`\``
  const { text, kosten } = await lauf(prompt, { cliPath, cwd, budget: 1 + 0.4 * leads.length })
  const { nachrichten, uebersprungen } = parseErstnachrichtenRoh(text)
  return { nachrichten, uebersprungen, kosten }
}
