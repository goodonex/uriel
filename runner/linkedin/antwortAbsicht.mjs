/**
 * runner/linkedin/antwortAbsicht.mjs — will der Lead einen Termin oder die
 * Analyse? (06.10.2026, Manuel Rees)
 *
 * Spiegel von `app/src/cockpit/lib/antwortAbsicht.ts` — dort steht die
 * Begründung. Der Runner hat kein Cockpit zur Hand, braucht die Regel aber für
 * die Nachtrunde: Ein Thread mit Stern galt dort als „wartet auf das Loom" und
 * bekam keinen Antwort-Entwurf, auch wenn der Lead um einen Termin bat.
 * `npx tsx scripts/verify-antwort-absicht.ts` prüft beide Fassungen gegen
 * dieselben Fälle; weicht eine ab, schlägt das Skript fehl.
 */

/** Spiegel von `verlaufVon` (app/src/cockpit/lib/linkedinVerlauf.ts). */
function verlaufVon(thread) {
  const roh = thread?.verlauf
  if (!Array.isArray(roh)) return []
  const out = []
  for (const e of roh) {
    if (!e || typeof e !== 'object') continue
    const text = typeof e.text === 'string' ? e.text.trim() : ''
    if (!text) continue
    const sender = e.sender === 'me' || e.sender === 'them' ? e.sender : 'unknown'
    out.push({ sender, text, ts: typeof e.ts === 'string' ? e.ts : null })
  }
  return out
}

/** Kevin bietet etwas zum Zuschicken an: Analyse, Skizze, Video, Ansätze. */
const ANALYSE = /analyse|skizze|loom|video|rüber ?schick|zusend|zuschick|ansätze/i
/** Kevin bietet ein Gespräch an. */
const GESPRAECH = /telefonier|\btelefon|anruf|\bruf\w* (ich )?(dich|sie|euch)\b|\bcall\b|termin|\bkalender|\bgespräch|\d+ minuten|wann passt|wann hast|wann haben|deine nummer|ihre nummer|kurz zeit/i

/** Der Lead will reden: Termin, Anruf, Nummer, Zeitfrage. */
const TERMIN_STARK = /termin|\bruf\w*\b[^.!?\n]{0,60}\ban\b|\banruf|telefon|handynummer|mobilnummer|\b(bin|sind)\b[^.!?\n]{0,30}\berreichbar|wann (hast|haben|hätten|hättest|passt|wäre|würde)|\bzeit (für|zum|zu) (einem|ein|nem|'?nem)? ?(gespräch|telefonat|call|austausch)|\bcall\b|\bzoom\b|ms teams|teams-call|google meet|calendly|kalender/i
/** Verweis an jemanden, der Termine macht — nur nach einem Gesprächsangebot ein Termin-Signal. */
const TERMIN_WEITERLEITUNG = /kolleg(in|e|en)|assisten(t|tin|z)|sekretariat|sekretärin|vorzimmer/i
/** Eine Telefonnummer: mindestens sieben Ziffern, Leer-, Schräg- und Bindestriche erlaubt. */
const TELEFONNUMMER = /(?:\+|\b0)\d[\d \t/-]{5,}\d/
/** Der Lead will etwas geschickt bekommen. */
const SCHICK_WUNSCH = /schick|send|zusend|zuschick|rüber|anschau|anseh|schau (ich|mir)|freu(e)? mich (auf|drauf)/i
/** Klare Absage — dann ist es weder Termin noch Loom. */
const ABSAGE = /kein (interesse|bedarf)|nicht interessiert|kein thema|keinen bedarf|nein,? danke|derzeit nicht|aktuell nicht|(wenig|keinen) sinn/i
/** Zusage auf eine „Hast du was dagegen"-Frage: Ja, gern, klar, Nein (= nichts dagegen), Daumen. */
const ZUSAGE = /\b(ja|gern|gerne|klar|ok|okay|passt|sicher|einverstanden|nein|machen|gut)\b|👍|@/i

/** Die Handlungsaufforderung: der letzte Fragesatz, sonst der ganze Text. */
function cta(text) {
  const fragen = text.match(/[^.!?\n]*\?/g)
  return fragen && fragen.length ? fragen[fragen.length - 1] : ''
}

function angebotAus(text) {
  const t = text.trim()
  if (!t || /^\[[^\]]+\]$/.test(t)) return null
  // Erst die Frage selbst: „Wann passt es dir diese Woche?" entscheidet, nicht
  // ein „rüberschicken" drei Sätze vorher.
  const frage = cta(t)
  if (frage) {
    if (ANALYSE.test(frage)) return 'analyse'
    if (GESPRAECH.test(frage)) return 'gespraech'
  }
  // Das Analyse-Angebot steht oft ohne Fragezeichen da („Ich schicke dir ein
  // Video, und nächste Woche telefonieren wir. Passt das?") und sticht dann.
  if (ANALYSE.test(t)) return 'analyse'
  // Ein Gesprächsangebot zählt nur in der Frage selbst — oder wenn es gar keine
  // gibt. „…prüfen online, bevor sie anrufen. Wo finde ich euch?" ist eine
  // Frage nach der Website, kein Angebot zu telefonieren (Danny Kremkau).
  if (!frage && GESPRAECH.test(t)) return 'gespraech'
  return null
}

/** Die letzte Nachricht des Leads und Kevins Nachricht direkt davor. */
function letzterWechsel(t) {
  const verlauf = verlaufVon(t)
  let iLead = -1
  for (let i = verlauf.length - 1; i >= 0; i--) {
    if (verlauf[i].sender === 'them' && verlauf[i].text.trim()) {
      iLead = i
      break
    }
  }
  if (iLead < 0) {
    // Kein Verlauf gespiegelt: die Vorschau ist die Nachricht des Leads.
    if (t.last_from === 'them' && t.preview?.trim()) return { lead: t.preview, kevin: '' }
    return null
  }
  // Mehrere Nachrichten des Leads hintereinander zählen zusammen.
  let iKevin = iLead - 1
  const lead = [verlauf[iLead].text]
  while (iKevin >= 0 && verlauf[iKevin].sender === 'them') lead.unshift(verlauf[iKevin--].text)
  const kevin = iKevin >= 0 ? verlauf[iKevin].text : ''
  return { lead: lead.join('\n'), kevin }
}

/** Was Kevin zuletzt angeboten hat, bevor der Lead antwortete. */
export function kevinsAngebot(t) {
  const w = letzterWechsel(t)
  return w ? angebotAus(w.kevin) : null
}

/**
 * Die Kernregel, auf Texten statt auf einem Thread — damit Verify und Runner
 * dieselben Fälle ohne Thread-Attrappe prüfen können.
 */
export function istTerminWunschText(kevin, lead) {
  const antwort = lead.trim()
  if (!antwort || ABSAGE.test(antwort)) return false
  const angebot = angebotAus(kevin)
  const stark = TERMIN_STARK.test(antwort) || TELEFONNUMMER.test(antwort)
  const schick = SCHICK_WUNSCH.test(antwort)

  if (angebot === 'gespraech') {
    if (stark || TERMIN_WEITERLEITUNG.test(antwort)) return true
    // „Schick mir lieber erst was" auf ein Gesprächsangebot ist ein Loom-Wunsch.
    if (schick) return false
    // Ein kurzes „Ja gerne" / „Nein" / 👍 ist die Zusage. In einem langen Text
    // steht „ja" oder „gut" irgendwo immer — dort zählt nur ein Termin-Satz.
    return antwort.length <= 120 && ZUSAGE.test(antwort)
  }
  // Analyse angeboten oder unklar: nur ein klarer Termin-Satz ohne Schick-Wunsch.
  if (angebot === 'analyse') return stark && !schick
  return stark || (TERMIN_WEITERLEITUNG.test(antwort) && !schick)
}

/**
 * Will der Lead mit seiner letzten Nachricht einen Termin / ein Gespräch?
 *
 * Wo das `true` ist, gilt weder der LinkedIn-Stern noch das daraus abgeleitete
 * `loom_zugesagt` als Ja zum Loom: Der Thread gehört unter „Antworten". Nur
 * Kevins eigener Klick „Loom ja" NACH dieser Nachricht stellt ihn in die
 * Loom-Spur.
 */
export function istTerminWunsch(t) {
  if (t.last_from !== 'them') return false
  const w = letzterWechsel(t)
  return w ? istTerminWunschText(w.kevin, w.lead) : false
}
