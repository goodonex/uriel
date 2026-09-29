/**
 * runner/linkedin/anreicherung.mjs — was ein Anruf braucht, aus der Website (29.09.2026).
 *
 * **Der Anlass.** Kevin will aus Uriel heraus telefonieren, eine Nummer nach
 * der anderen, in der Reihenfolge Hitze → Kaufkraft → Bedarf. Stand 29.09.:
 * keine einzige Nummer gespeichert, und 79 % der Leads auf Klasse C — nicht
 * weil sie schlecht sind, sondern weil Stufe 1 (`grundprofil.mjs`) das
 * Gründungsjahr, das Team und die Schwächen der Seite nie ausgewertet hat.
 * Diese Werte kamen bisher erst mit der Tiefenrecherche nach der Annahme.
 *
 * Kevin: *„Da bringt uns kein Modell irgendwas, sondern das muss einmal
 * ordentlich aufgesetzt sein."* Deshalb hier nur Code: drei einfache Abrufe je
 * Unternehmen (Startseite, Impressum, Team-Seite), keine Suche, kein Browser,
 * kein Modell, keine Kosten.
 *
 * Was herauskommt (alles in `leads.profil`, Nummer und Mail zusätzlich in
 * `leads.telefon` / `leads.email`):
 * - Telefon getrennt nach Handy und Festnetz, E-Mail (`kontaktdaten.mjs`)
 * - Gründungsjahr mit Beleg und Jahre am Markt (`gruendungAusText`)
 * - Teamgröße aus Team-Seite und Impressum
 * - Website-Signale → `website_signal` schwach | mittel | ordentlich
 *
 * `website_signal` ist bewusst NICHT `website_stufe`: Die Stufe urteilt die
 * Tiefenrecherche nach Augenschein, das Signal zählt nur Merkmale. Es darf
 * eine fehlende Stufe ergänzen, nie eine vorhandene überschreiben.
 */
import { gfNamenAusImpressum, eigentuemerLink, teamLink } from './seiteRendern.mjs'
import { gruendungAusText } from './leadProfil.mjs'
import { kontaktAusImpressum } from './kontaktdaten.mjs'

export const ANREICHERUNG_FASSUNG = 1
const ABRUF_TIMEOUT_MS = 12_000
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15'

export async function holeSeite(url) {
  const steuerung = new AbortController()
  const uhr = setTimeout(() => steuerung.abort(), ABRUF_TIMEOUT_MS)
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'de-DE,de' }, redirect: 'follow', signal: steuerung.signal })
    if (!res.ok) return { ok: false, status: res.status, html: '', url: res.url || url }
    return { ok: true, status: res.status, html: (await res.text()).slice(0, 800_000), url: res.url || url }
  } catch {
    return { ok: false, status: 0, html: '', url }
  } finally {
    clearTimeout(uhr)
  }
}

export function textAus(html) {
  return String(html ?? '')
    .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|li|h[1-6]|tr|section|address|footer|header)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&auml;/g, 'ä').replace(/&ouml;/g, 'ö').replace(/&uuml;/g, 'ü').replace(/&Auml;/g, 'Ä').replace(/&Ouml;/g, 'Ö').replace(/&Uuml;/g, 'Ü').replace(/&szlig;/g, 'ß')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim()
}

export function linksAus(html, basis) {
  const links = []
  for (const m of String(html ?? '').matchAll(/<a\b[^>]*href=["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    try {
      links.push({ href: new URL(m[1], basis).toString(), text: textAus(m[2]).slice(0, 80) })
    } catch {
      /* ungültiger Link */
    }
  }
  return links
}

const BAUKASTEN = /jimdo|wix\.com|wixstatic|webnode|site123|weebly|homepage-baukasten|1und1|ionos-mywebsite|strato-website|mywebsite-editor|beepworld|npage/i
const MAKLERSOFTWARE = /onoffice|flowfact|propstack|immoware24|estatepro|ivd24|immobilien-homepage|maklerhomepage|homepagemodule|justimmo|immonex|immo-cms/i
const STIMMEN = /kundenstimme|kundenmeinung|bewertungen|referenzen|erfahrungsbericht|testimonial|provenexpert|google-bewertung|was unsere kunden/i
const ROLLE = /gesch(ä|ae)ftsf(ü|ue)hrer(in)?|inhaber(in)?|immobilienmakler(in)?|immobilienberater(in)?|makler(in)?\b|assistenz|b(ü|ue)roleitung|vertrieb|immobilienkauf(frau|mann)|immobilienfachwirt(in)?|prokurist(in)?|kundenbetreuung|objektbetreuung|verwalter(in)?/gi

/**
 * Die Schwächen einer Startseite, die sich ohne Augenschein belegen lassen.
 * Punkte je Schwäche: nicht fürs Handy gebaut 3 · fast leer 3 / kaum Inhalt 2 ·
 * Copyright bis 2019 2 · Baukasten 1 · älteres System 1 · kein Eigentümer-Weg 1 ·
 * keine Kundenstimmen 1 · keine Team-Seite 1. Ab 4 → schwach, ab 2 → mittel.
 */
export function websiteSignale(html, { eigentuemerWeg, teamSeite, jetzt = new Date() } = {}) {
  const roh = String(html ?? '')
  const text = textAus(roh)
  const jahre = [...roh.matchAll(/(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–]\s*)?(19\d\d|20\d\d)/gi)].map((m) => Number(m[1])).filter((j) => j <= jetzt.getFullYear())
  const copyright = jahre.length ? Math.max(...jahre) : null
  const generator = (roh.match(/name=["']generator["'][^>]*content=["']([^"']+)/i) ?? [])[1] ?? ''
  const altesSystem =
    /joomla|typo3 cms [4-8]\b|drupal [5-7]\b/i.test(generator) ||
    /jquery[.-]?1\.\d/i.test(roh) || /<font\b/i.test(roh) || (roh.match(/<table\b/gi) ?? []).length > 5
  const s = {
    handy: /<meta[^>]+name=["']viewport["']/i.test(roh),
    copyright_jahr: copyright,
    baukasten: BAUKASTEN.test(roh),
    maklersoftware: MAKLERSOFTWARE.test(roh),
    altes_system: altesSystem,
    generator: generator.slice(0, 60),
    eigentuemer_weg: Boolean(eigentuemerWeg),
    team_seite: Boolean(teamSeite),
    kundenstimmen: STIMMEN.test(text),
    text_zeichen: text.length,
  }
  let schwaeche = 0
  const gruende = []
  const plus = (n, grund) => { schwaeche += n; gruende.push(grund) }
  if (!s.handy) plus(3, 'nicht fürs Handy gebaut')
  if (s.text_zeichen < 500) plus(3, 'fast leer')
  else if (s.text_zeichen < 1500) plus(2, 'kaum Inhalt')
  if (copyright && copyright <= 2019) plus(2, `Stand ${copyright}`)
  if (s.baukasten) plus(1, 'Baukasten')
  if (s.altes_system) plus(1, 'älteres System')
  if (!s.eigentuemer_weg) plus(1, 'kein Eigentümer-Weg')
  if (!s.kundenstimmen) plus(1, 'keine Kundenstimmen')
  if (!s.team_seite) plus(1, 'keine Team-Seite')
  const signal = schwaeche >= 4 ? 'schwach' : schwaeche >= 2 ? 'mittel' : 'ordentlich'
  return { signale: s, signal, schwaeche, gruende }
}

const NAME_ZEILE = /^(?:(?:dr|prof|dipl)\.?[-\s\w.]*\s)?[A-ZÄÖÜ][a-zäöüß]+(?:-[A-ZÄÖÜ][a-zäöüß]+)?(?:\s(?:von|van|de|zu)\b)?(?:\s[A-ZÄÖÜ][a-zäöüß]+(?:-[A-ZÄÖÜ][a-zäöüß]+)?){1,2}$/
const KEIN_NAME = /immobilien|gmbh|makler|team|kontakt|impressum|datenschutz|startseite|über|unser|leistung|verkauf|vermiet|bewert|angebot|objekt|home|menü|telefon|mail/i

/**
 * Teamgröße: verschiedene Personennamen auf der Team-Seite, die höchstens zwei
 * Zeilen neben einer Rolle stehen — nicht die Zahl der Rollenwörter (die zählte
 * bei einem Einzelmakler mit langer Über-mich-Seite 16). Mindestens die Zahl
 * der Geschäftsführer aus dem Impressum.
 */
export function teamGroesse(teamText, gfNamen = []) {
  const zeilen = String(teamText ?? '').split('\n').map((z) => z.trim()).filter(Boolean)
  const rolleBei = zeilen.map((z) => new RegExp(ROLLE.source, 'i').test(z))
  const namen = new Set()
  zeilen.forEach((z, i) => {
    if (z.length > 45 || !NAME_ZEILE.test(z) || KEIN_NAME.test(z)) return
    if (rolleBei.slice(Math.max(0, i - 2), i + 3).some(Boolean)) namen.add(z.toLowerCase())
  })
  const n = Math.max(namen.size, gfNamen.length)
  return n > 0 ? Math.min(n, 60) : null
}

/**
 * Ein Unternehmen anreichern. `website` wie in `profil.website`.
 * @returns {Promise<{ ok: boolean, felder: object }>}
 */
export async function reichereAn(website, { hole = holeSeite, jetzt = new Date() } = {}) {
  const domain = String(website ?? '').replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
  if (!domain) return { ok: false, felder: {} }
  let start = null
  for (const u of [`https://${domain}`, `https://www.${domain}`, `http://${domain}`]) {
    start = await hole(u)
    if (start.ok) break
  }
  const stand = { anreicherung_at: jetzt.toISOString(), anreicherung_fassung: ANREICHERUNG_FASSUNG }
  if (!start?.ok) return { ok: false, felder: { ...stand, anreicherung_fehler: `Startseite ${start?.status ?? 0}` } }

  const links = linksAus(start.html, start.url)
  const impLink = links.find((l) => /impressum|imprint|legal notice|mentions l(é|e)gales/i.test(`${l.href} ${l.text}`))?.href ?? null
  const teamUrl = teamLink(links, start.url)
  const eigUrl = eigentuemerLink(links, start.url)
  const [imp, team] = await Promise.all([impLink ? hole(impLink) : null, teamUrl ? hole(teamUrl) : null])

  const startText = textAus(start.html)
  let impText = imp?.ok ? textAus(imp.html) : ''
  const ab = impText.search(/impressum|angaben gem|imprint/i)
  if (ab > 0) impText = impText.slice(ab)
  const teamText = team?.ok ? textAus(team.html) : ''

  // Nummer: Impressum zuerst, dann Startseite (Kopf- und Fußzeile tragen oft das Handy).
  const kImp = kontaktAusImpressum(impText, website)
  const kStart = kontaktAusImpressum(startText, website)
  const kTeam = kontaktAusImpressum(teamText, website)
  const mobil = kImp.telefon_mobil ?? kStart.telefon_mobil ?? kTeam.telefon_mobil ?? null
  const fest = kImp.telefon_fest ?? kStart.telefon_fest ?? null
  const alle = [...new Set([...kImp.telefon_alle, ...kStart.telefon_alle, ...kTeam.telefon_alle])].slice(0, 6)
  const email = kImp.email ?? kStart.email ?? null

  const gfNamen = impText ? gfNamenAusImpressum(impText.slice(0, 4000)) : []
  const g = gruendungAusText([startText, teamText, impText], jetzt)
  const w = websiteSignale(start.html, { eigentuemerWeg: eigUrl, teamSeite: teamUrl, jetzt })

  return {
    ok: true,
    felder: {
      ...stand,
      telefon_mobil: mobil,
      telefon_fest: fest,
      telefon_alle: alle,
      email_impressum: email,
      gruendungsjahr: g.jahr,
      gruendung_quelle: g.quelle,
      gruendung_beleg: g.beleg,
      jahre_am_markt: g.jahr ? jetzt.getFullYear() - g.jahr : null,
      team_personen: teamGroesse(teamText, gfNamen),
      team_seite: teamUrl,
      eigentuemer_seite: eigUrl,
      website_signal: w.signal,
      website_schwaeche: w.schwaeche,
      website_gruende: w.gruende,
      website_signale: w.signale,
    },
  }
}

/**
 * Anreicherung in ein bestehendes Profil mischen. Was die Tiefenrecherche
 * (Stufe 2) schon belegt hat, bleibt stehen: Gründungsjahr, Team, Stufe.
 */
export function mischeProfil(profil, felder) {
  const p = { ...(profil ?? {}) }
  for (const [k, v] of Object.entries(felder ?? {})) {
    if (['gruendungsjahr', 'gruendung_quelle', 'gruendung_beleg', 'jahre_am_markt', 'team_personen'].includes(k) && p[k] != null && p[k] !== '') continue
    p[k] = v
  }
  return p
}
