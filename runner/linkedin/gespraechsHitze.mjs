/**
 * runner/linkedin/gespraechsHitze.mjs — wie heiß ist ein Lead nach dem GESPRÄCH
 * (06.10.2026). `bewerte` (leadProfil.mjs) kennt nur Firma, Anzeigen und Seite.
 * Felix Range fragte im Januar nach dem Preis und stand trotzdem als
 * "C · Später · 33 Punkte". Die Hitze kommt deshalb aus dem Verlauf, ohne Modell.
 *
 * Stufen: `heiss` (will etwas haben: Preis, Analyse, Termin, Nummer),
 * `warm` (hat geantwortet, ohne klares Ja), `kalt` (hat abgelehnt),
 * `keine` (nie geantwortet).
 */
const PREIS = /\b(preis|kosten|kostet|honorar|angebot|investition|budget)\b|wie viel|wieviel/i
const JA = /schick|rüber|zuschick|gerne|gern\b|bitte|mach nur|ruf|anruf|telefon|termin|wann hast|nummer|\bklar\b|\bja\b|sehr gern|interessant|zeig/i
const NEIN = /kein interesse|nicht interessiert|bitte nicht|nein danke|abmelden|lass mich in ruhe|brauchen wir nicht/i

export function gespraechsHitze(verlauf, urteil, jetzt = new Date()) {
  const v = Array.isArray(verlauf) ? verlauf : []
  const them = v.filter((m) => m?.sender === 'them')
  if (!them.length) return { stufe: 'keine', grund: '', at: null }
  const letzte = them[them.length - 1]
  const alles = them.map((m) => m.text ?? '').join(' \n ')
  const tage = Math.max(0, Math.round((jetzt - new Date(letzte.ts)) / 86_400_000))
  if (NEIN.test(letzte.text ?? '')) return { stufe: 'kalt', grund: 'hat abgelehnt', at: letzte.ts }
  // Preis-Wörter zählen nur beim Urteil "lead": Akquise-Nachrichten Dritter (Dienstleister, die UNS etwas verkaufen) enthalten sie ständig.
  if (urteil === 'lead' && PREIS.test(alles)) return { stufe: 'heiss', grund: 'fragte nach dem Preis', at: letzte.ts, tage }
  if (urteil === 'lead' || JA.test(letzte.text ?? '')) return { stufe: urteil === 'lead' ? 'heiss' : 'warm', grund: urteil === 'lead' ? 'will die Analyse / das Gespräch' : 'hat geantwortet', at: letzte.ts, tage }
  return { stufe: 'warm', grund: 'hat geantwortet', at: letzte.ts, tage }
}
