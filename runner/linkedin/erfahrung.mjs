/**
 * runner/linkedin/erfahrung.mjs — den Abschnitt „Erfahrung" eines Profils lesen
 * (21.09.2026).
 *
 * **Der Anlass.** Die Recherche suchte die Website nur mit Name + Headline.
 * Die Headline ist oft ein Spruch („be great at what you do", „WERTE ERKENNEN.
 * POTENZIALE ENTFALTEN.", „Geschäftsführerin") — dann gab es nichts zu suchen,
 * und drei Leute bekamen „ich hab nach eurer Website gesucht und keine
 * gefunden". Kevin: *„ich gehe bei LinkedIn auf das Profil drauf und dann bei
 * den letzten drei Beschäftigungen. Da sieht man immer die Firma und dann
 * google ich die."* Berna Ayhan: Erfahrung nennt „A Group Real Estate GmbH",
 * die Seite ist der erste Treffer. Tim Brück: Erfahrung nennt Finais Consulting
 * (KI-Software) und Werkstudium — kein Makler, hätte nie einen Text bekommen
 * dürfen.
 *
 * **Wie.** Im Sync-Chrome (eingeloggt, Port 9222) wird in einem vorhandenen
 * LinkedIn-Tab ein unsichtbarer iframe auf `/in/<slug>/details/experience/`
 * geladen und sein sichtbarer Text gelesen. Kein Tab wird umgeleitet, keine
 * Liste gestört, rein lesend. Scheitert es (Chrome zu, Login-Wand), kommt
 * `''` zurück — die Recherche läuft dann wie bisher mit der Headline.
 */
const CDP = 'http://127.0.0.1:9222'

/**
 * Wie viel Text der Finden-Lauf bekommt. 900 reichten für „die oberste
 * Station" — nicht für alle aktuellen (22.09.2026): Philipp Hilgeland ist
 * Makler bei MAUS Immobilien UND Inhaber von drei eigenen Firmen, und die
 * standen hinter der Schnittkante. Die Stationen selbst kommen zusätzlich
 * strukturiert (`parseStationen`), der Text ist nur noch Kontext.
 */
const MAX_ZEICHEN = 1600

async function linkedinTab() {
  let liste = await (await fetch(`${CDP}/json`)).json()
  let tab = liste.find((t) => t.type === 'page' && /linkedin\.com/.test(t.url) && t.webSocketDebuggerUrl)
  if (tab) return tab
  await fetch(`${CDP}/json/new?https://www.linkedin.com/feed/`, { method: 'PUT' })
  for (let i = 0; i < 12; i++) {
    await new Promise((r) => setTimeout(r, 1000))
    liste = await (await fetch(`${CDP}/json`)).json()
    tab = liste.find((t) => t.type === 'page' && /linkedin\.com/.test(t.url) && t.webSocketDebuggerUrl)
    if (tab) return tab
  }
  return null
}

function auswerten(wsUrl, expression, timeoutMs) {
  return new Promise((resolve) => {
    const ws = new WebSocket(wsUrl)
    const timer = setTimeout(() => {
      try { ws.close() } catch {}
      resolve('')
    }, timeoutMs)
    ws.addEventListener('open', () =>
      ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression, returnByValue: true, awaitPromise: true } })),
    )
    ws.addEventListener('message', (ev) => {
      let msg
      try { msg = JSON.parse(ev.data) } catch { return }
      if (msg.id !== 1) return
      clearTimeout(timer)
      try { ws.close() } catch {}
      resolve(String(msg.result?.result?.value ?? ''))
    })
    ws.addEventListener('error', () => {
      clearTimeout(timer)
      resolve('')
    })
  })
}

/** Aus der Profil-URL den Pfad-Schlüssel ziehen (`/in/<slug>/`). */
export function profilSlug(profileUrl) {
  const m = String(profileUrl ?? '').match(/\/in\/([^/?#]+)/)
  return m ? m[1] : ''
}

/**
 * ---- Alle aktuellen Stationen als Liste (22.09.2026) ----
 *
 * **Der Anlass.** Kevins Feedback zu den Erstnachrichten: Struktur gut,
 * Recherche zu flach. Der Finden-Lauf sah nur die oberste Station — wer
 * nebenher eigene Firmen hat (Philipp Hilgeland: angestellt bei MAUS
 * Immobilien, Inhaber von CheckOut GmbH, Stulle & Meer Sylt, Flippi's Hüs
 * Sylt), bekam eine Nachricht, als wäre er nur Angestellter.
 *
 * **Wie.** Der Seitentext der Erfahrung, Zeile für Zeile. LinkedIn liefert
 * zwei Formen:
 * - einzeln: `Rolle` · `Firma · Vollzeit` · `Jan. 2020 – Heute · 4 J.`
 * - gruppiert (mehrere Rollen bei einer Firma): `Firma` · `Vollzeit · 5 J.` ·
 *   `Rolle` · (`Vollzeit`) · `Jan. 2020 – Heute · …`
 * Jede Zeile mit „– Heute" ist eine aktuelle Station; Rolle und Firma stehen
 * davor. LinkedIn schreibt viele Zeilen doppelt (sichtbar + für Screenreader,
 * dort als „bis Heute") — Dubletten fliegen vorher raus.
 *
 * Kein Modell: Das ist Handwerk. Der Finden-Lauf bekommt den Text trotzdem
 * weiter und darf die Liste ergänzen, falls LinkedIn das Format ändert.
 */
const ART = /^(vollzeit|teilzeit|selbstst(ä|a)ndig|freiberuflich|freiberufler(in)?|freelance|self-employed|full-time|part-time|praktikum|werkstudent(in)?|ausbildung|befristet|saisonal|ehrenamt(lich)?|nebenberuflich|minijob|internship|contract|apprenticeship)$/i
const DATUM = /^(?:[a-zäöü]{3,5}\.?\s+)?\d{4}\s*(?:–|—|-|bis)\s*(?:heute|present|today|(?:[a-zäöü]{3,5}\.?\s+)?\d{4})/i
const AKTUELL = /(?:–|—|-|bis)\s*(?:heute|present|today)\b/i
const DAUER = /^(?:[^·\d]{3,30}\s*·\s*)?\d+\s*(?:j\.|jahre?|mon\.|monate?|yrs?|mos?)(?=\s|$|·)/i
/** Sieht die Zeile nach Firma aus? Trennt „Rolle · Firma · Datum" nach einer Gruppe vom nächsten Gruppen-Eintrag. */
const FIRMENFORM = /\b(gmbh|ag|ug|kg|ohg|gbr|e\.\s?k\.?|se|mbh|ltd|inc|llc|holding|group|immobilien|real estate|properties|estate)\b/i
const SELBST_ART = /selbstst|freiberuf|self-employed|freelance/i
const SELBST_ROLLE = /inhaber|gr(ü|ue)nder|founder|owner|gesch(ä|ae)ftsf(ü|ue)hr|gesellschafter|\bceo\b|managing director|lizenzpartner|franchisenehmer|mitinhaber|unternehmer/i

/** Zeilen säubern: leer, Nullbreite, direkte Dubletten und die Screenreader-Fassung eines Datums raus. */
function zeilenVon(text) {
  const roh = String(text ?? '')
    .split(/Weitere Profile|Andere Profile|People also viewed/)[0]
    .split('\n')
    .map((z) => z.replace(/[\u200b\u200c\u200d\ufeff]/g, '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  const out = []
  for (const z of roh) {
    const vorher = out[out.length - 1]
    if (z === vorher) continue
    if (vorher && DATUM.test(vorher) && DATUM.test(z)) continue
    out.push(z)
  }
  // Die Überschrift „Erfahrung" ist keine Station.
  while (out.length && /^(erfahrung|experience)$/i.test(out[0])) out.shift()
  return out
}

/**
 * @param {string} text — sichtbarer Text von `/details/experience/`
 * @returns {{ firma: string, rolle: string, seit: string, selbststaendig: boolean }[]}
 */
export function parseStationen(text) {
  const z = zeilenVon(text)
  const stationen = []
  let gruppe = null
  for (let i = 0; i < z.length; i++) {
    const zeile = z[i]
    if (!DATUM.test(zeile) && zeile.length < 40 && DAUER.test(zeile) && i > 0 && !DATUM.test(z[i - 1])) {
      const art = zeile.includes('·') ? zeile.split('·')[0].trim() : ''
      gruppe = { firma: z[i - 1], art: ART.test(art) ? art : '' }
      continue
    }
    if (!DATUM.test(zeile)) continue
    let j = i - 1
    let art = ''
    if (j >= 0 && ART.test(z[j])) {
      art = z[j]
      j--
    }
    if (j < 0) continue
    const l = z[j]
    let firma = ''
    let rolle = ''
    const teile = l.split('·').map((t) => t.trim())
    if (teile.length >= 2 && ART.test(teile[teile.length - 1])) {
      // Einzeln, mit Anstellungsart: „Firma · Vollzeit"
      firma = teile.slice(0, -1).join(' · ')
      art = art || teile[teile.length - 1]
      rolle = j > 0 ? z[j - 1] : ''
      gruppe = null
    } else if (gruppe && !(FIRMENFORM.test(l) && !FIRMENFORM.test(z[j - 1] ?? ''))) {
      // Gruppiert: die Zeile vor dem Datum ist die Rolle, die Firma steht im Kopf.
      rolle = l
      firma = gruppe.firma
      art = art || gruppe.art
    } else {
      // Einzeln ohne Anstellungsart: „Rolle" · „Firma" · Datum
      firma = l
      rolle = j > 0 ? z[j - 1] : ''
    }
    if (!AKTUELL.test(zeile)) continue
    firma = firma.replace(/\s*·.*$/, '').trim()
    if (!firma || /^stealth/i.test(firma)) continue
    const seit = zeile.split(/\s*(?:–|—|-|bis)\s*/i)[0].trim()
    stationen.push({ firma, rolle: DATUM.test(rolle) || DAUER.test(rolle) ? '' : rolle, seit, selbststaendig: SELBST_ART.test(art) || SELBST_ROLLE.test(rolle) })
  }
  // Dieselbe Firma zweimal (zwei aktuelle Rollen in einer Gruppe) ist eine Station — die erste Rolle gewinnt.
  return stationen.filter((s, i, alle) => alle.findIndex((t) => t.firma.toLowerCase() === s.firma.toLowerCase()) === i).slice(0, 8)
}

/** Seitentext auf die Stationen kürzen: Empfehlungen und Fußzeile weg, Leerzeilen zu „ | ". */
export function erfahrungKuerzen(text) {
  return String(text ?? '')
    .split(/Weitere Profile|Andere Profile|People also viewed/)[0]
    .replace(/^\s*Erfahrung\s*/, '')
    .replace(/\n\s*\n+/g, ' | ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_ZEICHEN)
}

/**
 * @param {string} profileUrl
 * @returns {Promise<{ text: string, stationen: ReturnType<typeof parseStationen> }>}
 *   gekürzter Text der Erfahrung und alle aktuellen Stationen; leer, wenn nicht lesbar
 */
export async function leseErfahrung(profileUrl) {
  const roh = await leseErfahrungRoh(profileUrl)
  return { text: erfahrungKuerzen(roh), stationen: parseStationen(roh) }
}

/** Der ungekürzte Seitentext der Erfahrung, `''` wenn nicht lesbar. */
async function leseErfahrungRoh(profileUrl) {
  const slug = profilSlug(profileUrl)
  if (!slug) return ''
  let tab
  try {
    tab = await linkedinTab()
  } catch {
    return ''
  }
  if (!tab) return ''
  const pfad = JSON.stringify(`/in/${slug}/details/experience/`)
  const expr = `new Promise((fertig) => {
    const f = document.createElement('iframe');
    f.style.cssText = 'width:1200px;height:900px;position:fixed;left:-3000px;top:0';
    f.src = ${pfad};
    let n = 0;
    // Nicht auf onload warten: im Test am 21.09. blieb der Lauf bei 80 von 98 an einem iframe hängen, dessen onload nie kam.
    const uhr = setInterval(() => {
      n++;
      let tx = '';
      try { const m = f.contentDocument && f.contentDocument.querySelector('main'); tx = m ? m.innerText : ''; } catch (e) {}
      if ((tx.length > 200 && tx.includes('Erfahrung')) || n > 36) { clearInterval(uhr); f.remove(); fertig(tx); }
    }, 500);
    document.body.appendChild(f);
  })`
  return auswerten(tab.webSocketDebuggerUrl, expr, 25_000)
}
