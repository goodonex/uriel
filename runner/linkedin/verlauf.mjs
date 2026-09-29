/**
 * runner/linkedin/verlauf.mjs — Gesprächsverlauf aus dem Voyager-included-Array.
 *
 * Bisher hat sync.mjs pro Konversation alle Messages bis auf die neueste
 * weggeworfen (`preview`). Der Antwort-Entwürfe-Agent kennt das Gespräch damit
 * nicht — er sieht nur den letzten Satz. Diese Datei zieht aus DEMSELBEN
 * included-Array, das der Sync ohnehin schon geholt hat, die letzten Nachrichten
 * heraus. KEINE zusätzliche Voyager-Abfrage: rein lokale Auswertung.
 *
 * ACHTUNG — `verlaufAusMessages` wird per `.toString()` in den Seitenkontext von
 * linkedin.com injiziert (sync.mjs, buildSyncExpr). Deshalb muss sie
 * selbstgenügsam sein: keine Imports, keine Closure-Variablen, keine
 * Modul-Konstanten im Rumpf. Alles, was sie braucht, kommt über Parameter.
 * Genau deshalb steht sie hier eigenständig und ist per
 * `npx tsx scripts/verify-linkedin-verlauf.ts` gegen Fixtures prüfbar.
 */

/** Wie viele Nachrichten je Thread mitwandern. Kevins Vorgabe: die letzten ~10. */
export const VERLAUF_MAX = 10

/** Deckel je Nachricht — ein Roman im Thread soll die JSONB-Zeile nicht sprengen. */
export const VERLAUF_TEXT_MAX = 2000

/**
 * Die letzten `max` Nachrichten einer Konversation, chronologisch (älteste zuerst),
 * als `{ sender, text, ts }`. Chronologisch, weil der Agent das Gespräch von oben
 * nach unten liest — die Reihenfolge im included-Array ist nicht garantiert.
 *
 * @param {Array<Record<string, any>>} messages  alle Message-Objekte der Seite
 * @param {string} conversationUrn               `entityUrn` der Konversation
 * @param {(urn: string) => boolean} isSelf      erkennt Kevins eigene Teilnehmer-URNs
 * @param {number} [max]                         Standard 10
 * @param {number} [textMax]                     Standard 2000 Zeichen je Nachricht
 */
export function verlaufAusMessages(messages, conversationUrn, isSelf, max, textMax) {
  var grenzeAnzahl = max || 10
  var grenzeText = textMax || 2000
  var eigene = []
  var alle = messages || []
  for (var i = 0; i < alle.length; i++) {
    if (alle[i] && alle[i]['*conversation'] === conversationUrn) eigene.push(alle[i])
  }
  eigene.sort(function (a, b) {
    return (a.deliveredAt || 0) - (b.deliveredAt || 0)
  })

  var out = []
  for (var j = 0; j < eigene.length; j++) {
    var m = eigene[j]
    var roh = m.body && typeof m.body.text === 'string' ? m.body.text : ''
    var text = roh.trim()
    var medien = ''
    // Sprachnachricht, Bild, Datei ohne Text (29.09.2026): Bis heute fielen sie
    // hier raus. Hartmut antwortete mit so einer Nachricht — das Cockpit zeigte
    // eine leere Karte, der Agent schrieb „hat noch nicht geantwortet". Jetzt
    // steht ein Platzhalter da, damit beide sehen, DASS er geantwortet hat.
    // Systemzeilen ohne Inhalt bleiben draußen: Sie spielten dem Agenten nur
    // leere Sprecherwechsel vor.
    if (!text) {
      var inhalte = Array.isArray(m.renderContent) ? m.renderContent : Array.isArray(m.renderContentUnions) ? m.renderContentUnions : []
      var art = ''
      for (var k = 0; k < inhalte.length && !art; k++) {
        var rc = inhalte[k] || {}
        if (rc.audio) {
          art = '[Sprachnachricht]'
          // Der Link zur Audiodatei — daraus schreibt der Runner die Nachricht
          // ab (`sprachnachrichten.mjs`). Feldname nicht fest dokumentiert,
          // deshalb der erste https-Wert im Objekt als Rückfall.
          var a = rc.audio
          medien = (typeof a.url === 'string' && a.url) || (typeof a.downloadUrl === 'string' && a.downloadUrl) || ''
          if (!medien && typeof a === 'object') {
            for (var feld in a) {
              if (typeof a[feld] === 'string' && a[feld].indexOf('https://') === 0) { medien = a[feld]; break }
            }
          }
        }
        else if (rc.vectorImage || rc.image) art = '[Bild]'
        else if (rc.video) art = '[Video]'
        else if (rc.externalMedia) art = '[GIF]'
        else if (rc.file) art = rc.file.name ? '[Datei: ' + rc.file.name + ']' : '[Datei]'
        else if (rc.forwardedMessageContent) art = '[Weitergeleitete Nachricht]'
        else if (rc.videoMeeting) art = '[Einladung zum Videocall]'
      }
      if (!art && inhalte.length) art = '[Anhang ohne Text]'
      if (!art) continue
      text = art
    }
    if (text.length > grenzeText) text = text.slice(0, grenzeText) + ' …'

    // Ohne Absender wird NICHT geraten (gleiche Regel wie bei `last_from`).
    var sender = 'unknown'
    if (m['*sender']) sender = isSelf(m['*sender']) ? 'me' : 'them'

    var ts = null
    if (typeof m.deliveredAt === 'number' && isFinite(m.deliveredAt) && m.deliveredAt > 0) {
      var d = new Date(m.deliveredAt)
      ts = isNaN(d.getTime()) ? null : d.toISOString()
    }

    var eintrag = { sender: sender, text: text, ts: ts }
    if (medien) eintrag.medien_url = medien
    out.push(eintrag)
  }

  // Die NEUESTEN `max` — abschneiden am Anfang, nicht am Ende.
  return out.slice(-grenzeAnzahl)
}

/** Abgeschriebene Sprachnachricht: Platzhalter plus Text. */
export const SPRACH_PLATZHALTER = '[Sprachnachricht]'

/**
 * Abgeschriebene Sprachnachrichten überleben den nächsten Abgleich (29.09.2026).
 *
 * Der Sync liefert jedes Mal wieder nur den Platzhalter. Ohne diesen Abgleich
 * würde er den abgeschriebenen Text überschreiben — und die nächste Runde
 * dieselbe Nachricht erneut an Groq schicken. Zugeordnet wird über den
 * Zeitstempel, der je Nachricht fest ist.
 */
export function behalteTranskripte(neu, alt) {
  if (!Array.isArray(neu) || !Array.isArray(alt) || !alt.length) return neu
  const fertig = new Map()
  for (const e of alt) {
    if (e && e.ts && typeof e.text === 'string' && e.text.startsWith(SPRACH_PLATZHALTER + ' ')) fertig.set(e.ts, e.text)
  }
  if (!fertig.size) return neu
  return neu.map((e) => (e && e.text === SPRACH_PLATZHALTER && fertig.has(e.ts) ? { ...e, text: fertig.get(e.ts) } : e))
}
