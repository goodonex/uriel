/**
 * runner/linkedin/grundprofil.mjs — Lead-Bewertung Stufe 1 (24.09.2026).
 *
 * Kevin am 23.09.: *„Wenn ich die Leute angefragt habe, werden die direkt
 * kategorisiert, dass wir wissen, wem schicke ich zuerst eine Erstnachricht
 * … auch später für die Follow-ups, immer eine Reihenfolge … dass ich immer
 * sehe: diese 40 hier sind jetzt die besten, weil so und so."* Und am 24.09.:
 * *„Wir machen das auf jeden Fall gestuft."*
 *
 * **Stufe 1 (hier)** läuft für JEDEN Kontakt, auch für offene Anfragen, und
 * ist billig: fast alles ist Code und Abfragen, kein Modell.
 *
 * - Firma und Website: Google-Suche über DataForSEO (Bruchteile eines Cents),
 *   eindeutige Treffer entscheidet der Code, nur mehrdeutige ein günstiges
 *   Modell (`entscheide`, heute Haiku; Jev von TypeSafe, sobald Kevin Zugang
 *   hat — es kann genau diese Auswahl mit Sicherheitswert).
 * - Impressum: per einfachem Abruf, kein Browser. Bestätigt die Website
 *   (steht Firma oder Person drin?), liefert Rechtsform, Register, Ort und ob
 *   die Person Geschäftsführer ist.
 * - Google-Anzeigen (DataForSEO) und Meta-Anzeigen (Werbebibliothek im Browser).
 * - Markt aus dem Ort (`STAEDTE`).
 * - Punkte und Topf (`bewerte`) — eine feste Formel, die Kevin ändern kann.
 *
 * **LinkedIn-Profile werden hier NICHT besucht.** 2.000 automatische
 * Profilaufrufe riskieren eine Sperre von Kevins Konto. Die Firma kommt aus
 * Headline und Google-Suche; das Profil liest wie bisher erst die Recherche
 * der Erstnachricht, wenn jemand angenommen hat.
 *
 * **Stufe 2** ist die bestehende Recherche vor der Erstnachricht
 * (`leadRecherche.mjs`): echter Browser, Screenshots, Wow-Potenzial. Sie
 * ergänzt das Profil, `bewerte` rechnet dann mit allem.
 */
import { spawn } from 'node:child_process'
import { dataforseoZugang, domainAus, pruefeGoogleAds } from './googleAds.mjs'
import { gfNamenAusImpressum, pruefeMetaAds, firmaKern } from './seiteRendern.mjs'
import { personGleich } from './entscheider.mjs'
import { rechtsformAus, handelsregisterAus, bewerte } from './leadProfil.mjs'

const ABRUF_TIMEOUT_MS = 12_000
/**
 * Fassung der Stufe 1. Steigt, wenn sich das Finden der Website verbessert —
 * dann werden Kontakte, bei denen eine ältere Fassung keine Seite fand, von
 * selbst noch einmal bewertet (`bewertungLauf.mjs`). 2 = 24.09.2026, Werbesätze
 * in der Headline sind keine Firma mehr. 3 = 24.09.2026, erst die Firma allein
 * suchen, Firma aus dem LinkedIn-Suchtitel.
 */
export const STUFE1_FASSUNG = 3
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15'

/** Portale und Netzwerke sind keine eigene Website (dieselbe Liste wie in `leadRecherche.mjs`, ergänzt um Suchtreffer-Typisches). */
const PORTAL =
  /linkedin\.|xing\.|facebook\.|instagram\.|immobilienscout|immowelt|immonet|kleinanzeigen|openpr|pflumm|stilpunkte|northdata|firmenwissen|gelbeseiten|11880|google\.|provenexpert|homeday|wikipedia|youtube\.|tiktok\.|kununu|stepstone|indeed|dasoertliche|meinestadt|golocal|yelp|wlw\.|unternehmensregister|handelsregister|bundesanzeiger|companyhouse|moneyhouse|firmenabc|creditreform|immobilienmakler\.de|maklerempfehlung|immoverkauf24|makler-empfehlung|magazin|zeitung|news|presse|branchenbuch|fusionbase|investmentcheck|ecovis|dealmagazin|property-magazine|immobilien-zeitung|thomas-daily|haufe|focus\.de|spiegel|welt\.de|faz\.net|sueddeutsche|handelsblatt|xing-news|firmeneintrag|cylex|hotfrog|auskunft|telefonbuch/i

// ---------- Firma aus der Headline ----------

const ROLLEN = /\b(gesch(ä|ae)ftsf(ü|ue)hrer(in)?|inhaber(in)?|ceo|gr(ü|ue)nder(in)?|founder|co-?founder|managing director|immobilienmakler(in)?|makler(in)?|immobilienberater(in)?|vorstand|partner(in)?|owner|prokurist(in)?|leiter(in)?|head of)\b/gi
const FIRMA_ZEICHEN = /immobilien|real estate|gmbh|makler|immo|estate|property|properties|wohnbau|projekt|bau|ag\b|kg\b|& co/i

/**
 * Den Firmennamen aus einer LinkedIn-Headline ziehen — oder leer lassen.
 * Kevin am 21.09.: *„Die Firma steht in der Erfahrung, nicht in der
 * Headline."* Deshalb nur, was eindeutig nach Firma aussieht; im Zweifel
 * sucht Google mit dem Namen allein.
 */
/**
 * Ein Firmenname ist kurz und beginnt groß — kein Satz (24.09.2026, erster
 * Lauf auf dem Mini: „Interessierst du dich für Immobilien? Gerne tausche ich
 * mich …" und „Mehr exklusive Verkaufsaufträge durch Meta Ads als" wurden als
 * Firma gesucht, und die Hälfte der Kontakte blieb ohne Seite).
 */
function siehtAusWieFirma(t) {
  const w = String(t ?? '').trim()
  if (w.length < 3 || w.length > 60 || /[?!:]/.test(w)) return false
  if (w.split(/\s+/).length > 6) return false
  if (!/^[A-ZÄÖÜ0-9&]/.test(w)) return false
  if (/^(immobilien|real estate|makler|diplom|geprüft|zertifiziert|mehr|ich|wir|dein|ihr|gerne)\b/i.test(w)) return false
  // Berufsbezeichnungen in Großbuchstaben sind keine Firma („IMMOBILIENINVESTOR", Hallas, 24.09.).
  if (/^(immobilien)?(investor|makler|berater|experte|entwickler|gutachter|sachverst(ä|ae)ndiger)(in)?$/i.test(w)) return false
  return true
}

export function firmaAusHeadline(headline) {
  const h = String(headline ?? '').replace(/\s+/g, ' ').trim()
  if (!h) return ''
  const bei = h.match(/(?:\bbei\b|@|\bat\b)\s+([^|,·•/]+)/i)
  // Nur wenn danach ein Name kommt (Großbuchstabe/Ziffer) — „be great at what you do“ ist keine Firma.
  if (bei && siehtAusWieFirma(bei[1].replace(/\([^)]*\)/g, ' ').trim())) return bei[1].replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim().replace(/[.\s]+$/, '')
  for (const teil of h.split(/\s*[|·•/]\s*|\s+[–-]\s+/)) {
    if (!FIRMA_ZEICHEN.test(teil)) continue
    const ohneRolle = teil
      .replace(/\([^)]*\)/g, ' ')
      .replace(ROLLEN, '')
      .replace(/^\s*(der|die|des|von|für|fuer|&)\s+/i, '')
      .replace(/\s+/g, ' ')
      .trim()
    if (siehtAusWieFirma(ohneRolle)) return ohneRolle
  }
  return ''
}

/**
 * Die Firma aus dem Titel eines LinkedIn-Suchtreffers: „Uwe Hallas – PRIMONO
 * Unternehmensgruppe" (24.09.2026). Google zeigt dort die aktuelle Station —
 * ohne dass jemand das Profil aufruft.
 */
export function firmaAusLinkedinTreffer(treffer, name) {
  const nachname = ohneAkzent(name).split(/\s+/).pop() ?? ''
  for (const t of treffer) {
    if (!/linkedin\./i.test(t.domain)) continue
    const titel = String(t.titel ?? '').replace(/\s*[|·]\s*LinkedIn.*$/i, '')
    if (!ohneAkzent(titel).includes(nachname)) continue
    const m = titel.match(/\s[–-]\s+(.+)$/)
    const kandidat = m?.[1]?.split(/\s[|·]\s|\s[–-]\s/)[0]?.replace(/^[^\p{L}\p{N}]+/u, '').trim()
    if (kandidat && siehtAusWieFirma(kandidat)) return kandidat
  }
  return ''
}

// ---------- Google-Suche (DataForSEO) ----------

async function googleSuche(suchbegriff, { zugang = dataforseoZugang(), fetchFn = fetch } = {}) {
  if (!zugang) return { treffer: [], grund: 'DATAFORSEO fehlt' }
  const steuerung = new AbortController()
  const uhr = setTimeout(() => steuerung.abort(), 30_000)
  try {
    const res = await fetchFn('https://api.dataforseo.com/v3/serp/google/organic/live/regular', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${zugang.login}:${zugang.passwort}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([{ keyword: suchbegriff, location_code: 2276, language_code: 'de', depth: 10 }]),
      signal: steuerung.signal,
    })
    if (!res.ok) return { treffer: [], grund: `HTTP ${res.status}` }
    const j = await res.json()
    const items = j?.tasks?.[0]?.result?.[0]?.items ?? []
    return {
      treffer: items
        .filter((i) => i?.type === 'organic' && i.url)
        .map((i) => ({ url: i.url, domain: String(i.domain ?? '').replace(/^www\./, ''), titel: String(i.title ?? ''), text: String(i.description ?? '') })),
      grund: '',
    }
  } catch (e) {
    return { treffer: [], grund: String(e?.message ?? e).slice(0, 80) }
  } finally {
    clearTimeout(uhr)
  }
}

const ohneAkzent = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const UNWICHTIG = /^(immobilien|gmbh|real|estate|makler|group|gruppe|consulting|partner)$/
/**
 * Wörter für den Domain-Abgleich — mit beiden Umlaut-Schreibweisen
 * (24.09.2026: „Möllerherm" steht als moellerherm.de im Netz).
 */
const woerter = (t) => {
  const roh = String(t ?? '').toLowerCase().replace(/ß/g, 'ss')
  const mitE = roh.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
  const out = new Set()
  for (const v of [ohneAkzent(roh), ohneAkzent(mitE)]) for (const w of v.split(/[^a-z0-9]+/)) if (w.length >= 4 && !UNWICHTIG.test(w)) out.add(w)
  return [...out]
}

/**
 * Welche Domains aus den Treffern kommen in Frage — und wie stark passen sie?
 * Reine Funktion (`scripts/verify-lead-bewertung.ts`).
 */
export function kandidatenAus(treffer, { name, firma }) {
  const nachname = woerter(name).pop() ?? ''
  const firmaWorte = woerter(firma)
  const gesehen = new Map()
  for (const t of treffer) {
    if (!t.domain || PORTAL.test(t.domain) || PORTAL.test(t.url)) continue
    const d = ohneAkzent(t.domain).replace(/-/g, '')
    const passt = (firmaWorte.some((w) => d.includes(w)) ? 2 : 0) + (nachname && d.includes(nachname) ? 1 : 0)
    const alt = gesehen.get(t.domain)
    if (!alt || passt > alt.passt) gesehen.set(t.domain, { ...t, passt })
  }
  return [...gesehen.values()].slice(0, 5)
}

// ---------- Günstige Entscheidung (Haiku heute, Jev sobald Zugang) ----------

const ENTSCHEIDER_MODELL = process.env.BEWERTUNG_MODELL ?? 'claude-haiku-4-5'

/**
 * Eine Auswahl aus festen Optionen treffen, mit Sicherheit 0–1.
 *
 * Genau die Form, die Jev (TypeSafe, „System One") liefert: eine Wahl plus
 * Wahrscheinlichkeit, kein freier Text. Bis Kevin Zugang hat, macht es Haiku
 * mit derselben Schnittstelle — der Austausch betrifft nur diese Funktion.
 * Nie werfen: Ohne Antwort ist die Wahl `null`.
 *
 * @returns {Promise<{ wahl: number | null, sicherheit: number }>}
 */
export async function entscheide({ frage, optionen, kontext, cliPath = process.env.PATH ?? '', cwd = process.cwd() }) {
  const prompt =
    `${frage}\n\nKontext:\n${kontext}\n\nOptionen:\n${optionen.map((o, i) => `${i}: ${o}`).join('\n')}\n\n` +
    'Antworte NUR mit einem ```json-Block: {"wahl": <Nummer der Option>, "sicherheit": <0 bis 1>}'
  return new Promise((fertig) => {
    const proc = spawn(
      process.env.CLAUDE_BIN ?? 'claude',
      ['-p', prompt, '--output-format', 'json', '--model', ENTSCHEIDER_MODELL, '--allowedTools', 'Read', '--max-budget-usd', '0.05', '--setting-sources', 'project'],
      { cwd, env: { ...process.env, PATH: cliPath }, stdio: ['ignore', 'pipe', 'pipe'] },
    )
    let aus = ''
    proc.stdout.on('data', (c) => (aus += c))
    proc.stderr.on('data', () => {})
    const uhr = setTimeout(() => proc.kill('SIGKILL'), 60_000)
    const leer = { wahl: null, sicherheit: 0, kosten: 0 }
    proc.on('error', () => (clearTimeout(uhr), fertig(leer)))
    proc.on('close', () => {
      clearTimeout(uhr)
      try {
        const h = JSON.parse(aus)
        const m = [...String(h?.result ?? '').matchAll(/```json\s*([\s\S]*?)```/g)].pop()
        const j = JSON.parse(m?.[1] ?? '{}')
        const wahl = Number.isInteger(j.wahl) && j.wahl >= 0 && j.wahl < optionen.length ? j.wahl : null
        fertig({ wahl, sicherheit: Math.max(0, Math.min(1, Number(j.sicherheit) || 0)), kosten: Number(h?.total_cost_usd ?? 0) })
      } catch {
        fertig(leer)
      }
    })
  })
}

// ---------- Impressum per einfachem Abruf ----------

async function holeHtml(url) {
  const steuerung = new AbortController()
  const uhr = setTimeout(() => steuerung.abort(), ABRUF_TIMEOUT_MS)
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'de-DE,de' }, redirect: 'follow', signal: steuerung.signal })
    if (!res.ok) return { ok: false, status: res.status, html: '', url: res.url || url }
    return { ok: true, status: res.status, html: (await res.text()).slice(0, 800_000), url: res.url || url }
  } catch (e) {
    return { ok: false, status: 0, html: '', url, grund: String(e?.message ?? e).slice(0, 80) }
  } finally {
    clearTimeout(uhr)
  }
}

/** HTML → lesbarer Text mit Zeilenumbrüchen an Blockgrenzen. */
export function htmlZuText(html) {
  return String(html ?? '')
    .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|li|h[1-6]|tr|section|address)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&auml;/g, 'ä').replace(/&ouml;/g, 'ö').replace(/&uuml;/g, 'ü').replace(/&Auml;/g, 'Ä').replace(/&Ouml;/g, 'Ö').replace(/&Uuml;/g, 'Ü').replace(/&szlig;/g, 'ß')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim()
}

/** Link zum Impressum aus der Startseite. */
export function impressumLink(html, basis) {
  for (const m of String(html ?? '').matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = m[1]
    const text = htmlZuText(m[2])
    if (/impressum|imprint|legal notice|mentions l(é|e)gales/i.test(`${href} ${text}`)) {
      try {
        return new URL(href, basis).toString()
      } catch {
        /* ungültiger Link */
      }
    }
  }
  return ''
}

/** „80331 München" — die erste Postleitzahl mit Ort. CH/AT vierstellig. */
export function ortAus(text) {
  const m = String(text ?? '').match(/\b(?:D-|A-|CH-)?(\d{4,5})\s+([A-ZÄÖÜ][A-Za-zÄÖÜäöüß.\- ]{1,40}?)(?=\s*(?:\n|,|$|Tel|Telefon|Fon|E-?Mail|Deutschland|Germany|Schweiz|Österreich|Fax))/)
  return m ? { plz: m[1], ort: m[2].trim().replace(/\s+(am|an der|im|in|bei)$/i, '') } : { plz: '', ort: '' }
}

// ---------- Markt ----------

/**
 * Markt nach Ort. Metropolen: großer, teurer Markt mit vielen Eigentümern,
 * die verkaufen — ein Mandat bringt dort mehr (Kevin: *„München wird
 * wahrscheinlich besser sein als Dresden oder Leipzig"*). Großstädte ab rund
 * 150.000 Einwohnern. Alles andere zählt als Klein-/Mittelstadt.
 */
const METROPOLEN = ['münchen', 'hamburg', 'frankfurt', 'düsseldorf', 'stuttgart', 'köln', 'berlin', 'zürich', 'genf', 'genève', 'wien', 'basel', 'zug', 'starnberg', 'bad homburg', 'potsdam', 'freiburg', 'heidelberg', 'wiesbaden', 'luzern', 'salzburg', 'innsbruck', 'lausanne', 'bern']
const GROSSSTAEDTE = ['hannover', 'nürnberg', 'bremen', 'essen', 'dortmund', 'duisburg', 'bochum', 'wuppertal', 'bielefeld', 'bonn', 'münster', 'mannheim', 'karlsruhe', 'augsburg', 'aachen', 'mönchengladbach', 'gelsenkirchen', 'kiel', 'lübeck', 'magdeburg', 'erfurt', 'rostock', 'kassel', 'mainz', 'saarbrücken', 'oldenburg', 'regensburg', 'ingolstadt', 'würzburg', 'ulm', 'braunschweig', 'krefeld', 'halle', 'chemnitz', 'leipzig', 'dresden', 'darmstadt', 'offenbach', 'heilbronn', 'pforzheim', 'göttingen', 'wolfsburg', 'reutlingen', 'koblenz', 'trier', 'jena', 'erlangen', 'fürth', 'linz', 'graz', 'winterthur', 'st. gallen', 'lugano']

/**
 * Speckgürtel zählen zur Metropole (24.09.2026, Probelauf: HAKO Immobilien
 * sitzt in Haar bei München). Deutsche Postleitzahl-Bereiche, zweistellig:
 * München, Hamburg, Frankfurt/Rhein-Main, Stuttgart, Düsseldorf, Köln, Berlin.
 */
const METRO_PLZ = new Set(['80', '81', '82', '85', '20', '21', '22', '60', '61', '63', '65', '70', '71', '40', '41', '50', '51', '10', '12', '13', '14'])

export function marktFuer(ort, plz = '') {
  const o = String(ort ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
  if (/^\d{5}$/.test(String(plz)) && METRO_PLZ.has(String(plz).slice(0, 2))) return 'metropole'
  if (!o) return 'unbekannt'
  const trifft = (liste) => liste.some((s) => o === s || o.startsWith(`${s} `) || o.startsWith(`${s}-`) || o.startsWith(`${s} am`))
  if (trifft(METROPOLEN)) return 'metropole'
  if (trifft(GROSSSTAEDTE)) return 'grossstadt'
  return 'klein-mittel'
}

// ---------- Ein Kontakt ----------

/**
 * Das Grundprofil eines Kontakts. Nie werfen — was sich nicht belegen lässt,
 * bleibt leer, und leer zieht nach unten, nie ein geratenes Feld nach oben.
 *
 * @returns {Promise<{ profil: object, kosten: number }>}
 */
export async function grundprofil(kontakt, { browser, cliPath, cwd }) {
  /**
   * Suchreihenfolge (24.09.2026, zweiter Lauf auf dem Mini: 20 von 30 ohne
   * Seite). „Name + Firma" liefert Zeitungsartikel und LinkedIn, die
   * Firmenseite kaum („Max Beyer" Beyer Real Estate → deal-magazin,
   * property-magazine). Deshalb zuerst die Firma allein. Ist keine Firma
   * bekannt, erst nach der Person suchen und die Firma aus dem Titel des
   * LinkedIn-Treffers lesen, dann nach ihr.
   */
  let kosten = 0
  let firmaHinweis = firmaAusHeadline(kontakt.headline)
  let suchGrund = ''
  let kandidaten = []
  const suche = async (begriff) => {
    const r = await googleSuche(begriff)
    kosten += 0.002
    suchGrund ||= r.grund
    return r.treffer
  }
  if (!firmaHinweis) {
    const personTreffer = await suche(`"${kontakt.name}" Immobilien`)
    firmaHinweis = firmaAusLinkedinTreffer(personTreffer, kontakt.name)
    if (!firmaHinweis) kandidaten = kandidatenAus(personTreffer, { name: kontakt.name, firma: '' })
  }
  if (firmaHinweis) {
    kandidaten = kandidatenAus(await suche(firmaHinweis), { name: kontakt.name, firma: firmaHinweis })
    if (!kandidaten.some((k) => k.passt >= 2)) {
      const mitName = kandidatenAus(await suche(`"${kontakt.name}" ${firmaHinweis}`), { name: kontakt.name, firma: firmaHinweis })
      kandidaten = [...kandidaten, ...mitName.filter((m) => !kandidaten.some((k) => k.domain === m.domain))]
    }
  }

  let wahl = null
  let sicherheit = 0
  const stark = kandidaten.filter((k) => k.passt >= 2)
  if (stark.length === 1) {
    wahl = stark[0]
    sicherheit = 0.9
  } else if (kandidaten.length) {
    const e = await entscheide({
      frage: 'Welche dieser Websites gehört der Firma, bei der diese Person arbeitet? Wähle „keine", wenn keine sicher passt.',
      kontext: `Person: ${kontakt.name}\nLinkedIn-Headline: ${kontakt.headline ?? ''}`,
      optionen: [...kandidaten.map((k) => `${k.domain} — ${k.titel} — ${k.text.slice(0, 140)}`), 'keine'],
      cliPath,
      cwd,
    })
    kosten += e.kosten ?? 0
    if (e.wahl != null && e.wahl < kandidaten.length) {
      wahl = kandidaten[e.wahl]
      sicherheit = e.sicherheit
    }
  }

  const profil = {
    stufe1_at: new Date().toISOString(),
    stufe1_fassung: STUFE1_FASSUNG,
    linkedin_status: kontakt.status ?? '',
    eingeladen_at: kontakt.eingeladen_at ?? '',
    firma_hinweis: firmaHinweis,
    website: '',
    website_sicherheit: 0,
    such_grund: suchGrund,
  }

  let impText = ''
  if (wahl && sicherheit >= 0.6) {
    // Mit und ohne www, notfalls http — viele kleine Seiten hängen nur an einer Variante.
    let start = null
    for (const u of [`https://${wahl.domain}`, `https://www.${wahl.domain}`, `http://${wahl.domain}`]) {
      start = await holeHtml(u)
      if (start.ok) break
    }
    // 403/429/503 heißt „wehrt Abrufe ab", nicht „offline" — die Seite gibt es.
    profil.erreichbar = start.ok ? 'ja' : [401, 403, 406, 429, 503].includes(start.status) ? 'geschuetzt' : 'offline'
    if (start.ok) {
      const link = impressumLink(start.html, start.url)
      const imp = link ? await holeHtml(link) : null
      impText = imp?.ok ? htmlZuText(imp.html) : ''
      // Den Kopf des Impressums nehmen, nicht die Navigation davor.
      const ab = impText.search(/impressum|angaben gem|imprint/i)
      if (ab > 0) impText = impText.slice(ab)
    }
    // Bestätigt ist die Seite, wenn Person oder Firma im Impressum steht.
    const nachname = woerter(kontakt.name).pop() ?? ''
    const bestaetigt = Boolean(impText) && ((nachname && ohneAkzent(impText).includes(nachname)) || woerter(firmaHinweis).some((w) => ohneAkzent(impText).includes(w)))
    profil.impressum_gelesen = bestaetigt
    /**
     * Vom Modell gewählt, aber das Impressum nennt weder Person noch Firma →
     * verwerfen (24.09.2026, Probelauf: leere Headline, Haiku wählte mit 0,8
     * die Raiffeisen-Immobilienseite — daraus wäre „AG, Zürich" geworden).
     * Was der Code selbst eindeutig zugeordnet hat, bleibt.
     */
    const vomModell = !(wahl.passt >= 2)
    if (vomModell && !bestaetigt) {
      profil.erreichbar = 'unsicher'
      profil.website_verworfen = wahl.domain
      wahl = null
    }
  }

  if (wahl && sicherheit >= 0.6) {
    profil.website = `https://${wahl.domain}/`
    profil.website_sicherheit = profil.impressum_gelesen ? Math.max(sicherheit, 0.95) : sicherheit
    if (impText) {
      const kopf = impText.slice(0, 1500)
      const gfNamen = gfNamenAusImpressum(impText.slice(0, 4000))
      profil.rechtsform = rechtsformAus(firmaHinweis, kopf)
      profil.handelsregister = handelsregisterAus(impText)
      profil.impressum_gf = gfNamen
      profil.gf = gfNamen.some((n) => personGleich(n, kontakt.name)) ? 'gf' : gfNamen.length ? 'angestellt' : 'unklar'
      const { plz, ort } = ortAus(kopf)
      profil.plz = plz
      profil.ort = ort
      profil.markt = marktFuer(ort, plz)
    }
    const g = await pruefeGoogleAds(profil.website)
    kosten += 0.002
    Object.assign(profil, {
      google_ads_aktiv: g.google_ads_aktiv,
      google_ads_seit: g.google_ads_seit,
      google_ads_zuletzt: g.google_ads_zuletzt,
      google_ads_anzahl: g.google_ads_anzahl,
    })
  } else {
    profil.erreichbar = kandidaten.length ? 'unsicher' : ''
    profil.google_ads_aktiv = kandidaten.length ? 'unbekannt' : 'nein'
  }

  // Meta über den Firmennamen — geht auch ohne gefundene Website.
  const metaName = firmaHinweis || (wahl ? wahl.titel.split(/[|–-]/)[0].trim() : '')
  profil.meta_ads_aktiv = browser && firmaKern(metaName) ? await pruefeMetaAds(browser, metaName).catch(() => 'unbekannt') : 'unbekannt'
  profil.firma = firmaHinweis || metaName
  profil.markt ??= 'unbekannt'
  return { profil, kosten }
}

export { domainAus, bewerte }
