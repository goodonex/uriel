/**
 * runner/linkedin/leadRecherche.mjs — die Website-Recherche aus dem
 * Schreib-Agenten herausgelöst (07.09.2026).
 *
 * **Der Anlass, gemessen.** Kevin am 07.09. nach einem Blick auf sein
 * 5-Stunden-Limit: *„Ich habe heute 5 Prompts eingegeben. 22 % sind weg. Was
 * zieht hier gerade die Tokens?"* Die Antwort stand in einer einzigen
 * Agenten-Session vom selben Morgen — 13 Leads, 51 Modell-Aufrufe:
 *
 * | Aufruf 1  | Kontext  47.186 |
 * | Aufruf 51 | Kontext 102.055 |
 * | Summe     | 4.091.687       |
 *
 * Der Agent recherchierte je Lead die Website (WebSearch + WebFetch) und
 * schrieb im selben Kontext die Nachricht. Alles, was er für Lead 1 gelesen
 * hatte, trug er bis Lead 13 mit — und bezahlte es bei jedem der 51 Aufrufe
 * erneut. Das wächst quadratisch: 41 % der Summe waren mitgeschleppte
 * Recherche, der Rest derselbe Sockel, 51 Mal getragen. Mal vier Batches
 * ergab das rund 16 Millionen Token für 50 Nachrichten — **315.000 Token pro
 * Erstnachricht**.
 *
 * **Der Tausch.** Die Recherche ist Handwerk, das Schreiben ist die teure
 * Arbeit. Hier bekommt jeder Lead seinen EIGENEN, kurzlebigen Lauf: Der
 * Kontext stirbt mit ihm, und was in den Schreib-Agenten wandert, sind zehn
 * Zeilen Destillat statt einer ganzen Website. Der Schreib-Agent braucht dann
 * weder WebSearch noch WebFetch — und sein Kontext wächst nicht mehr.
 *
 * **Warum nicht ganz ohne Modell?** Weil das Finden der Seite die eigentliche
 * Denkarbeit ist: Zu „Marc Weber, Immobilien" gibt es zwanzig Treffer, und der
 * richtige ist selten der erste. Ein reines fetch-Skript bräuchte eine
 * Such-API (Schlüssel, eigene Kosten) und träfe schlechter.
 *
 * **Warum Sonnet und nicht Opus?** Beobachten, was auf einer Startseite steht,
 * ist Lesen, kein Urteil über einen Menschen. Das Urteil — schreiben oder
 * aussortieren — und die Nachricht selbst bleiben bei Opus, wo sie hingehören.
 */
import { spawn } from 'node:child_process'

/** Ein Lauf je Lead — mehr als zwei Minuten braucht eine Website-Recherche nicht. */
const LEAD_TIMEOUT_MS = Number(process.env.RECHERCHE_TIMEOUT_MS ?? 2 * 60 * 1000)

/**
 * Wie viele Leads gleichzeitig?
 *
 * Drei, nicht dreizehn: Jeder Lauf ist ein eigener `claude`-Prozess, und
 * dreizehn davon nebeneinander bringen den Mac ins Schwitzen, während Kevin
 * am selben Rechner arbeitet. Drei halten die Rampe kurz, ohne dass man es
 * merkt.
 */
const GLEICHZEITIG = Number(process.env.RECHERCHE_PARALLEL ?? 3)

/**
 * Harter Deckel je Lead, in Dollar (07.09.2026).
 *
 * Der erste Entwurf dieses Moduls war TEURER als der Zustand, den er ablösen
 * sollte: $0,47 je Lead nur für die Recherche, gegen $0,41 für Recherche UND
 * Nachricht im alten Weg. Gemessen an den Aufrufen lag es nicht am Kontext
 * (der blieb bei 39–45k stehen, das Destillat wirkt), sondern an acht bis zehn
 * Modell-Aufrufen je Lead: Das Modell suchte nach, prüfte Handelsregister,
 * holte zweite Quellen. Gründlich, aber nicht bezahlt.
 *
 * Der Deckel ist die Antwort auf Kevins eigentliche Forderung — nicht „billiger
 * werden", sondern „das darf nicht nochmal unbemerkt passieren". Ein Lauf, der
 * ihn reißt, wird abgeschnitten und gemeldet, statt still weiterzulaufen.
 *
 * **Er ist eine Notbremse, keine Regelgrenze.** Beim ersten Messlauf stand er
 * auf $0,08 — genau dort, wo ein normaler Lead landet — und schnitt prompt den
 * ersten von zwei Leads ab: Ergebnis weg, Geld trotzdem ausgegeben. Das ist
 * der teuerste aller Fälle. $0,15 lässt den Normalfall (~$0,08) in Ruhe und
 * fängt nur den Ausreißer, der sich festgebissen hat.
 */
const BUDGET_JE_LEAD = Number(process.env.RECHERCHE_BUDGET_USD ?? 0.15)

/**
 * Das Destillat, das der Schreib-Agent bekommt.
 *
 * Bewusst eng: Es soll das tragen, woraus eine Beobachtung wird, und nichts
 * darüber hinaus. Jede Zeile mehr wandert in den teuren Kontext.
 */
function baueRecherchePrompt(lead) {
  return `Du recherchierst EINEN Immobilien-Kontakt für eine Erstansprache. Kein Text an den Kontakt, nur Fakten.

Kontakt:
- Name: ${lead.name}
- LinkedIn-Headline: ${lead.headline ?? '(keine)'}
- LinkedIn-Profil: ${lead.profile_url ?? '(unbekannt)'}

Aufgabe — halte dich exakt an diese zwei Schritte:
1. EINE Websuche (WebSearch: Name + Firma/Ort + "Immobilien"). Genau eine.
2. HÖCHSTENS EIN Seitenabruf (WebFetch) der Startseite, die am besten zu dieser Person passt.

Danach antwortest du. **Keine Nachrecherche, kein Handelsregister, keine zweite Quelle, keine Unterseiten.** Reicht das nicht für ein sicheres Urteil, setzt du "sicher": false und gibst zurück, was du hast — das ist ein gültiges Ergebnis. Gründlichkeit über diese zwei Schritte hinaus ist hier ausdrücklich nicht erwünscht: Sie kostet mehr, als die Nachricht wert ist.

Antworte mit NICHTS als diesem JSON-Block:

\`\`\`json
{
  "firma": "",
  "website": "",
  "sicher": true,
  "taetigkeit": "",
  "beobachtung": "",
  "eigentuemer_ansprache": "",
  "auffaelligkeit": ""
}
\`\`\`

Feldregeln:
- "firma": Firmenname, wie er auf der Seite steht. Leer, wenn keine gefunden.
- "website": vollständige URL oder leer. NIE geraten.
- "sicher": false, wenn du dir bei der Zuordnung nicht sicher bist.
- "taetigkeit": was die Person WIRKLICH macht, in einem Halbsatz — die Headline lügt oft. Bei Coach, Berater, Recruiter, Agentur, Software, Finanzierung ohne Maklergeschäft: genau das hinschreiben.
- "beobachtung": ein bis zwei Sätze, konkret und überprüfbar, über die Startseite: was dort steht, wie sie wirkt, was fehlt. Keine Wertung ins Blaue, nur was du gesehen hast.
- "eigentuemer_ansprache": Werden verkaufswillige Eigentümer angesprochen (Bewertung, Verkaufsanfrage, Wertermittlung)? "ja", "nein" oder "unklar".
- "auffaelligkeit": erkennbar veraltet, nicht handytauglich, kein Impressum, sehr langsam — oder leer.

Findest du keine Website, gib alle Felder leer zurück außer "taetigkeit". Das ist ein brauchbares Ergebnis, kein Fehler. **Erfinde nichts.**`
}

/** Den letzten ```json-Block aus einer Antwort ziehen — dasselbe Muster wie beim Schreib-Agenten. */
function letzterJsonBlock(text) {
  const treffer = [...String(text ?? '').matchAll(/```json\s*([\s\S]*?)```/g)]
  if (!treffer.length) return null
  try {
    return JSON.parse(treffer[treffer.length - 1][1])
  } catch {
    return null
  }
}

/** Ein Lead, ein Prozess, ein Kontext — und danach ist er weg. */
function rechercheEinen(lead, { cliPath, cwd, modell }) {
  return new Promise((fertig) => {
    const args = [
      '-p',
      baueRecherchePrompt(lead),
      '--output-format',
      'json',
      '--model',
      modell,
      '--allowedTools',
      'WebSearch,WebFetch',
      '--max-budget-usd',
      String(BUDGET_JE_LEAD),
      /**
       * Die User-Hooks bleiben draußen (07.09.2026): `uriel-status.mjs` hängt
       * als SessionStart-Hook an Kevins Konfiguration und fragt bei JEDEM
       * Agentenstart Supabase nach dem Stand — für einen Bericht, den ein
       * headless Lauf niemandem zeigt. Bei dreizehn Leads waren das dreizehn
       * Abfragen ins Leere.
       */
      '--setting-sources',
      'project',
    ]
    const proc = spawn(process.env.CLAUDE_BIN ?? 'claude', args, {
      cwd,
      env: { ...process.env, PATH: cliPath },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let aus = ''
    proc.stdout.on('data', (c) => (aus += c))
    proc.stderr.on('data', () => {})
    const uhr = setTimeout(() => proc.kill('SIGKILL'), LEAD_TIMEOUT_MS)
    proc.on('error', () => {
      clearTimeout(uhr)
      fertig({ lead, destillat: null, token: 0, grund: 'claude nicht startbar' })
    })
    proc.on('close', () => {
      clearTimeout(uhr)
      let hülle = null
      try {
        hülle = JSON.parse(aus)
      } catch {
        return fertig({ lead, destillat: null, token: 0, grund: 'Antwort nicht lesbar' })
      }
      const u = hülle?.usage ?? {}
      const token =
        (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.output_tokens ?? 0)
      const destillat = letzterJsonBlock(hülle?.result)
      fertig({
        lead,
        destillat,
        token,
        // Die CLI rechnet selbst ab — das ist die Währung, in der die Etappe meldet.
        kosten: Number(hülle?.total_cost_usd ?? 0),
        grund: destillat ? null : (hülle?.is_error ? 'Lauf abgebrochen (Budget oder Fehler)' : 'kein JSON-Block in der Antwort'),
      })
    })
  })
}

/**
 * Alle Leads eines Batches recherchieren — höchstens `GLEICHZEITIG` auf einmal.
 *
 * Gibt die Leads ZURÜCK, angereichert um `recherche`. Ein Lead ohne Ergebnis
 * fällt nicht raus: „keine Website gefunden" ist im Skill ausdrücklich ein
 * Aufhänger und kein Grund zum Überspringen.
 */
export async function rechercheLeads(leads, { melde = () => {}, cliPath = process.env.PATH ?? '', cwd, modell = process.env.RECHERCHE_MODELL ?? 'claude-haiku-4-5-20251001' } = {}) {
  const ergebnisse = new Array(leads.length)
  let naechster = 0
  let fertig = 0
  let token = 0
  let kosten = 0

  async function arbeiter() {
    while (naechster < leads.length) {
      const i = naechster++
      const r = await rechercheEinen(leads[i], { cliPath, cwd, modell })
      token += r.token
      kosten += r.kosten ?? 0
      ergebnisse[i] = r
      fertig++
      melde(`${fertig} von ${leads.length} recherchiert`, fertig / leads.length)
    }
  }

  await Promise.all(Array.from({ length: Math.min(GLEICHZEITIG, leads.length) }, arbeiter))

  const angereichert = leads.map((lead, i) => ({
    ...lead,
    recherche: ergebnisse[i]?.destillat ?? null,
    recherche_fehler: ergebnisse[i]?.grund ?? null,
  }))
  return {
    leads: angereichert,
    token,
    kosten,
    ohneErgebnis: ergebnisse.filter((r) => !r?.destillat).length,
  }
}
