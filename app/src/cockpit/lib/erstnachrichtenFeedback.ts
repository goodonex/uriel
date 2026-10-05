/**
 * Kevins Feedback zu den Texten in der Stufe „Prüfen" (05.10.2026).
 *
 * Kevin: *„ich möchte gerne in das Feld Feedback schreiben, was dann in einer
 * Session ankommt, sodass eine Session direkt das ganze Feedback zu allen 25
 * bearbeiten, abändern und daraus lernen kann."*
 *
 * Gespeichert wird in `ui_settings` (ein Eintrag je Erstnachricht-ID), weil das
 * keine Schemaänderung braucht. Abgearbeitet wird es von
 * `scripts/erstnachrichten-feedback.ts` nach dem Skill
 * `.claude/skills/erstnachrichten-feedback/SKILL.md`.
 */

export const FEEDBACK_SCHLUESSEL = 'erstnachrichtenFeedback'

export type FeedbackSammlung = Record<string, { text: string; name: string; at: string }>

const SESSION_ORDNER = '/Users/kevin/Kevin OS/02 Projekte/uriel'

/** Kurz halten: Die Daten holt die Session selbst, der Link trägt nur den Auftrag. */
export function feedbackPrompt(anzahl: number): string {
  return [
    `Arbeite mein Feedback zu ${anzahl} Erstnachrichten aus der Uriel-Stufe „Prüfen" ab.`,
    ``,
    `Lies zuerst .claude/skills/erstnachrichten-feedback/SKILL.md und geh genau so vor:`,
    `Feedback holen, Texte neu schreiben, daraus Regeln ableiten, alles zurückschreiben.`,
  ].join('\n')
}

/** Deep-Link, der in der Claude-App eine neue Code-Session im Uriel-Ordner öffnet. */
export function feedbackLink(anzahl: number): string {
  const q = new URLSearchParams({ q: feedbackPrompt(anzahl), folder: SESSION_ORDNER })
  return `claude://code/new?${q.toString().replace(/\+/g, '%20')}`
}
