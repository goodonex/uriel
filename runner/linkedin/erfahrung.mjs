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

/** Nur die jüngsten Stationen zählen — Kevin schaut auf die letzten drei. */
const MAX_ZEICHEN = 900

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
 * @returns {Promise<string>} gekürzter Text der Erfahrung, `''` wenn nicht lesbar
 */
export async function leseErfahrung(profileUrl) {
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
  return erfahrungKuerzen(await auswerten(tab.webSocketDebuggerUrl, expr, 25_000))
}
