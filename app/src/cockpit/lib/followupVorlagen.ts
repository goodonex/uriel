import type { LinkedinThread } from '../../types/db'
import type { PostenEntwurf } from './prioritaet'

/**
 * Die drei festen Follow-up-Texte für Leads, die nie geantwortet haben.
 *
 * **Kevins Frage vom 25.08.2026, die das ausgelöst hat:** *„So ein kurzer
 * Follow-up muss doch nicht individuell gemacht werden. Reicht da nicht immer
 * derselbe Satz?"* — Er hat recht, und der Grund ist härter als gedacht: Bei
 * diesen Leuten gibt es **nichts zu individualisieren.** Sie haben auf die
 * Erstnachricht nie geantwortet, es existiert also kein Gesprächsverlauf, auf
 * den ein Agent eingehen könnte. Der einzige individuelle Anker wäre die
 * Headline — und die ist in der Erstnachricht bereits verbraucht. Ein Agent
 * produziert hier Pseudo-Individualität und kostet dafür Zeit und Token.
 *
 * Was das praktisch ändert: Am Morgen des 25.08. standen 177 fällige
 * Follow-ups ohne einen einzigen Entwurf. Ein Agent hätte davon zwanzig am Tag
 * bedient. Diese Datei bedient **alle**, sofort, ohne Lauf, ohne Latenz und
 * ohne Ausfallrisiko.
 *
 * **Diese Datei ist Kevins Stimme und keine Spielwiese.** Änderungen am Wortlaut
 * gehören vorher besprochen und danach in die Quelle der Wahrheit im Vault
 * (`03 Bereiche/Vertrieb & Outreach/Outbound-Skripte 1b`). Die Regeln aus dem
 * Skill `herrmann-outreach` gelten: keine Emojis, kein Weichspüler, CTA als
 * letzter Satz, und vor allem keine Rückzugsfloskeln („dann lass ich dich in
 * Ruhe", „du weißt ja, wo du mich findest") — Kevin ist der Anbieter, nicht
 * der Bittsteller.
 *
 * Reine Funktionen, keine React-Importe — prüfbar per
 * `npx tsx scripts/verify-followup-vorlagen.ts`.
 */

/**
 * Ein Text je Follow-up-Stufe, in der Reihenfolge von
 * `FOLLOWUP_THRESHOLDS_DAYS` (3 / 7 / 14 Tage). `[Vorname]` ist der einzige
 * Platzhalter.
 *
 * Der Aufbau folgt Kevins Kaskade: erst der harmlose Anstupser, dann ein
 * echter Befund, dann eine Frage.
 */
/**
 * Der eine Satz, mit dem die Analyse angeboten wird — wortgleich in jeder
 * Nachricht, über alle Kanäle (Erstnachricht, Follow-up, InMail).
 *
 * Zwei Gründe, und beide sind Kevins (10.09.2026):
 *
 * 1. Frame. „Darf ich sie dir schicken?" bittet um Erlaubnis und macht Kevin
 *    zum Bittsteller — dieselbe Position, die der Skill `herrmann-outreach`
 *    an anderer Stelle schon verbietet. Diese Frage setzt umgekehrt voraus,
 *    dass die Analyse kommt; der Lead müsste aktiv widersprechen.
 * 2. Messbarkeit. Solange jede Nachricht anders fragt, sagt eine Antwortquote
 *    nichts über den Befund davor aus, weil der CTA mitvariiert. Fixiert man
 *    ihn, ist er als Variable raus und alles andere wird vergleichbar.
 *
 * Der Satz davor muss die Analyse benennen, sonst hat „sie" keinen Bezug.
 */
export const ANALYSE_CTA = 'Hast du was dagegen, wenn ich sie dir einmal rüberschicke?'

export const FOLLOWUP_VORLAGEN: readonly string[] = [
  // Stufe 0 — drei Tage nach der Erstnachricht. Bewusst harmlos: Der
  // wahrscheinlichste Grund für das Schweigen ist nicht Ablehnung, sondern
  // dass die Nachricht untergegangen ist. Keine Entschuldigung, kein neuer
  // Pitch — nur nach oben holen und das Angebot wiederholen.
  `Moin [Vorname],

falls das untergegangen ist, hol ich es kurz hoch.

Ich nehme dir eine Analyse zu eurer Website auf, dreieinhalb Minuten, konkret auf die Eigentümer-Ansprache. ${ANALYSE_CTA}`,

  // Stufe 1 — eine Woche später. Hier steht ein Befund, der für praktisch jede
  // Maklerseite stimmt. Das ist der Trick dieser Stufe: Sie fühlt sich
  // individuell an, ohne es zu sein, weil die Beobachtung wirklich zutrifft.
  // Und sie ist eine Diagnose, kein weiterer Satz über Kevin (Experten-Frame).
  `Moin [Vorname],

eine Sache, die mir bei fast jeder Maklerseite auffällt: Sie ist für Käufer gebaut. Der Eigentümer, der überlegt zu verkaufen, findet darauf keinen einzigen Grund, genau euch anzurufen.

Darum geht es in der Analyse. ${ANALYSE_CTA}`,

  // Stufe 2 — die letzte Nachricht auf LinkedIn, aber ausdrücklich KEIN
  // Break-up: Danach geht es auf Instagram weiter (`leadStation.lauteKette`).
  // Ein Abschiedssatz wäre schlicht gelogen. Stattdessen eine einzelne Frage
  // mit minimalem Antwortaufwand, die zugleich qualifiziert.
  `Moin [Vorname],

mal anders gefragt: Kommen eure Eigentümer-Mandate über Empfehlung und Zufall, oder steht dahinter ein System?`,
]

/**
 * Der Buchungslink für das Vorgespräch (15 Minuten, Telefon).
 *
 * Steht als Konstante hier, weil er in mehreren Vorlagen auftaucht und sich
 * genau einmal ändern darf. Der zweite Termintyp (Konzeptgespräch, 45 Minuten,
 * Zoom) ist auf der Buchungsseite bewusst ausgeblendet und hat deshalb keinen
 * Link in einer Vorlage: Er wird im Vorgespräch live vereinbart.
 */
export const TERMIN_LINK = 'cal.com/kevin-herrmann/vorgespraech'

/**
 * Die Antwort auf ein „ja, schick rüber" — der Baustein, der bisher fehlte.
 *
 * Er existiert aus zwei Gründen. Erstens ist zwischen der Zusage und dem
 * fertigen Loom ohnehin eine Nacht: Die Demo-Seite wird über Nacht gebaut.
 * Diese Lücke wird benannt statt verschwiegen, sonst wartet der Lead ohne zu
 * wissen, worauf. Zweitens ist das der einzige Moment, in dem eine
 * E-Mail-Adresse ohne Widerstand rausrückt — der Lead hat gerade Ja gesagt.
 *
 * Kein „Moin [Vorname]" und kein Platzhalter: Das ist eine Antwort mitten im
 * Gespräch, und sie spiegelt die Länge seiner Zusage. Auf „Ja gerne" gehören
 * zwei Sätze, keine Anrede und kein Absatz.
 *
 * Der Grund für die Mail-Bitte nützt IHM (im Chat geht es unter), nicht Kevin.
 * Eine Bitte, deren Nutzen beim Absender liegt, wird abgelehnt.
 */
export const LOOM_ZUSAGE_VORLAGE = `Alles klar, kommt morgen zu dir.

Schick mir gerne noch deine E-Mail, dann schick ich sie dir zusätzlich per Mail — hier im Chat geht sowas schnell unter.`

/**
 * Die Nachricht, mit der das fertige Loom rausgeht.
 *
 * `[Loom-Link]` bleibt als Platzhalter stehen — er ist pro Lead verschieden und
 * entsteht erst beim Hochladen der Aufnahme. Alles andere ist fertig.
 *
 * Zwei Wege zum Termin nebeneinander sind hier ausdrücklich erlaubt, obwohl
 * zwei Bitten in einer Nachricht sonst dazu führen, dass keine erfüllt wird:
 * Buchen und Nummer-schicken führen zum selben Ziel, es konkurrieren also
 * nicht zwei Ziele, sondern zwei Wege. Wer nicht buchen mag, weil ihm ein
 * Kalender zu verbindlich ist, schickt die Nummer.
 */
export const LOOM_VERSAND_VORLAGE = `Moin [Vorname], hier ist deine Analyse: [Loom-Link]

Wenn du die Punkte einmal durchgehen willst: ${TERMIN_LINK}, such dir 15 Minuten aus. Oder schick mir deine Nummer und wann es dir passt, dann ruf ich dich an.`

/**
 * Der Lead hat das Video nachweislich gesehen (`lead_ereignisse.typ =
 * 'loom_angesehen'`, Migration 0079) und trotzdem nicht geantwortet.
 *
 * Ersetzt in dieser Lage die erste Stufe der Loom-Reihe. „Deine Analyse liegt
 * noch im Chat" wäre hier schlicht falsch — er hat sie gesehen, und eine
 * Nachricht, die das Gegenteil behauptet, sagt ihm, dass niemand hinschaut.
 *
 * Eine Frage, kein Pitch: Der Lead hat sich dreieinhalb Minuten genommen, also
 * ist die Analyse nicht das Problem. Und bewusst kein „danke für die Zeit" —
 * Kevin ist nicht dankbar, dass jemand sein Video anschaut.
 */
export const LOOM_GESICHTET_VORLAGE = `Moin [Vorname],

ich hab gesehen, dass du dir die Analyse angeschaut hast.

Welcher der Punkte war für dich der überraschendste?`

/**
 * Die Follow-up-Kaskade NACH dem Loom — eine eigene Reihe, und das ist der
 * eigentliche Punkt dieser Ergänzung.
 *
 * Bis hierher bekam jeder fällige Thread `FOLLOWUP_VORLAGEN`, auch wenn längst
 * ein Loom bei ihm liegt. Der Text dort lautet „Ich nehme dir eine Analyse auf
 * — hast du was dagegen, wenn ich sie dir einmal rüberschicke?". An jemanden,
 * der die Analyse seit vier Tagen im Chat hat, ist das nicht nur nutzlos,
 * sondern verrät, dass niemand hingeschaut hat.
 *
 * Reihenfolge und Kalkül:
 * - Stufe 0: das Video hochholen, mit einer Frist, die er zusagen kann.
 * - Stufe 1: der Tausch, der für IHN günstig ist — fünf Minuten am Telefon
 *   statt Video plus Terminsuche. Nebenbei kommt so die Handynummer rein, die
 *   im Impressum meist nicht steht (dort steht die Büronummer).
 * - Stufe 2: kein Break-up. „Du weißt ja, wo du mich findest" ist der tote
 *   Satz, den `verify-followup-vorlagen.ts` verbietet — danach meldet sich
 *   niemand. Stattdessen eine Frage mit minimalem Antwortaufwand, die
 *   zugleich qualifiziert.
 */
export const LOOM_FOLLOWUP_VORLAGEN: readonly string[] = [
  `Moin [Vorname],

deine Analyse liegt noch im Chat. Ich weiß, wie voll die Wochen gerade sind.

Die drei Punkte drin betreffen direkt deine Eigentümer-Ansprache, das Video dauert dreieinhalb Minuten. Schaffst du es diese Woche, kurz reinzuschauen?`,

  `Moin [Vorname],

wenn du gerade nicht dazu kommst, dir das Video anzuschauen: Ich gehe die drei Punkte in fünf Minuten am Telefon mit dir durch. Schick mir dafür einfach deine Nummer.`,

  `Moin [Vorname],

eine letzte Frage zur Analyse: Ist einer der drei Punkte bei euch schon in Arbeit, oder liegt das gerade alles hinten an?`,
]

/** Führende Titel, die vor dem Vornamen stehen können. */
const TITEL = /^(dr|prof|dipl|ing|mag|med|rer|nat|h\.?c)\.?$/i

/**
 * Den Vornamen aus dem LinkedIn-Namen lösen.
 *
 * Gibt `null` zurück, wenn nichts Brauchbares übrig bleibt. Das ist wichtiger
 * als es klingt: Im Bestand stehen Zeilen wie `--` und `BizBuilder`. „Moin --,"
 * ist schlimmer als gar kein Entwurf, weil Kevin es womöglich abschickt, ohne
 * hinzusehen. Lieber kein Text als ein peinlicher.
 */
export function vornameAus(name: string | null | undefined): string | null {
  const roh = String(name ?? '').replace(/\s+/g, ' ').trim()
  if (!roh) return null
  for (const teil of roh.split(' ')) {
    const sauber = teil.replace(/[.,;:]+$/, '')
    if (!sauber || TITEL.test(sauber)) continue
    // Mindestens zwei Zeichen und ein Buchstabe — sonst ist es Zierrat
    // (`--`, `|`, ein Emoji im Namensfeld) und kein Vorname.
    if (sauber.length < 2) continue
    if (!/\p{L}/u.test(sauber)) continue
    return sauber
  }
  return null
}

/**
 * Der fertige Follow-up-Text für diesen Thread — oder `undefined`, wenn keiner
 * passt.
 *
 * Kein Text gibt es in drei Fällen: kein brauchbarer Vorname, eine Stufe
 * jenseits der drei Vorlagen (ab Stufe 3 übernimmt die laute Kette mit anderen
 * Kanälen), oder eine unplausible Stufe.
 */
export function followupVorlage(
  thread: Pick<LinkedinThread, 'name' | 'followup_stage'> & Partial<Pick<LinkedinThread, 'loom_status'>>,
  gesichtet = false,
): PostenEntwurf | undefined {
  /**
   * Wer die Analyse schon hat, bekommt die Loom-Reihe — sonst würde ihm eine
   * Analyse angeboten, die seit Tagen in seinem Chat liegt. `loom_status` ist
   * optional, weil ältere Aufrufer die Spalte nicht mitgeben; fehlt sie,
   * gilt wie bisher die kalte Reihe.
   */
  const nachLoom = thread.loom_status === 'verschickt'
  const reihe = nachLoom ? LOOM_FOLLOWUP_VORLAGEN : FOLLOWUP_VORLAGEN
  const stufe = thread.followup_stage
  if (!Number.isInteger(stufe) || stufe < 0 || stufe >= reihe.length) return undefined
  const vorname = vornameAus(thread.name)
  if (!vorname) return undefined
  /**
   * Nur die erste Stufe kennt den Unterschied zwischen „liegt noch im Chat"
   * und „du hast es gesehen". Ab Stufe 1 ist die Frage nicht mehr, ob er das
   * Video kennt, sondern ob das Thema bei ihm überhaupt oben liegt — und da
   * ist der Text für beide derselbe.
   */
  const roh = nachLoom && gesichtet && stufe === 0 ? LOOM_GESICHTET_VORLAGE : reihe[stufe]
  return {
    text: roh.replaceAll('[Vorname]', vorname),
    // Eine Vorlage kann nicht veralten — sie nimmt auf nichts Bezug, was der
    // Lead gesagt hat. Genau das ist ihr Vorteil.
    veraltet: false,
    // Kein Zeitstempel: Der Text ist nicht „von gestern", er entsteht beim
    // Anzeigen. Eine Datumszeile darunter wäre eine Behauptung über nichts.
    erstelltAm: null,
  }
}


/**
 * Der Text für einen Lead, der Ja gesagt hat und auf sein Loom wartet.
 *
 * Hängt am Loom-Posten (`arbeitsmodusQuellen.loomPosten`), also genau an der
 * Stelle, an der Kevin diese Leute ohnehin abarbeitet. Vorher stand dort kein
 * Text — und ohne Text passiert nichts, das ist die Lehre aus den 177 fälligen
 * Follow-ups vom 25.08.2026.
 *
 * Braucht keinen Vornamen und kann deshalb nie `undefined` liefern: Die
 * Nachricht ist eine Antwort im laufenden Chat und trägt bewusst keine Anrede.
 */
export function loomZusageVorlage(): PostenEntwurf {
  return { text: LOOM_ZUSAGE_VORLAGE, veraltet: false, erstelltAm: null }
}

/**
 * Der Text, mit dem das fertige Loom rausgeht. `[Loom-Link]` bleibt stehen —
 * der Link entsteht erst beim Hochladen, und ein erfundener wäre schlimmer als
 * ein sichtbarer Platzhalter.
 */
export function loomVersandVorlage(
  thread: Pick<LinkedinThread, 'name'>,
): PostenEntwurf | undefined {
  const vorname = vornameAus(thread.name)
  if (!vorname) return undefined
  return { text: LOOM_VERSAND_VORLAGE.replaceAll('[Vorname]', vorname), veraltet: false, erstelltAm: null }
}
