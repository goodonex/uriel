/**
 * runner/linkedin/keineSeite.mjs — kein Text darf behaupten, es gebe keine Website (08.10.2026).
 *
 * Fünf Leads in zwei Tagen antworteten auf „ich hab nach eurer Website gesucht und
 * keine gefunden" mit „Dann hast du falsch gesucht" (Ariana Real Estate, Günes,
 * Beros & Partner, Offmarkly; ALCEMA hatten wir dreimal so angeschrieben). Kevin:
 * *„Ich will echt keine Leads mehr verbrennen."* Die Regel steht in
 * `regeln/erstnachrichten/schreiben.md` (Aufbau D/F) und in der Stimme. Diese Datei
 * ist die harte Sperre dahinter: Ein Text, der es trotzdem behauptet, kommt nicht in
 * Kevins Liste, sondern im nächsten Lauf neu.
 *
 * Erlaubt bleibt die Frage („Wo finde ich euch?", „Gibt es schon eine eigene Seite?")
 * und alles über eine Seite, die lädt, aber offline/abgelaufen ist (Aufbau C).
 */
const MUSTER = [
  /\b(website|webseite|seite|homepage|internetseite|auftritt)\b[^.?!\n]{0,60}\b(gesucht|gegoogelt)\b[^.?!\n]{0,40}\b(keine|nichts|nicht)\b/i,
  /\b(gesucht|gegoogelt)\b[^.?!\n]{0,40}\b(keine|nichts)\b[^.?!\n]{0,20}\b(gefunden|entdeckt)\b/i,
  /\bfinde(t)?\s+(ich|man)\b[^.?!\n]{0,40}\b(keine|nichts|keinen)\b/i,
  /\b(keine|keinen)\s+(eigene[nr]?\s+)?(website|webseite|seite|homepage|auftritt|online-auftritt)\b[^.?!\n]{0,30}\b(gefunden|finden|auffindbar)\b/i,
  /\bnicht\s+(auffindbar|zu finden)\b/i,
  /\b(googelt|sucht)\b[^.?!\n]{0,60}\blandet\b[^.?!\n]{0,60}\b(nicht bei|aber nicht|bei anderen|bei maklern)\b/i,
  /\bfindet sich\b[^.?!\n]{0,40}\b(keine|kein|nichts)\b/i,
  /\bnichts gefunden\b/i,
]

/** @returns {string} der beanstandete Satzteil oder '' */
export function behauptetKeineSeite(text) {
  const t = String(text ?? '')
  for (const m of MUSTER) {
    const treffer = t.match(m)
    if (treffer) return treffer[0]
  }
  return ''
}
