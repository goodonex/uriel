/**
 * runner/linkedin/seiteRendern.mjs — eine Makler-Website so öffnen, wie Kevin
 * sie sieht (16.09.2026).
 *
 * **Der Anlass.** Kevin ging die ersten sechs von 48 Erstnachrichten durch und
 * fand in vier davon Fehler, die er dem Lead ins Gesicht gesagt hätte:
 *
 * - „ich hab nach eurer Website gesucht und keine gefunden" an Tobias Jauck,
 *   Christopher Schmitt und Jan Barendsma — alle drei haben eine.
 * - „in den Statistik-Boxen stehen Nullen" bei immobilien-sis.com. Dort steht
 *   53 / 2.500+ / 2 / 150 %. Die Zahlen zählen per JavaScript hoch, sobald man
 *   hinscrollt; WebFetch liest das rohe HTML und sah die Startwerte.
 * - stierling-immobilien.de bekam „der Weg für Eigentümer ist klar aufgebaut".
 *   Die Seite ist fast leer und weiß — sichtbar nur im Browser, nicht im Text.
 *
 * Alle drei Fehlersorten haben dieselbe Wurzel: Die Recherche hat die Seite
 * nie GESEHEN. Dieses Modul öffnet sie in Kevins echtem Chrome (headless),
 * scrollt einmal durch, damit Zähler und Lazy-Loading durchlaufen, und liefert
 * zurück, was ein Besucher sieht: Text, Menü, Mail-Adressen, Screenshots.
 *
 * Kein Modell hier drin — das ist Handwerk und kostet nichts.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const SAFARI_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15'

const LADE_TIMEOUT_MS = 25_000

/**
 * Ein Browser für den ganzen Batch — je Seite nur ein frischer Kontext.
 *
 * `playwright-core` wird erst HIER geladen, nicht oben im Modul: `index.mjs`
 * importiert die Recherche beim Start. Fehlt das Paket (der Mini hat nach dem
 * Auto-Pull noch nicht installiert), soll nur diese Etappe laut scheitern —
 * nicht der ganze Runner beim Hochfahren. Ohne Browser gibt es bewusst KEINE
 * Recherche aus Rohtext mehr: genau die hat am 16.09. falsche Befunde erzeugt.
 */
export async function starteBrowser() {
  let chromium
  try {
    ;({ chromium } = await import('playwright-core'))
  } catch {
    throw new Error('Website-Recherche braucht playwright-core — im Uriel-Ordner `npm install` ausführen')
  }
  try {
    return await chromium.launch({ channel: 'chrome', headless: true })
  } catch (e) {
    throw new Error(`Website-Recherche braucht Google Chrome auf diesem Rechner (${String(e?.message ?? e).split('\n')[0].slice(0, 120)})`)
  }
}

/** Bis ganz unten scrollen, in Schritten — so feuern Zähler und Lazy-Bilder wie beim Menschen. */
async function durchscrollen(page) {
  await page.evaluate(async () => {
    const warte = (ms) => new Promise((r) => setTimeout(r, ms))
    let y = 0
    for (let i = 0; i < 40; i++) {
      y += Math.round(window.innerHeight * 0.8)
      window.scrollTo(0, y)
      await warte(250)
      if (y >= document.documentElement.scrollHeight) break
    }
    await warte(2500) // Zähler-Animationen laufen typischerweise 1–2 s
    /**
     * Hart nach oben, nicht weich (16.09.): Seiten mit `scroll-behavior: smooth`
     * waren beim Screenshot noch mitten im Zurückscrollen — der „oben"-Screenshot
     * von wohnwert-immobilienmakler-amberg.de war zu 80 % weiß, und daraus wird
     * im Befund schnell „wirkt leer".
     */
    document.documentElement.style.scrollBehavior = 'auto'
    document.body.style.scrollBehavior = 'auto'
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    await warte(1200)
  })
}

/** Was ein Besucher sieht, als schlichte Daten. */
async function lies(page) {
  return page.evaluate(() => {
    const sichtbar = (el) => {
      const s = getComputedStyle(el)
      const r = el.getBoundingClientRect()
      return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0
    }
    const links = [...document.querySelectorAll('a[href]')]
      .filter(sichtbar)
      .map((a) => ({ text: (a.innerText || a.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 60), href: a.href }))
      .filter((l) => l.text)
    const menue = [...document.querySelectorAll('nav a, header a')]
      .filter(sichtbar)
      .map((a) => (a.innerText || '').trim().replace(/\s+/g, ' '))
      .filter((t) => t && t.length < 40)
    const mails = [
      ...new Set([
        ...[...document.querySelectorAll('a[href^="mailto:"]')].map((a) => a.getAttribute('href').replace(/^mailto:/i, '').split('?')[0].toLowerCase()),
        ...(document.body.innerText.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g) ?? []).map((m) => m.toLowerCase()),
      ]),
    ]
    /**
     * Die Checkliste, soweit sie ohne Modell messbar ist (16.09.2026). Kevin:
     * „eine Checkliste haben — sind da Kundenstimmen drin, hat er ein
     * Hero-Bild, eine Animation, ein Bewertungstool …" Was sich zählen lässt,
     * zählt der Browser; was man sehen muss (wirkt die Seite zeitgemäß, sind
     * Menschen zu sehen), urteilt der Befund anhand der Screenshots.
     */
    const text = document.body.innerText
    const grosseBilder = [...document.images].filter((i) => {
      const r = i.getBoundingClientRect()
      return r.width >= 250 && r.height >= 150
    }).length
    const hintergrundBilder = [...document.querySelectorAll('section, header, div')]
      .slice(0, 1500)
      .filter((el) => /url\(/.test(getComputedStyle(el).backgroundImage) && el.getBoundingClientRect().width >= 600).length
    const animiert =
      Boolean(document.querySelector('[data-aos], [data-animate], [class*="animate"], [class*="wow "], [class*="reveal"], [data-scroll], video[autoplay]')) ||
      [...document.querySelectorAll('body *')].slice(0, 1500).some((el) => getComputedStyle(el).animationName !== 'none')
    const jahre = [...text.matchAll(/(?:©|copyright)\s*(?:\d{4}\s*[-–]\s*)?(\d{4})/gi)].map((m) => Number(m[1]))
    const checkliste = {
      grosse_bilder: grosseBilder + hintergrundBilder,
      video: Boolean(document.querySelector('video, iframe[src*="youtube"], iframe[src*="vimeo"]')),
      animation: animiert,
      kundenstimmen: /kundenstimme|kundenmeinung|erfahrungsbericht|rezension|das sagen unsere|google[- ]bewertung|provenexpert|sterne|testimonial/i.test(text),
      referenzen: /referenz|verkauft|erfolgreich vermittelt/i.test(text),
      bewertungs_tool: Boolean(document.querySelector('iframe[src*="bewert"], iframe[src*="wertermittl"], iframe[src*="pricehubble"], iframe[src*="sprengnetter"], iframe[src*="immowelt"], iframe[src*="homeday"], iframe[src*="leadfox"], iframe[src*="propstack"], iframe[src*="onoffice"]')),
      impressum: [...document.querySelectorAll('a')].some((a) => /impressum|imprint/i.test(a.innerText + a.href)),
      mobil_viewport: Boolean(document.querySelector('meta[name="viewport"]')),
      copyright_jahr: jahre.length ? Math.max(...jahre) : null,
      telefon_sichtbar: /(\+\d{2}|\b0\d{2,5})[\d\s/()-]{7,}/.test(text),
      whatsapp: /whatsapp|wa\.me/i.test(document.body.innerHTML),
    }
    return {
      checkliste,
      titel: document.title,
      text: document.body.innerText.replace(/\n{3,}/g, '\n\n').slice(0, 12_000),
      textLaenge: document.body.innerText.trim().length,
      hoehe: document.documentElement.scrollHeight,
      menue: [...new Set(menue)].slice(0, 30),
      links: links.slice(0, 120),
      // Auch unsichtbare Links: Unterseiten wie „Team" stecken oft in Ausklapp-Menüs (viventa.ch, 17.09.).
      alleLinks: [...document.querySelectorAll('a[href]')]
        .map((a) => ({ text: (a.textContent || a.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 60), href: a.href }))
        .filter((l) => l.text && !/^(#|javascript:|mailto:|tel:)/.test(l.href))
        .slice(0, 300),
      mails,
    }
  })
}

/**
 * Eine URL öffnen. Nie werfen — „lädt nicht" ist ein Befund, kein Fehler.
 *
 * @returns {Promise<{ url: string, erreichbar: 'ja'|'offline'|'download', grund?: string, endUrl?: string,
 *   titel?: string, text?: string, textLaenge?: number, menue?: string[], links?: {text:string,href:string}[],
 *   mails?: string[], screenshotOben?: string, screenshotGanz?: string }>}
 */
export async function rendereSeite(browser, url, { ordner, kuerzel }) {
  const ctx = await browser.newContext({
    userAgent: SAFARI_UA,
    viewport: { width: 1440, height: 900 },
    locale: 'de-DE',
    acceptDownloads: false,
    ignoreHTTPSErrors: false,
  })
  const page = await ctx.newPage()
  let download = false
  page.on('download', () => (download = true))
  try {
    let antwort
    try {
      antwort = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: LADE_TIMEOUT_MS })
    } catch (e) {
      // Ein Download statt einer Seite (Barendsma, 16.09.) meldet Chrome als abgebrochene Navigation.
      if (download || /download/i.test(String(e?.message))) return { url, erreichbar: 'download', grund: 'die Adresse startet einen Download statt einer Seite' }
      return { url, erreichbar: 'offline', grund: String(e?.message ?? e).split('\n')[0].slice(0, 160) }
    }
    if (download) return { url, erreichbar: 'download', grund: 'die Adresse startet einen Download statt einer Seite' }
    const status = antwort?.status() ?? 0
    if (status >= 400) return { url, erreichbar: 'offline', grund: `HTTP ${status}` }
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {})
    // Cookie-Banner verdecken sonst den halben Screenshot — ablehnen, wenn der Knopf eindeutig ist.
    await page
      .getByRole('button', { name: /^(ablehnen|alle ablehnen|nur notwendige|nur essenzielle|decline|reject all)$/i })
      .first()
      .click({ timeout: 1500 })
      .catch(() => {})
    await durchscrollen(page)
    /**
     * Scroll-Einblendungen sichtbar machen, bevor fotografiert wird (16.09.):
     * Der Ganzseiten-Screenshot zeigt Elemente, die erst beim Hinscrollen
     * einfaden, als leere Flächen. xania.ch sah dadurch „über weite Strecken
     * leer" aus — im Browser sind dort Projektbilder. Alles, was nach dem
     * Durchscrollen noch unsichtbar im Inhalt steht, wird eingeblendet;
     * fixierte Elemente (Menüs, Popups) bleiben, wie sie sind.
     */
    await page.addStyleTag({
      content:
        '[data-aos],[data-animate],[data-scroll],.wow,.elementor-invisible,[class*="reveal"],[class*="fade-in"],[class*="fadeIn"],[class*="animate__"]{opacity:1!important;visibility:visible!important;transform:none!important;animation:none!important}',
    }).catch(() => {})
    await page.evaluate(() => {
      for (const el of [...document.querySelectorAll('main *, section *, article *, body > div *')].slice(0, 4000)) {
        const st = getComputedStyle(el)
        if (st.position === 'fixed' || st.position === 'sticky') continue
        const r = el.getBoundingClientRect()
        if (r.height < 40 || r.width < 40) continue
        if (Number(st.opacity) < 0.05) {
          el.style.setProperty('opacity', '1', 'important')
          el.style.setProperty('transform', 'none', 'important')
        }
        if (st.visibility === 'hidden') el.style.setProperty('visibility', 'visible', 'important')
      }
    }).catch(() => {})
    await page.waitForTimeout(600)
    const daten = await lies(page)
    await mkdir(ordner, { recursive: true })
    const screenshotOben = join(ordner, `${kuerzel}-oben.jpg`)
    const screenshotGanz = join(ordner, `${kuerzel}-ganz.jpg`)
    await page.screenshot({ path: screenshotOben, type: 'jpeg', quality: 70 })
    /**
     * Ganze Seite, aber gedeckelt auf 7.500 px: Bilder über 8.000 px Kantenlänge
     * kann das Modell nicht lesen — beim ersten Lauf über 48 Leads (16.09.)
     * brachen genau die Befunde der langen Seiten ab.
     */
    const MAX_HOEHE = 7500
    await page.screenshot({ path: screenshotGanz, type: 'jpeg', quality: 55, fullPage: daten.hoehe <= MAX_HOEHE, clip: daten.hoehe > MAX_HOEHE ? { x: 0, y: 0, width: 1440, height: MAX_HOEHE } : undefined })
    return { url, erreichbar: 'ja', endUrl: page.url(), ...daten, screenshotOben, screenshotGanz }
  } finally {
    await ctx.close().catch(() => {})
  }
}

/**
 * Einen internen Link wählen — ohne Modell. `muster` ist eine Liste in
 * Vorrang-Reihenfolge: Der erste Ausdruck, der einen echten Link trifft,
 * gewinnt. Links, die nur auf die Seite selbst zeigen (`/#`, Ausklapp-Menüs),
 * zählen nicht — bei im-immobilien.ch war „Über uns" genau so ein Link, und
 * die Team-Seite daneben wurde nie geöffnet (17.09.2026).
 */
function internerLink(links, basis, muster) {
  let host = ''
  try {
    host = new URL(basis).hostname.replace(/^www\./, '')
  } catch {}
  const ohneAnker = (x) => String(x ?? '').split('#')[0].replace(/\/(index\.(php|html?))?$/, '')
  const echte = (links ?? []).filter((l) => {
    try {
      return new URL(l.href).hostname.replace(/^www\./, '') === host && ohneAnker(l.href) !== ohneAnker(basis)
    } catch {
      return false
    }
  })
  for (const m of [].concat(muster)) {
    const treffer = echte.find((l) => m.test(l.text) || m.test(new URL(l.href).pathname))
    if (treffer) return treffer.href
  }
  return null
}

/** Die Eigentümer-Unterseite aus den Links der Startseite wählen. */
export function eigentuemerLink(links, basis) {
  return internerLink(links, basis, /verkauf|bewert|wertermittl|eigent(ü|ue)mer|immobilie (verkaufen|bewerten)|marktwert|verkäufer|verkaeufer/i)
}

/**
 * Die Team-/Über-uns-Seite (17.09.2026). Kevin fand in drei Nachrichten „man
 * sieht nirgends ein Gesicht" — bei im-immobilien.ch und ethosimmo.ch stehen
 * die Gesichter auf der Über-uns-Seite, die nie geöffnet wurde. Wer über
 * Menschen und Vertrauen urteilt, muss diese Seite gesehen haben.
 */
export function teamLink(links, basis) {
  return internerLink(links, basis, [/team|ansprechpartner|köpfe|makler(innen)?$/i, /(über|ueber)[ -]?uns|about|wir sind/i, /unternehmen|profil/i])
}

/**
 * Wer entscheidet? Die Geschäftsführung steht im Impressum (17.09.2026):
 * Angestellte bekommen keine Analyse, Kevin vernetzt sich stattdessen mit der
 * Geschäftsführung — dafür braucht er die Namen.
 */
async function geschaeftsfuehrungAusImpressum(browser, links, basis, { ordner, kuerzel }) {
  const ziel = internerLink(links, basis, [/impressum|imprint|legal notice/i])
  if (!ziel) return ''
  const seite = await rendereSeite(browser, ziel, { ordner, kuerzel: `${kuerzel}-impressum` })
  const text = String(seite.text ?? '')
  const i = text.search(/geschäftsführ|geschaeftsfuehr|vertreten durch|vertretungsberechtigt|inhaber(in)?\b|vorstand|verwaltungsrat|managing director/i)
  return i >= 0 ? text.slice(i, i + 220).replace(/\s+/g, ' ').trim() : ''
}

/** Startseite + Eigentümer-Unterseite eines Kandidaten rendern und als Befund-Mappe ablegen. */
export async function rendereKandidat(browser, url, { ordner, kuerzel }) {
  const start = await rendereSeite(browser, url, { ordner, kuerzel })
  let unterseite = null
  let team = null
  if (start.erreichbar === 'ja') {
    const ziel = eigentuemerLink(start.alleLinks ?? start.links, start.endUrl ?? url)
    // Ein Anker auf derselben Seite (`/#bewertung`) ist keine Unterseite — sonst wird dieselbe Seite zweimal gelesen.
    const ohneAnker = (x) => String(x ?? '').split('#')[0].replace(/\/(index\.(php|html?))?$/, '')
    if (ziel && ohneAnker(ziel) !== ohneAnker(start.endUrl)) unterseite = await rendereSeite(browser, ziel, { ordner, kuerzel: `${kuerzel}-eigentuemer` })
    const teamZiel = teamLink(start.alleLinks ?? start.links, start.endUrl ?? url)
    if (teamZiel && ohneAnker(teamZiel) !== ohneAnker(start.endUrl) && ohneAnker(teamZiel) !== ohneAnker(ziel)) {
      team = await rendereSeite(browser, teamZiel, { ordner, kuerzel: `${kuerzel}-team` })
    }
  }
  const geschaeftsfuehrung =
    start.erreichbar === 'ja'
      ? await geschaeftsfuehrungAusImpressum(browser, start.alleLinks ?? start.links, start.endUrl ?? url, { ordner, kuerzel }).catch(() => '')
      : ''
  const mappe = { start, unterseite, team, geschaeftsfuehrung }
  await mkdir(ordner, { recursive: true })
  await writeFile(join(ordner, `${kuerzel}.json`), JSON.stringify(mappe, null, 2))
  return mappe
}
