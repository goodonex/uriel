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
import { verbundFuer } from './entscheider.mjs'
import { parseErstnachrichtenRoh } from './erstnachrichtenEntwuerfe.mjs'
import { gewichtAus } from '../regeln/lage.mjs'

/** Opus: Der Prüfer ist die letzte Stelle vor Kevins Namen. */
const MODELL = process.env.ERSTNACHRICHTEN_PRUEFER_MODELL ?? 'opus'
const LAUF_TIMEOUT_MS = Number(process.env.ERSTNACHRICHTEN_PRUEFER_TIMEOUT_MS ?? 8 * 60 * 1000)

/**
 * Gegründet in den letzten zwölf Monaten (09.10.2026)? Bis heute galt „seit
 * Vorjahr" als frisch, und fünf Leads bekamen „noch ganz frisch, oder?", deren
 * Firma über ein Jahr alt war. „03/2025" mit Monat, sonst nur das laufende Jahr.
 */
export function istFrisch(seit, heute = new Date()) {
  const t = String(seit ?? '')
  const mitMonat = t.match(/\b(0?[1-9]|1[0-2])\s*[./]\s*((?:19|20)\d{2})\b/)
  if (mitMonat) {
    const monate = (heute.getFullYear() - Number(mitMonat[2])) * 12 + (heute.getMonth() + 1 - Number(mitMonat[1]))
    return monate >= 0 && monate <= 12
  }
  const monatsName = t.match(/\b(jan|feb|mär|mar|apr|mai|may|jun|jul|aug|sep|okt|oct|nov|dez|dec)\w*\.?\s+((?:19|20)\d{2})\b/i)
  if (monatsName) {
    const idx = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dez'].indexOf(monatsName[1].toLowerCase().replace('ä', 'a').replace('may', 'mai').replace('oct', 'okt').replace('dec', 'dez').slice(0, 3))
    if (idx >= 0) {
      const monate = (heute.getFullYear() - Number(monatsName[2])) * 12 + (heute.getMonth() - idx)
      return monate >= 0 && monate <= 12
    }
  }
  return (jahrAus(t) ?? 0) === heute.getFullYear()
}

const jahrAus = (t) => {
  const m = String(t ?? '').match(/(19|20)\d{2}/)
  return m ? Number(m[0]) : null
}

/**
 * Welcher Ansatz für eine starke Seite (02.10.2026).
 *
 * Kevin: *„zu gut für die Analyse, und die direkt aus der Ansprache raus,
 * macht doch keinen Sinn. Dafür haben wir doch die anderen Approaches."* Bis
 * dahin wurden starke Seiten mit laufender oder ungeprüfter Werbung
 * zurückgestellt (`[zurückgestellt] … Aufhänger offen`) — am 02.10. waren das
 * 55 passende Leads ohne Nachricht. Jetzt bekommt jede starke Seite einen
 * Ansatz:
 *
 * - Meta UND Google sicher `nein` → `starke-seite` (Aufbau S: „du schaltest
 *   keine Werbung").
 * - sonst → `starke-seite-funnel` (Aufbau T): kein Satz über fehlende
 *   Werbung, sondern über das, was nach dem Klick passiert.
 */
export function ansatzStarkeSeite(r) {
  const meta = String(r?.meta_ads_aktiv ?? 'unbekannt')
  const google = String(r?.google_ads_aktiv ?? 'unbekannt')
  return meta === 'nein' && google === 'nein' ? 'starke-seite' : 'starke-seite-funnel'
}

/**
 * Hinweis für Kevins Prüf-Liste ohne Interna (03.10.2026): Kevin fand die Texte
 * „unangenehm", weil sie mit „Prüfer, zweiter Versuch: Laut Destillat …"
 * begannen. Schneidet solche Vorsätze ab, hält den Rest bei einem Satz.
 */
export function klartextHinweis(roh, max = 160) {
  let t = String(roh ?? '').trim()
  t = t.replace(/^(Prüfer(,\s*zweiter Versuch)?|PRÜFEN)\s*:\s*/i, '').replace(/^Laut (dem )?Destillat\s*(ist|steht|sind)?,?\s*/i, '')
  t = t.replace(/\bDestillat\b/g, 'Recherche')
  const satz = t.match(/^[\s\S]*?[.!?](?=\s|$)/)?.[0] ?? t
  const kurz = satz.length > max ? `${satz.slice(0, max - 1).trimEnd()}…` : satz
  return kurz.charAt(0).toUpperCase() + kurz.slice(1)
}

/**
 * Kevins eigener Satz aus der Prüf-Stufe (03.10.2026) gilt als gesichert.
 * Sagt er, die Person sei Geschäftsführer/Inhaber, ist sie Entscheider, auch
 * wenn das Impressum sie nicht nennt. Sagt er, sie sei angestellt, bleibt es bei
 * der Angestellten-Logik.
 */
export function mitKevinsHinweis(lead) {
  const h = String(lead?.hinweis_kevin ?? '').trim()
  if (!h || !lead.recherche) return lead
  const angestellt = /\b(angestellt|mitarbeiter|nicht (der )?(gf|geschäftsführer|inhaber))\b/i.test(h)
  const chef = !angestellt && /\b(geschäftsführer|geschaeftsfuehrer|gf|inhaber|inhaberin|gründer|gruender|gesellschafter|ceo)\b/i.test(h)
  if (angestellt) return { ...lead, recherche: { ...lead.recherche, rolle: 'angestellt', rolle_impressum: 'angestellt' } }
  if (!chef) return lead
  return { ...lead, recherche: { ...lead.recherche, rolle: 'entscheider', rolle_impressum: 'entscheider' } }
}

/**
 * Verbund-Rückfall (07.10.2026). Markus Blumhagen, GF seiner eigenen ProMak
 * Immobilien, bekam den Verbund-Ansatz; Prüfer und Schreiber erkannten, dass
 * er nicht passt — und der Lead landete als `[übersprungen]` statt bei einer
 * normalen Nachricht. Lehnt einer von beiden den Verbund ab, gilt der Verbund
 * als verworfen und der Lead bekommt den Ansatz, den er ohne ihn hätte.
 */
const VERBUND_ABGELEHNT = /verbund|dachmarke/i

/** Hat Schreiber oder Prüfer den Verbund-Ansatz dieses Leads abgelehnt? */
export function verbundAbgelehnt(lead, text) {
  return lead?.ansatz === 'verbund' && VERBUND_ABGELEHNT.test(String(text ?? ''))
}

/**
 * Derselbe Lead ohne Verbund: neuer Ansatz aus `ansatzFuer`.
 *
 * @returns {({ lead: object } | { zurueck: string }) & { dachmarke: string }}
 */
export function ohneVerbund(lead, heute = new Date()) {
  const dachmarke = verbundFuer(lead, lead?.recherche)
  const recherche = { ...(lead?.recherche ?? {}), verbund: '', verbund_verworfen: true }
  const a = ansatzFuer({ ...lead, recherche }, heute)
  if ('spaeter' in a) return { zurueck: `[zurückgestellt] ${a.spaeter}`, dachmarke }
  if ('zurueck' in a) return { zurueck: a.zurueck, dachmarke }
  const { pruefHinweis: _alt, ...rest } = lead
  return { lead: { ...rest, recherche, ansatz: a.ansatz, ...(a.pruefen ? { pruefHinweis: a.pruefen } : {}) }, dachmarke }
}

/** Ansätze, auf die der Prüfer eine Analyse umlenken darf. */
const UMLENK_ANSAETZE = ['starke-seite', 'starke-seite-funnel', 'grosser-player']

/**
 * Welche Art Nachricht bekommt dieser Lead? Reine Funktion, damit sie sich
 * prüfen lässt (`scripts/verify-erstnachrichten-ablauf.ts`).
 *
 * @returns {{ ansatz: string, pruefen?: string } | { zurueck: string }}
 */
export function ansatzFuer(lead, heute = new Date()) {
  const r = lead?.recherche ?? {}
  const eigeneFirma = String(r.firma ?? '').toLowerCase()
  const stationen = Array.isArray(r.stationen) ? r.stationen : []
  const nebenher = stationen.filter(
    (s) => s?.selbststaendig && String(s.firma ?? '').trim() && !eigeneFirma.includes(String(s.firma).toLowerCase().slice(0, 8)),
  )

  // Verbund/Dachmarke (07.10.2026): eigener Einstieg, vor allen Seiten- und Rollen-Fragen.
  const dachmarke = verbundFuer(lead, r)
  if (dachmarke) return { ansatz: 'verbund', dachmarke }

  // Nicht Entscheider der Firma, deren Seite wir sehen — aber eigene Firma nebenher (Hilgeland, 22./23.09.).
  if (r.rolle === 'angestellt' || r.rolle_impressum === 'angestellt') {
    if (nebenher.length) return { ansatz: 'nebenfirma' }
    // Reine Angestellte hat `entscheiderZuerst` schon zurückgestellt; wer hier ankommt, ist Konzern-Marketing.
  }

  /**
   * Großer Player (09.10.2026, Aufbau G): Milliarden-Volumen, institutionelles
   * Haus, ab 100 Mitarbeitenden. Kein Analyse-Angebot, keine Kritik an Seite,
   * Formular oder Postfach, keine Offline-/Keine-Seite-Frage — eine Frage auf
   * seiner Ebene. Robert Anzenberger (30 Mrd. Transaktionsvolumen) bekam am
   * 05.10. „landet im selben Postfach wie eine Bewerbung" und sagte ab. Vor
   * allen Seiten-Fragen, nach Verbund und Nebenfirma.
   */
  const gross = gewichtAus({ ...r, headline: r.headline ?? lead?.headline })
  if (gross.gewicht === 'gross') return { ansatz: 'grosser-player', gewicht_beleg: gross.beleg }

  // Hausverwaltungen: erst den Engpass erfragen (Aufbau H, 25.09.2026).
  if (String(r.geschaeftsmodell ?? '') === 'hausverwaltung') return { ansatz: 'hausverwaltung' }

  const website = String(r.website ?? '').trim()
  // Offline nur über eine Seite, die sicher der Firma gehört (v. Bülow, 30.09.2026: geratene tote Domain).
  if ((r.erreichbar === 'offline' || r.erreichbar === 'umbau') && r.sicher === false) {
    // 02.10.2026: Kevin entscheidet, ob er schreibt — der Lead landet mit Hinweis in „Prüfen vor den Anfragen", nicht im Papierkorb.
    return { ansatz: 'keine-seite', pruefen: `${website || 'Website'} lädt nicht und ist nicht als Firmenseite bestätigt, vor Versand googeln, ob die Firma eine andere Seite hat` }
  }
  if (r.erreichbar === 'offline' || r.erreichbar === 'umbau') return { ansatz: 'seite-offline' }
  if (!website || r.sicher === false) {
    /**
     * „Keine Seite" nur nach vollständiger Suche (09.10.2026). Brach eine
     * Google-Abfrage ab oder gab es gar keine, bleibt der Lead ohne Zeile im
     * Vorrat und wird im nächsten Lauf neu gesucht. Blockiert ist nicht leer.
     */
    if (!website && r.suche_vollstaendig === false) return { spaeter: 'Website-Suche unvollständig (Google-Abfrage gescheitert), nächster Lauf sucht neu' }
    const frisch = stationen.some((s) => s?.selbststaendig && istFrisch(s.seit, heute))
    return { ansatz: frisch ? 'frisch-ohne-seite' : 'keine-seite' }
  }

  /**
   * Frisch neu gemachte oder angekündigt umgebaute Seite (09.10.2026, Aufbau R):
   * Wer gerade bezahlt hat, will keine Kritik an der neuen Seite (Stimme, Regel 4).
   * Postmortem: 13 Leads, bei denen wir den Relaunch übersehen hatten.
   */
  if (r.relaunch === 'neu') return { ansatz: 'neue-seite' }
  if (r.relaunch === 'im-umbau') return { ansatz: 'seite-im-umbau' }

  const stufe = String(r.website_stufe ?? '')
  const wow = String(r.wow_potenzial ?? '')
  /**
   * Nur wirklich starke Seiten warten (25.09.2026). Bis heute stellte schon
   * „Wow knapp" zurück — in einer Nacht 9 von 14, darunter solide und sogar
   * schwache Seiten. Kevin: *„das von dreißig zwei, drei übrig bleiben, macht
   * überhaupt gar keinen Sinn."* Knapp heißt jetzt Analyse-Ansatz.
   */
  /**
   * Starke Seiten (25.09.2026, Aufbau S): Die Seite ist nicht das Thema, der
   * Traffic ist es — aber nur mit lückenloser Werbe-Prüfung. Kevin: *„es muss
   * wirklich im Meta und im Google geguckt worden sein, ob die schon Werbung
   * schalten."* Nur wenn BEIDE sicher „nein" sagen, trägt der Satz „deine Seite
   * ist super, aber du schaltest keine Werbung".
   */
  if (stufe === 'stark' || wow === 'nein') return { ansatz: ansatzStarkeSeite(r) }
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
  return { profil_key: lead.profil_key, name: lead.name, headline: lead.headline, ansatz: lead.ansatz, ...(lead.hinweis_kevin ? { hinweis_kevin: lead.hinweis_kevin } : {}), recherche: rest }
}

/**
 * Jede Nachricht gegen das Regelwerk prüfen.
 *
 * **Fällt der Prüfer selbst aus** (kein JSON, Zeitlimit), gilt nichts als
 * geprüft: Der Aufrufer schreibt dann gar keine Zeile, und die Leads bleiben
 * für die nächste Runde im Vorrat. Lieber ein Tag Verzug als eine
 * ungeprüfte Nachricht in Kevins Liste.
 *
 * @returns {Promise<{ urteile: Map<string, {urteil: string, hinweis: string, ansatz?: string, art?: 'kein_ziel'|'unsicher'}> | null, kosten: number }>}
 */
async function pruefeEinmal(nachrichten, leadsNachName, { cliPath, cwd }) {
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
    // Fehlt `art`, gilt „unsicher": Lieber ein Blick von Kevin zu viel als ein verlorener Lead (02.10.2026).
    const eintrag = { urteil, hinweis: String(u?.hinweis ?? '').trim().slice(0, 300), ...(urteil === 'zurueck' ? { art: u?.art === 'kein_ziel' ? 'kein_ziel' : 'unsicher' } : {}) }
    // Seite zu gut für eine Analyse: nicht streichen, sondern umlenken (02.10.2026). Der Code entscheidet, welcher der beiden.
    if (urteil !== 'ok' && UMLENK_ANSAETZE.includes(u?.ansatz)) {
      const lead = leadsNachName.get(String(u?.name ?? '').toLowerCase())
      eintrag.urteil = 'neu'
      // Der Prüfer erkennt einen großen Player, den der Code übersehen hat (09.10.2026): Aufbau G.
      eintrag.ansatz = u.ansatz === 'grosser-player' ? 'grosser-player' : lead ? ansatzStarkeSeite(lead.recherche) : 'starke-seite-funnel'
    }
    // Satzgenau beanstandet: Der Nachschreiber ändert dann nur diese Sätze (07.10.2026).
    if (eintrag.urteil === 'neu' && Array.isArray(u?.beanstandet)) {
      const b = u.beanstandet
        .map((x) => ({ satz: String(x?.satz ?? '').trim().slice(0, 400), grund: String(x?.grund ?? '').trim().slice(0, 200) }))
        .filter((x) => x.satz)
        .slice(0, 5)
      if (b.length) {
        eintrag.beanstandet = b
        console.log(`[schnell-langsam] Satz-Reparatur: ${b.length} Satz/Sätze beanstandet bei ${u?.name}`)
      }
    }
    urteile.set(String(u?.name ?? '').toLowerCase(), eintrag)
  }

  return { urteile, kosten }
}

export async function pruefeEntwuerfe(nachrichten, leadsNachName, ctx) {
  const erst = await pruefeEinmal(nachrichten, leadsNachName, ctx)
  const { urteile } = erst
  let kosten = erst.kosten
  if (!urteile) return erst

  // Mehrheitsentscheid beim Aussortieren (07.10.2026): `kein_ziel` fällt nur raus, wenn drei
  // unabhängige Läufe es sagen. Kevin am 02.10.: „Ich will nicht, dass auch nur einer rausfallen
  // kann, den wir eigentlich angehen könnten." Kostet nur die wenigen Kandidaten, nicht alle.
  const istKeinZiel = (u) => u?.urteil === 'zurueck' && u.art === 'kein_ziel'
  const kandidaten = nachrichten.filter((n) => istKeinZiel(urteile.get(String(n.name).toLowerCase())))
  if (kandidaten.length) {
    for (let runde = 0; runde < 2; runde++) {
      const wieder = await pruefeEinmal(kandidaten, leadsNachName, ctx)
      kosten += wieder.kosten
      for (const n of kandidaten) {
        const key = String(n.name).toLowerCase()
        const alt = urteile.get(key)
        if (!istKeinZiel(alt)) continue
        // Kein Ergebnis oder abweichendes Urteil: im Zweifel Kevins Blick statt Aussieben.
        if (!istKeinZiel(wieder.urteile?.get(key))) {
          alt.art = 'unsicher'
          console.log(`[schnell-langsam] Mehrheit: ${n.name} bleibt in Kevins Liste statt auszufallen`)
        }
      }
    }
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
  const input = { leads: leads.map((l) => ({ ...fuerModell(l), hinweis_pruefer: l.hinweis_pruefer, vorheriger_text: l.vorheriger_text, ...(l.beanstandet?.length ? { beanstandete_saetze: l.beanstandet } : {}) })) }
  const prompt =
    `${schreiben}\n\n---\n\nZweiter Versuch: Der Prüfer hat deine ersten Texte zu diesen Leads abgelehnt. ` +
    `Lies je Lead \`hinweis_pruefer\` und schreib neu. Wiederhole nicht, was abgelehnt wurde. ` +
    `Steht bei einem Lead \`beanstandete_saetze\`, ändere NUR diese Sätze und übernimm den Rest von \`vorheriger_text\` wortgleich.\n\n` +
    `Eingabedaten (JSON):\n\`\`\`json\n${JSON.stringify(input, null, 2)}\n\`\`\``
  const { text, kosten } = await lauf(prompt, { cliPath, cwd, budget: 1 + 0.4 * leads.length })
  const { nachrichten, uebersprungen } = parseErstnachrichtenRoh(text)
  return { nachrichten, uebersprungen, kosten }
}
