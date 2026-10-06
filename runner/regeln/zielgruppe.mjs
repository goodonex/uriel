/**
 * runner/regeln/zielgruppe.mjs — wer ist Kevins Kunde? (06.10.2026)
 *
 * Die eine Stelle für das Geschäftsmodell-Urteil der Erstnachrichten-Kette:
 * Die Recherche (`leadRecherche.mjs`) bekommt die Definitionen als Prompt-Text,
 * die Segment-Sperre (`segmentUrteil`) und der Prüfer-Schritt im Runner fragen
 * `immobilienInhaberMitMaklerHerkunft`. Bewusst NICHT im Ordner
 * `erstnachrichten/`: Dessen Hash ist die Regel-Fassung, und jede Änderung
 * dort ließe alle offenen Erstnachrichten neu schreiben.
 *
 * **Der Anlass.** Bekiri Djelal (B.I.G. Swiss Immo, CEO) wurde am 06.10.2026
 * ohne Kevins Blick aussortiert: „kein Makler: Inhaber/CEO zweier eigener
 * Firmen (Immo und Finance) seit 03/2024; vorher Teamleiter bei Betterhomes".
 * Betterhomes ist ein Schweizer Maklerhaus. Wer eine eigene Immobilienfirma
 * führt und vorher als Makler gearbeitet hat, ist genau Kevins Kunde — auch
 * wenn daneben eine Finanzfirma läuft. Kevin am 02.10.2026: *„Ich will auch
 * nicht, dass auch nur einer rausfallen kann, den wir eigentlich angehen
 * könnten."*
 */

/** Der Teil des Finden-Prompts, der `geschaeftsmodell` und `rolle` festlegt. */
export const GESCHAEFTSMODELL_REGEL = `- "geschaeftsmodell": genau einer von
  - "makler" — vermittelt Wohnimmobilien von Eigentümern (Verkauf/Vermietung), auch mit Verwaltung als Nebengeschäft. **Auch:** Inhaber, Gründer oder CEO einer eigenen Immobilienfirma, der vorher als Makler gearbeitet hat (Maklerhaus wie Betterhomes, Engel & Völkers, RE/MAX, von Poll, oder Makler/Teamleiter im Verkauf) — selbst wenn daneben eine Finanz- oder Finanzierungsfirma läuft und die Seite das Maklergeschäft nicht ausdrücklich nennt.
  - "projektentwickler" — kauft Grundstücke/Objekte, baut oder saniert und verkauft Einheiten (Bauträger, Aufteiler)
  - "hausverwaltung" — Verwaltung (WEG/Miet) ist das Hauptgeschäft
  - "investor" — Bestandshalter, Asset-/Fondsmanager, Family Office, Capital, Holding ohne Vertrieb an Endkunden
  - "sonstiges" — Bank, Berater, Gutachter, Institut, Software/KI, Coach, Agentur, Student/Werkstudent, alles andere
  Nach dem, was die Firma TUT, nicht nach Wörtern im Namen („Real Estate GmbH" kann alles sein). Im Zweifel zwischen "makler" und "sonstiges" bei einem Inhaber einer Immobilienfirma: "makler" — Kevin sieht den Text vor dem Versand ohnehin.`

/** Immobilienbezug in Firma, Tätigkeit oder Station. */
const IMMOBILIEN = /immo|immobil|real ?estate|realty|property|properties|makler|wohnbau|liegenschaft/i
/** Eigene Firma: Inhaber, Gründer, Geschäftsführung. */
const INHABER = /inhaber|gründer|gruender|founder|\bceo\b|geschäftsführ|geschaeftsfuehr|managing director|owner|selbstständig|selbststaendig|eigene[rn]? firm/i
/** Makler-Vergangenheit: der Beruf selbst oder ein bekanntes Maklerhaus. */
const MAKLER_HERKUNFT = /makler|immobilienberater|immobilienvermittl|betterhomes|engel ?(&|und) ?völkers|engel ?(&|und) ?voelkers|\be ?& ?v\b|re\/?max|von poll|sotheby|homeday|mcmakler|century ?21|neubau ?kompass|immowelt|verkaufsberater|sales agent|real estate agent|broker/i

/**
 * Inhaber einer Immobilienfirma mit Makler-Vergangenheit?
 *
 * Gelesen wird, was die Recherche liefert: `taetigkeit` (Halbsatz des
 * Modells), `firma`, `rolle` und die aktuellen `stationen`. Alle drei
 * Bedingungen müssen tragen — eine reine Finanzfirma ohne Immobilienbezug oder
 * ein Immobilien-Investor ohne Makler-Vergangenheit bleibt, was er war.
 */
export function immobilienInhaberMitMaklerHerkunft(recherche) {
  const r = recherche ?? {}
  const stationen = Array.isArray(r.stationen) ? r.stationen : []
  const stationText = stationen.map((s) => `${s?.rolle ?? ''} ${s?.firma ?? ''}`).join(' · ')
  const text = `${r.taetigkeit ?? ''} · ${r.firma ?? ''} · ${stationText}`

  const istInhaber =
    String(r.rolle ?? '').toLowerCase() === 'inhaber' ||
    INHABER.test(String(r.taetigkeit ?? '')) ||
    stationen.some((s) => s?.selbststaendig && IMMOBILIEN.test(`${s?.firma ?? ''} ${s?.rolle ?? ''}`))
  const immobilienFirma =
    IMMOBILIEN.test(String(r.firma ?? '')) ||
    IMMOBILIEN.test(String(r.taetigkeit ?? '')) ||
    stationen.some((s) => IMMOBILIEN.test(String(s?.firma ?? '')))
  return istInhaber && immobilienFirma && MAKLER_HERKUNFT.test(text)
}
