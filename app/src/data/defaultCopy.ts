/** Default Foundation-Copy pro Brand-Slug (localStorage-Seed + Migration). */

export const HERRMANN_POSITIONING_STATEMENT =
  'Herrmann & Co. baut digitale Präsenzen für Immobilienmakler und Projektentwickler — von der Marke bis zur Lead-Maschine. Websites, die verkaufen, und Systeme, die qualifizierte Anfragen automatisch liefern.'

export const HERRMANN_TONE_OF_VOICE =
  'Direkt, professionell, ohne Agentur-Blabla. Wir reden wie Unternehmer mit Unternehmern — konkret, lösungsorientiert, auf Augenhöhe.'

/** Erkennt den früheren Platzhalter aus Entwicklung / Smoke-Tests. */
export function isLegacyHerrmannPositioning(statement: string): boolean {
  return (
    statement.includes('Solo-Unternehmer') ||
    statement.includes('Multi-Brand-Setup') ||
    statement.includes('lernendes Betriebssystem')
  )
}
