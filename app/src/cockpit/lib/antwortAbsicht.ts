/**
 * Will der Lead einen Termin — oder die Analyse? (06.10.2026)
 *
 * **Der Anlass.** Manuel Rees (Reco GmbH, Dresden) bekam von Kevin das
 * Gesprächsangebot „Haben Sie was dagegen, wenn wir zehn Minuten
 * telefonieren?" und antwortete am 02.10.: „Machen Sie gerne einen Termin mit
 * meiner Kollegin Sh@reco-immobilien.de". Der Thread trug in dem Moment einen
 * Stern, `scripts/leads-sync.ts` leitete daraus `loom_zugesagt` ab — und der
 * Termin-Wunsch stand in der Loom-Bauliste statt unter „Antworten". Dieselbe
 * Verwechslung im Bestand: Hartmut Schneider („ruf mich unter … an, ich sag
 * meiner Assistentin Bescheid") und Sven Sommerfeld (schickt auf „Schick mir
 * deine Nummer" seine Handynummer).
 *
 * **Die Unterscheidung, nach Kevins Angebot.**
 * - Bot Kevin die Analyse an („Hast du was dagegen, wenn ich sie dir
 *   rüberschicke?"), ist „schick mal", „ja bitte", „gerne zuschicken",
 *   „an mail@…" und ebenso „Nein, habe ich nicht" ein Ja zum Loom. Nur ein
 *   klarer Termin-Satz („ruf mich an", „Termin", eine Telefonnummer) OHNE
 *   Schick-Wunsch macht daraus einen Termin.
 * - Bot Kevin ein Gespräch an („…wenn wir zehn Minuten telefonieren?"), ist
 *   jede Zusage ein Ja zum Termin — auch „Nein" (Kevins CTA ist „Hast du was
 *   dagegen"), eine Nummer, eine Mailadresse oder der Verweis auf Kollegin
 *   oder Assistenz. Ein Loom wird es nur, wenn der Lead ausdrücklich etwas
 *   geschickt haben will.
 * - Unklares Angebot (Sprachnachricht, offene Frage): nur der Termin-Satz zählt.
 *
 * Reine Funktionen, keine React-Importe. Spiegel im Runner:
 * `runner/linkedin/antwortAbsicht.mjs` — `npx tsx scripts/verify-antwort-absicht.ts`
 * prüft beide gegen dieselben echten Fälle.
 */
import type { LinkedinThread } from '../../types/db'
import { verlaufVon } from './linkedinVerlauf'

export type KevinsAngebot = 'analyse' | 'gespraech' | null

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
function cta(text: string): string {
  const fragen = text.match(/[^.!?\n]*\?/g)
  return fragen && fragen.length ? fragen[fragen.length - 1] : ''
}

function angebotAus(text: string): KevinsAngebot {
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
/** Was die Regel braucht. Verlauf und Vorschau dürfen fehlen (Lead-Station kennt sie nicht immer). */
type ThreadText = Pick<LinkedinThread, 'last_from'> & Partial<Pick<LinkedinThread, 'verlauf' | 'preview'>>

function letzterWechsel(t: ThreadText): { lead: string; kevin: string } | null {
  const verlauf = verlaufVon({ verlauf: t.verlauf ?? [] })
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
  const lead: string[] = [verlauf[iLead].text]
  while (iKevin >= 0 && verlauf[iKevin].sender === 'them') lead.unshift(verlauf[iKevin--].text)
  const kevin = iKevin >= 0 ? verlauf[iKevin].text : ''
  return { lead: lead.join('\n'), kevin }
}

/** Was Kevin zuletzt angeboten hat, bevor der Lead antwortete. */
export function kevinsAngebot(t: ThreadText): KevinsAngebot {
  const w = letzterWechsel(t)
  return w ? angebotAus(w.kevin) : null
}

/**
 * Die Kernregel, auf Texten statt auf einem Thread — damit Verify und Runner
 * dieselben Fälle ohne Thread-Attrappe prüfen können.
 */
export function istTerminWunschText(kevin: string, lead: string): boolean {
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
export function istTerminWunsch(t: ThreadText): boolean {
  if (t.last_from !== 'them') return false
  const w = letzterWechsel(t)
  return w ? istTerminWunschText(w.kevin, w.lead) : false
}
