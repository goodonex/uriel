/**
 * runner/regeln/textWache.mjs — die Satz-Wache für JEDEN Text an einen Lead (09.10.2026).
 *
 * Kevin, 09.10.2026: *„Ich habe keinen Bock, die nächsten Wochen immer wieder an
 * irgendeinem Fall zu kommen, den wir dann reparieren müssen."* Die meisten
 * Fehler dieser Woche standen längst als Regel im Prompt — „nie das
 * Bewertungstool" seit 23.09., „großer Player, andere Flughöhe" seit 08.10. —
 * und kamen trotzdem wieder. Ein Modell, das eine Regel „meistens" befolgt,
 * verbrennt bei 30 Texten am Tag jede Woche einen Lead.
 *
 * Darum prüft hier der Code jeden Text, egal aus welchem Pfad (Erstnachricht,
 * Nachfassen, Antwort, Follow-up), gegen die Behauptungen, die erwiesenermaßen
 * Leads kosten. Ein Treffer heißt nie „wegwerfen", sondern: diesen Satz neu
 * schreiben lassen, und wenn das nicht hilft, kommt der Lead im nächsten Lauf
 * wieder. Kevin sieht keinen Text, der hier hängen bleibt.
 *
 * Zwei Sorten Wachen:
 * - `immer` — gilt für jeden Lead (keine-Seite-Behauptung, Bewertungstool als
 *   Mangel, Kleinkram, Kapital-Unterstellung, „fake"-Stimmen, Geviertstrich).
 * - mit Lage (`lage.mjs`) — gilt nur, wenn bekannt ist, wer der Lead ist
 *   (Analyse an jemanden, der keine bekommt, Detailkritik an einer Seite, die
 *   als Ganzes das Problem ist, Werbe-Behauptung ohne Beleg, Eigentümer-Sprech
 *   an Verwaltungen, Du an jemanden, der siezt).
 *
 * Jede Wache ist an echten Sätzen geprüft: `scripts/verify-fallkatalog.ts`.
 */
import { behauptetKeineSeite } from '../linkedin/keineSeite.mjs'

/** Sätze eines Textes, ohne Anrede-Zeile. */
export function saetze(text) {
  return String(text ?? '')
    .split(/\n+/)
    .flatMap((zeile) => zeile.split(/(?<=[.!?])\s+(?=[A-ZÄÖÜ„"])/))
    .map((s) => s.trim())
    .filter(Boolean)
}

const NEGATIV = /\b(nur|erst|einzige[nrs]?|kein|keine[nmrs]?|nicht|nirgends|nirgendwo|fehlt|fehlen|ohne|statt|leer|ins leere|versteckt|landet|verlangt|muss man|musst du|wartet|warten)\b/i

/** Bewertungstool/Wertermittlung als Aufhänger — nie (Kevin, 23.09.2026; wieder 08.10. und 09.10.). */
const BEWERTUNG = /\b(bewertung\w*|wertermittlung\w*|wertrechner\w*|preisrechner\w*|preisfinder\w*|immobilienwert\w*|wert (deiner|ihrer|eurer|der) immobilie|was (ist )?(meine|ihre|deine) immobilie wert|sofort-?(wert|ergebnis|preis))\b/i

/** Was das Tool angeblich NICHT liefert — erst damit wird aus „Bewertung" ein Mangel-Satz. */
const BEWERTUNG_FOLGE = /(formular|e-?mail|\bmail\b|ergebnis|\bwert\b|zahl|sofort|ins leere|rückmeldung|stunden|klick|\bweiter\b|anruf|registrier|kontaktdaten|warten|wartet)/i
/** „Google-Bewertungen", „21 Bewertungen mit fünf Sternen" sind Rezensionen, kein Bewertungstool. */
const REZENSION = /(google-?bewertung\w*|kundenbewertung\w*|\bbewertungen\b[^.?!]{0,40}\b(sterne|google|kunden|lesen)|sterne\b)/i

/** Kleinkram, der niemanden zum Kunden macht (Kevin, 16.09. und 23.09.2026). */
const KLEINKRAM = /\b(tippfehler|rechtschreib\w*|copyright|©|ladezeit\w*|lädt (zu )?langsam|langsam lädt|cookie-?(banner|leiste|fenster|popup)\w*|meta-?(tag|beschreibung|description)\w*|quelltext|source-?code|alt-?text\w*|seitentitel|favicon|du\/sie|siezt und duzt|duzt und siezt)\b/i

/** Kapital unterstellen — „machst du das bei einem Baller, ist er raus" (Kevin, 08.10.2026). */
const KAPITAL = /\b(kapital (wieder )?(frei|verfügbar)|wenn (das |euer |dein |ihr )?(kapital|geld|budget) (wieder )?(frei|da)|kein (geld|budget|kapital)|budget (frei|übrig)|finanziell (eng|knapp|schwierig)|geld (fehlt|knapp))\b/i

/** Kundenstimmen als unecht abtun (Kevin, 05.10.2026, Bellevue Estates). */
const FAKE = /\b(fake|fiktiv\w*|erfunden\w*|gekauft\w*|ausgedacht\w*|unecht\w*)\b/i
const STIMMEN = /(stimme[n]?|bewertung\w*|rezension\w*|referenz\w*|testimonial\w*|kundenmeinung\w*|sterne)\b/i

/** Postfach-, Formular- und Kontaktwege-Kritik — bei großen Playern und schwachen Seiten nie der Hebel (Anzenberger, 05.10.2026). */
const POSTFACH = /\b(info@|postfach|zentrale|bewerbung|kontaktformular\w*|formular\w*|e-?mail-?adresse|mailadresse|generische[nr]? (adresse|mail))\b/i

/** Detail-Elemente einer Seite. Bei einer Seite, die als Ganzes nicht trägt, ist jede Detailkritik Kleinkram (Kevin, 09.10.2026). */
const DETAIL = /\b(formular\w*|button\w*|knopf|knöpfe|menüpunkt\w*|menü|kontaktseite|kontaktformular\w*|unterseite\w*|e-?mail|mail|ankerlink\w*|footer|bewertung\w*|wertrechner\w*|cta|call-to-action|telefonnummer|whatsapp|chat)\b/i

/** Das Analyse-Angebot. */
const ANALYSE = /\b(analyse|skizze|loom|video-?analyse)\b[^.?!]*\b(vorbereitet|rüberschick\w*|schick\w*|zeig\w*|mach\w*|erstell\w*)|\b(rüberschick\w*|schick\w*)\b[^.?!]*\banalyse\b/i

/** Werbe-Behauptungen. */
const KEINE_ANZEIGEN = /\b(keine|weder)\b[^.?!]{0,40}\b(anzeigen|werbung|ads|kampagnen)\b|\b(anzeigen|werbung|ads)\b[^.?!]{0,30}\b(schaltet ihr|schaltest du|laufen)\b[^.?!]{0,15}\b(nicht|keine)\b/i
const ANZEIGEN_JA = /\b(schaltet|schaltest|schalten)\b[^.?!]{0,40}\b(schon|bereits)\b[^.?!]{0,20}\b(anzeigen|werbung|ads)\b|\b(schon|bereits)\b[^.?!]{0,25}\b(anzeigen|werbung|ads)\b[^.?!]{0,10}\b(schaltet|schaltest|schalten|laufen)\b|\b(anzeigen|werbung|ads)\b[^.?!]{0,20}\b(laufen|läuft) (schon|bereits)\b/i

/** Eigentümer-Sprech, wo Eigentümer nicht die Zielgruppe sind. */
const EIGENTUEMER_ANFRAGEN = /\beigentümer-?anfragen\b|\bverkaufsmandat\w*\b|\beigentümer, die verkaufen\b/i

/** Du-Formen und Sie-Signale. */
const DU = /\b(du|dich|dir|dein\w*|euch|euer|eure\w*|hast du|bist du|schick mir)\b/i
const SIE_SIGNAL = /\b(sehr geehrte[rn]?|ihnen|herr herrmann|freundlichen grüßen|mit freundlichen)\b/i

/**
 * Abwertende Bilder über Seite oder Firma (Postmortem 09.10.2026): „wirkt wie eine
 * Vorlage, in die niemand eingezogen ist", „schräg". Design-Kritik bekommt die
 * meisten Antworten, aber fünf von sieben waren negativ. Kevins eigene Bilder
 * („zwei Jahrzehnte in die Zukunft schicken") bleiben erlaubt.
 */
const ABWERTEND = /\b(niemand eingezogen|schräg\w*|lieblos\w*|billig\w*|amateurhaft\w*|zusammengeklickt\w*|zusammengeschustert\w*|seelenlos\w*|peinlich\w*|gruselig\w*|grausam\w*|katastroph\w*|schrott\w*|unprofessionell\w*|dilettantisch\w*|stümperhaft\w*)\b/i

/** Geviertstrich im Text an den Lead. */
const GEVIERT = /—/

/**
 * Die Wachen. `lage` kommt aus `lageAus` (lage.mjs); fehlt sie, laufen nur die
 * `immer`-Wachen. `verlauf` sind die letzten Nachrichten des Gesprächs.
 */
export const WACHEN = [
  {
    id: 'keine-seite',
    grund: 'Behauptet, es gebe keine Website. Nie behaupten, nur fragen: „Wo finde ich euch?" (fünf verbrannte Leads, 08.10.2026)',
    pruefe: ({ text }) => {
      const t = behauptetKeineSeite(text)
      return t ? [t] : []
    },
  },
  {
    id: 'bewertung-als-mangel',
    grund: 'Bewertungstool/Wertrechner als Mangel. Nie der Aufhänger, auch nicht „nur per E-Mail" oder „kein Sofort-Wert" (Kevin, 23.09.2026)',
    pruefe: ({ text }) => saetze(text).filter((s) => BEWERTUNG.test(s) && NEGATIV.test(s) && BEWERTUNG_FOLGE.test(s) && !REZENSION.test(s)),
  },
  {
    id: 'kleinkram',
    grund: 'Kleinkram (Tippfehler, Copyright, Ladezeit, Cookie, Meta-Tags) macht niemanden zum Kunden (Kevin, 16.09.2026)',
    pruefe: ({ text }) => saetze(text).filter((s) => KLEINKRAM.test(s)),
  },
  {
    id: 'kapital-unterstellung',
    grund: 'Unterstellt fehlendes Geld oder Kapital. „Machst du das bei einem Baller, ist er raus." (Kevin, 08.10.2026)',
    pruefe: ({ text }) => saetze(text).filter((s) => KAPITAL.test(s)),
  },
  {
    id: 'stimmen-fake',
    grund: 'Nennt Kundenstimmen oder Bewertungen unecht (Kevin, 05.10.2026)',
    pruefe: ({ text }) => saetze(text).filter((s) => FAKE.test(s) && STIMMEN.test(s)),
  },
  {
    id: 'abwertend',
    grund: 'Abwertendes Bild über Seite oder Firma (schräg, lieblos, Vorlage, in die niemand eingezogen ist). Beobachtung statt Urteil',
    pruefe: ({ text }) => saetze(text).filter((s) => ABWERTEND.test(s)),
  },
  {
    id: 'geviertstrich',
    grund: 'Geviertstrich (—) im Text an den Lead',
    pruefe: ({ text }) => saetze(text).filter((s) => GEVIERT.test(s)),
  },
  {
    id: 'analyse-ohne-freigabe',
    grund: 'Bietet eine Analyse an, obwohl dieser Lead keine bekommt (großer Player, Verwaltung, Verbund, starke Seite, Nebenfirma, keine Seite). Erst den Pain erfragen',
    pruefe: ({ text, lage }) => (lage?.kanal && lage.kanal !== 'analyse' ? saetze(text).filter((s) => ANALYSE.test(s)) : []),
  },
  {
    id: 'grosser-player-kleinkritik',
    grund: 'Großer Player: Postfach, Formular oder Kontaktweg sind auf seiner Ebene kein Hebel. Frage nach dem, was dort zählt (Grundstücke, Investoren, Tempo, Team)',
    pruefe: ({ text, lage }) => (lage?.gewicht === 'gross' ? saetze(text).filter((s) => (POSTFACH.test(s) && NEGATIV.test(s)) || (BEWERTUNG.test(s) && NEGATIV.test(s) && !REZENSION.test(s))) : []),
  },
  {
    id: 'detailkritik-schwache-seite',
    grund: 'Die Seite ist als Ganzes schwach. Dann ist die Seite selbst der Elefant, nicht ein Formular, Knopf oder Menüpunkt (Kevin, 09.10.2026)',
    pruefe: ({ text, lage }) => {
      const schwach = lage?.website_stufe === 'schwach' || lage?.zeitgemaess === 'nein' || lage?.ansatz === 'seite-ist-das-thema'
      return schwach ? saetze(text).filter((s) => DETAIL.test(s) && NEGATIV.test(s)) : []
    },
  },
  {
    id: 'keine-anzeigen-ohne-beleg',
    grund: 'Behauptet „keine Anzeigen", obwohl Meta und Google nicht beide sicher „nein" sind',
    pruefe: ({ text, lage }) => {
      if (!lage) return []
      const beideNein = lage.meta_ads_aktiv === 'nein' && lage.google_ads_aktiv === 'nein'
      return beideNein ? [] : saetze(text).filter((s) => KEINE_ANZEIGEN.test(s))
    },
  },
  {
    id: 'anzeigen-ja-ohne-beleg',
    grund: 'Behauptet laufende Anzeigen, obwohl weder Meta noch Google „ja" sagen',
    pruefe: ({ text, lage }) => {
      if (!lage) return []
      const einJa = lage.meta_ads_aktiv === 'ja' || lage.google_ads_aktiv === 'ja'
      return einJa ? [] : saetze(text).filter((s) => ANZEIGEN_JA.test(s))
    },
  },
  {
    id: 'eigentuemer-falsche-zielgruppe',
    grund: 'Spricht von Eigentümer-Anfragen oder Verkaufsmandaten, aber der Lead verwaltet oder entwickelt (Verwaltung: neue Objekte zur Verwaltung, Entwickler: Käufer oder Grundstücke)',
    pruefe: ({ text, lage }) => (['hausverwaltung', 'projektentwickler'].includes(lage?.geschaeftsmodell) ? saetze(text).filter((s) => EIGENTUEMER_ANFRAGEN.test(s)) : []),
  },
  {
    id: 'du-an-sie-schreiber',
    grund: 'Der Lead siezt, der Text duzt. Register kommt vom Lead („Sehr geehrter Herr Herrmann" → Sie)',
    pruefe: ({ text, verlauf }) => {
      const vomLead = (Array.isArray(verlauf) ? verlauf : []).filter((m) => m?.sender === 'them' || m?.von === 'them')
      const letzte = vomLead[vomLead.length - 1]
      if (!letzte || !SIE_SIGNAL.test(String(letzte.text ?? ''))) return []
      return saetze(text).filter((s) => DU.test(s))
    },
  },
]

/**
 * Prüft einen Text. Leer = in Ordnung.
 *
 * @param {string} text
 * @param {{ lage?: object, verlauf?: object[] }} ctx
 * @returns {{ id: string, satz: string, grund: string }[]}
 */
export function pruefeText(text, { lage = null, verlauf = [] } = {}) {
  const funde = []
  for (const w of WACHEN) {
    for (const satz of w.pruefe({ text: String(text ?? ''), lage, verlauf })) {
      funde.push({ id: w.id, satz: String(satz).slice(0, 400), grund: w.grund })
    }
  }
  return funde
}

/** Für den Nachschreiber: dieselbe Form wie die Satz-Beanstandungen des Prüfers. */
export function alsBeanstandung(funde) {
  return funde.map((f) => ({ satz: f.satz, grund: f.grund })).slice(0, 5)
}
