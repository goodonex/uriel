/**
 * runner/linkedin/leadRecherche.mjs — die Website-Recherche aus dem
 * Schreib-Agenten herausgelöst (07.09.2026), neu gebaut am 16.09.2026.
 *
 * **Warum ausgelagert (07.09.).** Der Schreib-Agent recherchierte je Lead im
 * selben Kontext, in dem er danach alle Nachrichten schrieb: 51 Aufrufe,
 * Kontext 47k → 102k, 315.000 Token je Erstnachricht. Seitdem bekommt jeder
 * Lead einen eigenen, kurzlebigen Lauf, und in den Schreib-Agenten wandert nur
 * ein Destillat.
 *
 * **Warum neu gebaut (16.09.).** Die ausgelagerte Recherche lief auf Haiku mit
 * genau EINER Websuche und las die Seite per WebFetch als Rohtext. Kevin ging
 * die ersten sechs von 48 Nachrichten durch — vier waren falsch:
 *
 * - Drei Mal „keine Website gefunden" (Jauck, Schmitt, Barendsma), obwohl eine
 *   Suche nach Name + Firma die Seite als ersten Treffer liefert.
 * - „Nullen in den Statistik-Boxen" bei immobilien-sis.com — die Zähler laufen
 *   per JavaScript hoch, der Rohtext zeigt die Startwerte.
 * - „Anfragen über die Mail kommen nie an" bei Stierling — der sichtbare Text
 *   hat einen Tippfehler, der Link dahinter ist korrekt.
 * - „Weg für Eigentümer klar aufgebaut" bei Stierling — die Seite ist fast
 *   leer, was man nur SIEHT.
 *
 * Kevin: *„darauf kann ich mich nicht verlassen."* Die Kosten-Optimierung hatte
 * die Recherche so ausgedünnt, dass sie falsche Befunde produzierte — und ein
 * falscher Befund kostet mehr als jeder Token: Kevin sagt ihn dem Lead ins
 * Gesicht.
 *
 * **Der neue Weg, drei Stufen je Lead:**
 * 1. *Finden* (Sonnet, nur WebSearch, bis zu drei Suchen): Kandidaten-URLs,
 *    Firma, Tätigkeit. Kein Seitenabruf — das macht Stufe 2 besser.
 * 2. *Rendern* (`seiteRendern.mjs`, kein Modell): echter Chrome, durchscrollen,
 *    Text + Links + Screenshots. Offline/Download stellt der Browser fest,
 *    nicht ein Modell.
 * 3. *Befund* (Sonnet mit Read): liest Screenshots und gerenderten Text. Jeder
 *    Mangel braucht einen wörtlichen Beleg, und den prüft HIER der Code gegen
 *    den gerenderten Text — ohne Beleg fliegt der Mangel raus.
 */
import { spawn } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { writeFile, mkdir } from 'node:fs/promises'
import { starteBrowser, rendereKandidat } from './seiteRendern.mjs'

const LEAD_TIMEOUT_MS = Number(process.env.RECHERCHE_TIMEOUT_MS ?? 3 * 60 * 1000)

/** Drei gleichzeitig: jeder Lauf ist ein eigener `claude`-Prozess, dazu ein Chrome-Tab. */
const GLEICHZEITIG = Number(process.env.RECHERCHE_PARALLEL ?? 3)

/**
 * Deckel je Modell-Lauf, in Dollar. Eine Notbremse gegen Ausreißer, keine
 * Regelgrenze — ein abgeschnittener Lauf ist bezahlt und liefert nichts.
 * Zwei Läufe je Lead (Finden + Befund).
 */
const BUDGET_FINDEN = Number(process.env.RECHERCHE_BUDGET_FINDEN_USD ?? 0.5)
const BUDGET_BEFUND = Number(process.env.RECHERCHE_BUDGET_BEFUND_USD ?? 0.6)

/** Sonnet statt Haiku (16.09.): Haiku fand drei von sechs existierenden Seiten nicht. */
const MODELL = process.env.RECHERCHE_MODELL ?? 'claude-sonnet-5'

function baueFindenPrompt(lead) {
  return `Finde die Website EINES Immobilien-Kontakts. Kein Text an den Kontakt.

Kontakt:
- Name: ${lead.name}
- LinkedIn-Headline: ${lead.headline ?? '(keine)'}
- LinkedIn-Profil: ${lead.profile_url ?? '(unbekannt)'}

Vorgehen:
1. WebSearch mit Name + Firma aus der Headline (falls vorhanden) + "Immobilien".
2. Findest du keine eigene Firmen-Website: zweite Suche nur mit dem Firmennamen (bzw. Name + "Immobilienmakler"). Höchstens eine dritte Suche.
3. Keine Seiten abrufen — die Seite öffnet danach ein Browser.

Portale, Verzeichnisse, Presseportale, Facebook, LinkedIn, Xing, ImmoScout sind KEINE Website der Firma — aber sie verraten oft deren Domain. Eine persönliche Seite des Kontakts zählt als Kandidat.

Antworte mit NICHTS als diesem JSON-Block:

\`\`\`json
{
  "firma": "",
  "taetigkeit": "",
  "kandidaten": [],
  "nur_portal": false
}
\`\`\`

- "firma": Firmenname. Leer, wenn unklar.
- "taetigkeit": was die Person wirklich macht, ein Halbsatz. Die Headline lügt oft — Coach, Recruiter, Agentur, Software, Finanzierung ohne Maklergeschäft genau so benennen.
- "kandidaten": bis zu drei vollständige URLs eigener Websites, beste zuerst. NIE geraten, nur aus Suchtreffern.
- "nur_portal": true, wenn die Firma erkennbar nur über Portale/Social auftritt.`
}

function baueBefundPrompt(lead, { firma, dateien, render }) {
  const s = render.start
  const u = render.unterseite
  return `Du prüfst die Website eines Immobilien-Kontakts für eine Erstansprache. Kein Text an den Kontakt, nur Befunde.

Kontakt: ${lead.name} · ${lead.headline ?? ''} · Firma laut Suche: ${firma || '(unklar)'}
Website: ${s.endUrl}
Menü: ${(s.menue ?? []).join(' | ') || '(keins erkannt)'}
Eigentümer-Unterseite: ${u ? `${u.url} (${u.erreichbar})` : 'keine im Menü/in den Links gefunden'}
Vom Browser gemessen (Startseite): ${JSON.stringify(s.checkliste ?? {})}

Die Seite wurde in einem echten Browser geöffnet und einmal ganz durchgescrollt (Zähler und Animationen sind durchgelaufen). Lies mit Read GENAU diese Dateien:
${dateien.map((d) => `- ${d}`).join('\n')}

Die Screenshots zeigen, was ein Besucher sieht — urteile über Optik, Leere, Aufbau NUR danach. **Aber:** Leere weiße Kacheln, weiße Bildrahmen oder schwarze Flächen im Ganzseiten-Screenshot sind fast immer Technik (Slider, Lazy-Loading, Video), nicht die Seite. „Leer" oder „kaum Inhalt" nur, wenn auch die Textdatei kaum etwas hergibt. Ein Hintergrundbild oder -video oben ist oft ein Video, das wechselt — nie das Motiv eines Standbilds kritisieren. Die Textdatei ist der sichtbare Text. Keine anderen Quellen, kein Web.

## Worum es geht

Kevin verkauft Maklern und Immobilienfirmen eine Website, die Anfragen bringt. Er schreibt jedem Kontakt: eine echte Stärke der Seite → das EINE Problem, das am meisten Anfragen kostet → Angebot. Deine Aufgabe ist, diese beiden Dinge richtig zu treffen. Ein wahrer, aber nebensächlicher Punkt entkräftet die Nachricht: Wer eine Seite von 2005 hat und hört „dir fehlt ein Bewertungstool", denkt „meine Seite ist eh Schrott" — und antwortet nicht.

## Schritt 1 — Gesamteindruck (IMMER zuerst)

Stell dir einen Eigentümer vor, der 2026 drei Makler vergleicht und auf dieser Seite landet. Würde er hier anfragen?
- Wirkt sie zeitgemäß und gepflegt, oder alt, amateurhaft, leer, wie ein Baukasten?
- Sieht man die Menschen dahinter (Fotos vom Team/Makler)?
- Gibt es Vertrauen: Kundenstimmen, Referenzen, verkaufte Objekte?
- Versteht man oben sofort, was die Firma macht und für wen?

**Ist die Seite als Ganzes nicht auf einem Stand, auf dem jemand anfragt, IST das der Elefant** — egal, was sonst fehlt. Nur wenn die Seite zeitgemäß und vertrauenswürdig ist, suchst du den Elefanten im Weg zur Anfrage.

## Schritt 2 — Checkliste (aus Screenshots + Messwerten)

## Schritt 3 — Zielgruppe

Nicht jeder Kontakt lebt von Eigentümer-Mandaten. Bestimme, wen die Seite gewinnen MUSS: Eigentümer (Makler), Käufer/Mieter (Vermarkter, Vermieter, Bauträger), Investoren, Grundstücksverkäufer (Entwickler), Verwaltungskunden (Hausverwaltung). Der Elefant ist das, was genau DIESE Anfragen kostet.

Antworte mit NICHTS als diesem JSON-Block:

\`\`\`json
{
  "passt_zur_person": true,
  "gesamteindruck": "",
  "zeitgemaess": "",
  "menschen_sichtbar": false,
  "kundenstimmen": false,
  "referenzen": false,
  "hero_klar": false,
  "eigentuemer_bereich": "",
  "bewertung": "",
  "ausrichtung": "",
  "zielgruppe": "",
  "optik": "",
  "inhalt": "",
  "staerke": "",
  "elefant_typ": "",
  "elefant": "",
  "mangel": "",
  "mangel_beleg": "",
  "befund": ""
}
\`\`\`

Feldregeln:
- "passt_zur_person": false, wenn Seite erkennbar nicht zu dieser Person/Firma gehört.
- "gesamteindruck": ein Satz, wie die Seite auf einen Besucher wirkt — ehrlich, wie ein Freund es sagen würde.
- "zeitgemaess": "ja", "teils" oder "nein".
- "menschen_sichtbar": echte Fotos vom Team/Makler auf Start- oder Eigentümerseite (keine Stockfotos).
- "kundenstimmen", "referenzen": sichtbar vorhanden (Messwerte helfen, Screenshot entscheidet).
- "hero_klar": Versteht man im ersten Screenshot, was die Firma macht und für wen?
- "eigentuemer_bereich": "nein" oder "ja: <Menüpunkt>".
- "bewertung": "sofort-ergebnis", "nur-formular", "kostenpflichtig", "keine" oder "unklar".
- "ausrichtung": "kaeuferlastig", "eigentuemer", "investoren" oder "unklar".
- "zielgruppe": "eigentuemer", "kaeufer-mieter", "investoren", "grundstuecke", "verwaltung" oder gemischt mit "+".
- "optik": "modern", "veraltet", "baukasten-schlicht" oder "unklar".
- "inhalt": "duenn", "normal" oder "reich".
- "staerke": EINE echte, konkrete Stärke, die der Inhaber gern hört und die stimmt (etwa „eigene Seite für Verkäufer mit Ablauf in sechs Schritten", „ihr zeigt euch mit Foto und Namen", „Kundenstimmen direkt auf der Startseite"). Nie Slogans, Überschriften, Eigenlob-Zahlen. Gibt es ehrlich nichts: leer lassen.
- "elefant_typ": genau einer von "optik-veraltet" (Seite wirkt alt/amateurhaft — sticht alles andere), "kaum-inhalt" (Seite sagt fast nichts), "kein-vertrauen" (NUR wenn Menschen, Kundenstimmen UND Referenzen alle drei fehlen — fehlende Kundenstimmen allein sind fast überall so und nie der Elefant), "zielgruppe-verfehlt" (spricht die Leute, die anfragen sollen, nicht an), "kein-eigentuemer-weg", "bewertung-ohne-ergebnis", "anfrage-weg-schwach" (Kontakt versteckt, kein klarer nächster Schritt), "keiner" (Seite stark).
- "elefant": ein bis zwei Sätze: was das ist und warum es ANFRAGEN kostet. Konkret an dieser Seite, in Geld-/Anfragen-Logik, nicht in Technik. **Nie** Code, Quelltext, Ladezeiten, Meta-Tags, Tippfehler, Copyright-Jahre oder Barrierefreiheit — das macht niemanden zum Kunden.
- "mangel": ein konkreter, sichtbarer Fehler, der den Elefanten stützt, sonst leer. **Im Zweifel leer.** Nie: Zahlen, die „0" wirken, abgeschnittene Texte der Textdatei, Folgen, die du nicht gesehen hast, Cookie-/Consent-Platzhalter, Slider-Klone, bewusste Positionierung, Tippfehler, Du/Sie-Wechsel.
- "mangel_beleg": die Stelle WÖRTLICH aus der Textdatei (max. 80 Zeichen). Ohne wörtlichen Beleg bleibt "mangel" leer — wird maschinell geprüft.
- "befund": ein bis zwei Sätze zum Weg eines Anfragenden der Zielgruppe: was es gibt und was fehlt. Kein „vermutlich". **Erfinde nichts.**`
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

/** Ein kurzlebiger `claude -p`-Lauf. Nie werfen. */
function claudeLauf(prompt, { cliPath, cwd, tools, budget, zusatzOrdner }) {
  return new Promise((fertig) => {
    const args = [
      '-p',
      prompt,
      '--output-format',
      'json',
      '--model',
      MODELL,
      '--allowedTools',
      tools,
      '--max-budget-usd',
      String(budget),
      // User-Hooks bleiben draußen (07.09.2026): der SessionStart-Hook fragte je Lauf Supabase ab.
      '--setting-sources',
      'project',
      ...(zusatzOrdner ? ['--add-dir', zusatzOrdner] : []),
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
      fertig({ json: null, kosten: 0, token: 0, grund: 'claude nicht startbar' })
    })
    proc.on('close', () => {
      clearTimeout(uhr)
      let hülle = null
      try {
        hülle = JSON.parse(aus)
      } catch {
        return fertig({ json: null, kosten: 0, token: 0, grund: 'Antwort nicht lesbar' })
      }
      const u = hülle?.usage ?? {}
      const json = letzterJsonBlock(hülle?.result)
      fertig({
        json,
        kosten: Number(hülle?.total_cost_usd ?? 0),
        token: (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.output_tokens ?? 0),
        grund: json ? null : hülle?.is_error ? 'Lauf abgebrochen (Budget oder Fehler)' : 'kein JSON-Block in der Antwort',
      })
    })
  })
}

const normal = (t) => String(t ?? '').toLowerCase().replace(/\s+/g, ' ').trim()

/** Portale sind keine eigene Website, auch wenn die Suche sie nennt. */
const PORTAL = /linkedin\.|xing\.|facebook\.|instagram\.|immobilienscout|immowelt|immonet|kleinanzeigen|openpr|pflumm|stilpunkte|northdata|firmenwissen|gelbeseiten|11880|google\.|provenexpert|homeday|wikipedia/i

function kuerzelFuer(lead) {
  return String(lead.profil_key ?? lead.name ?? 'lead').replace(/[^a-z0-9]+/gi, '-').slice(0, 60)
}

/** Ein Lead, drei Stufen. */
async function rechercheEinen(lead, { cliPath, cwd, browser, ordner }) {
  let kosten = 0
  let token = 0

  /**
   * Stufe 1 — Finden. Steht die Website schon fest (Kevin hat sie korrigiert,
   * oder sie ist aus einem früheren Lauf bestätigt), wird nicht noch einmal
   * gesucht: Die Suche fand am 16.09. für Christopher Schmitt eine fremde
   * Hausverwaltung statt immo-schmitt.com.
   */
  const bekannt = String(lead.website_bekannt ?? '').trim()
  const f = bekannt
    ? { json: { firma: lead.firma_bekannt ?? '', taetigkeit: lead.taetigkeit_bekannt ?? '', kandidaten: [bekannt], nur_portal: false }, kosten: 0, token: 0 }
    : await claudeLauf(baueFindenPrompt(lead), { cliPath, cwd, tools: 'WebSearch', budget: BUDGET_FINDEN })
  kosten += f.kosten
  token += f.token
  if (!f.json) return { lead, destillat: null, kosten, token, grund: `Finden: ${f.grund}` }
  const firma = String(f.json.firma ?? '').trim()
  const taetigkeit = String(f.json.taetigkeit ?? '').trim()
  const kandidaten = (Array.isArray(f.json.kandidaten) ? f.json.kandidaten : [])
    .map((k) => String(k).trim())
    .filter((k) => /^https?:\/\//.test(k) && !PORTAL.test(k))
    /**
     * Immer die Startseite der Domain (16.09.): Die Suche liefert gern die
     * Team- oder Über-uns-Seite, und dann urteilte der Befund über eine
     * Unterseite („nur Kurzbiografie und Kontaktdaten"). Ein Eigentümer
     * googelt die Firma und landet vorn.
     */
    .map((k) => {
      try {
        return new URL(k).origin + '/'
      } catch {
        return k
      }
    })
    .filter((k, i, alle) => alle.indexOf(k) === i)
    .slice(0, 3)

  const leer = { firma, website: '', sicher: false, erreichbar: '', taetigkeit, eigentuemer_bereich: '', bewertung: '', ausrichtung: '', optik: '', inhalt: '', mangel: '', befund: '', nur_portal: Boolean(f.json.nur_portal) }
  if (!kandidaten.length) return { lead, destillat: leer, kosten, token, grund: null }

  // Stufe 2 — Rendern: erster Kandidat, der wirklich lädt
  const kuerzel = kuerzelFuer(lead)
  let render = null
  let ersterKaputt = null
  for (const [i, url] of kandidaten.entries()) {
    const r = await rendereKandidat(browser, url, { ordner, kuerzel: `${kuerzel}-${i}` })
    if (r.start.erreichbar === 'ja' && (r.start.textLaenge ?? 0) > 0) {
      render = r
      break
    }
    ersterKaputt ??= r.start
  }
  if (!render) {
    // Die Seite existiert, lädt aber nicht (oder startet einen Download) — das hat der Browser gesehen, nicht ein Modell.
    return {
      lead,
      destillat: { ...leer, website: ersterKaputt.url, sicher: true, erreichbar: 'offline', befund: ersterKaputt.grund ?? '' },
      kosten,
      token,
      grund: null,
    }
  }

  // Stufe 3 — Befund aus Screenshots und sichtbarem Text
  const s = render.start
  const u = render.unterseite
  const textDatei = join(ordner, `${kuerzel}-text.md`)
  const sichtbarerText = `# Startseite ${s.endUrl}\n\n${s.text}\n\n` + (u?.erreichbar === 'ja' ? `# Eigentümer-Unterseite ${u.endUrl}\n\n${u.text}\n` : '')
  await writeFile(textDatei, sichtbarerText.slice(0, 16_000))
  const dateien = [s.screenshotOben, s.screenshotGanz, ...(u?.erreichbar === 'ja' ? [u.screenshotGanz] : []), textDatei]
  const b = await claudeLauf(baueBefundPrompt(lead, { firma, dateien, render }), { cliPath, cwd, tools: 'Read', budget: BUDGET_BEFUND, zusatzOrdner: ordner })
  kosten += b.kosten
  token += b.token
  if (!b.json) return { lead, destillat: null, kosten, token, grund: `Befund: ${b.grund}` }

  /**
   * Der Beleg-Check: Ein Mangel ohne wörtliche Fundstelle im gerenderten Text
   * fliegt raus. Das ist die Wache gegen genau die Sorte Fehler, die Kevin am
   * 16.09. fand — ein Modell, das aus Rohdaten eine Folge ableitet, die auf
   * der echten Seite nicht existiert.
   */
  let mangel = String(b.json.mangel ?? '').trim()
  const beleg = normal(b.json.mangel_beleg)
  const gesamt = normal(sichtbarerText)
  // Consent-Platzhalter sieht nur der Prüf-Browser, weil er Cookies ablehnt (Hellweger, 16.09.).
  if (mangel && /cookie|consent|drittanbieter|einwilligung/i.test(mangel + ' ' + beleg)) {
    console.log(`[runner] Recherche ${lead.name}: Consent-Platzhalter ist kein Mangel — verworfen`)
    mangel = ''
  }
  // Kleinkram ist nie der Aufhänger (Kevin, 16.09.): „krass, dass dir das auffällt" macht niemanden zum Kunden.
  if (mangel && /tippfehler|grammatik|copyright|quelltext|code|meta|du\/sie|anrede/i.test(mangel)) {
    console.log(`[runner] Recherche ${lead.name}: Kleinkram ist kein Aufhänger — verworfen`)
    mangel = ''
  }
  if (mangel && (!beleg || beleg.length < 4 || !gesamt.includes(beleg))) {
    console.log(`[runner] Recherche ${lead.name}: Mangel ohne Beleg verworfen — „${mangel.slice(0, 80)}"`)
    mangel = ''
  }

  const passt = b.json.passt_zur_person !== false
  return {
    lead,
    destillat: {
      firma,
      website: passt ? s.endUrl : '',
      sicher: passt,
      erreichbar: 'ja',
      taetigkeit,
      eigentuemer_bereich: String(b.json.eigentuemer_bereich ?? ''),
      bewertung: String(b.json.bewertung ?? ''),
      ausrichtung: String(b.json.ausrichtung ?? ''),
      optik: String(b.json.optik ?? ''),
      inhalt: String(b.json.inhalt ?? ''),
      /**
       * Gesamteindruck, Stärke und Elefant (16.09.2026, Kevins zweite Runde):
       * *„Diese Nachricht wäre gut für jemanden, der eine richtig gute Seite
       * hat, wo nur das für die Eigentümer fehlt. Wenn wir sie jemandem
       * schicken, dessen Seite aussieht wie aus dem Jahr 2000, sagt der: ja,
       * das fehlt, aber meine Seite ist eh Schmutz."* Der Befund muss den
       * Punkt treffen, der die Anfragen kostet — gut, schlecht, gut.
       */
      gesamteindruck: String(b.json.gesamteindruck ?? ''),
      zeitgemaess: String(b.json.zeitgemaess ?? ''),
      menschen_sichtbar: b.json.menschen_sichtbar === true,
      kundenstimmen: b.json.kundenstimmen === true,
      referenzen: b.json.referenzen === true,
      hero_klar: b.json.hero_klar === true,
      zielgruppe: String(b.json.zielgruppe ?? ''),
      staerke: String(b.json.staerke ?? ''),
      elefant_typ: String(b.json.elefant_typ ?? ''),
      elefant: String(b.json.elefant ?? ''),
      checkliste: s.checkliste ?? null,
      mangel,
      befund: String(b.json.befund ?? ''),
      nur_portal: false,
    },
    kosten,
    token,
    grund: null,
  }
}

/**
 * Alle Leads eines Batches recherchieren — höchstens `GLEICHZEITIG` auf einmal.
 *
 * Gibt die Leads ZURÜCK, angereichert um `recherche`. Ein Lead ohne Ergebnis
 * fällt nicht raus: „keine Website gefunden" ist ein Aufhänger, kein Grund zum
 * Überspringen.
 */
export async function rechercheLeads(leads, { melde = () => {}, cliPath = process.env.PATH ?? '', cwd } = {}) {
  const ergebnisse = new Array(leads.length)
  const ordner = join(tmpdir(), 'uriel-recherche', new Date().toISOString().slice(0, 10))
  await mkdir(ordner, { recursive: true })
  const browser = await starteBrowser()
  let naechster = 0
  let fertig = 0
  let token = 0
  let kosten = 0

  async function arbeiter() {
    while (naechster < leads.length) {
      const i = naechster++
      let r
      try {
        r = await rechercheEinen(leads[i], { cliPath, cwd, browser, ordner })
      } catch (e) {
        r = { lead: leads[i], destillat: null, kosten: 0, token: 0, grund: String(e?.message ?? e).slice(0, 160) }
      }
      token += r.token
      kosten += r.kosten ?? 0
      ergebnisse[i] = r
      fertig++
      melde(`${fertig} von ${leads.length} recherchiert`, fertig / leads.length)
    }
  }

  try {
    await Promise.all(Array.from({ length: Math.min(GLEICHZEITIG, leads.length) }, arbeiter))
  } finally {
    await browser.close().catch(() => {})
  }

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
