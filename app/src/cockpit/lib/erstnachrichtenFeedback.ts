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

import { supabase } from '../../lib/supabase'

export const FEEDBACK_SCHLUESSEL = 'erstnachrichtenFeedback'

export interface FeedbackEintrag {
  text: string
  name: string
  at: string
  /** Schlüssel der Screenshot-Zeilen in `ui_settings`. */
  bilder?: string[]
}

export type FeedbackSammlung = Record<string, FeedbackEintrag>

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

/**
 * Screenshots zum Feedback (05.10.2026). Jedes Bild liegt als eigene Zeile in
 * `ui_settings` (`erstnachrichtenFeedbackBild:<id>`), damit die Feedback-Sammlung
 * klein bleibt und beim Öffnen der Liste nicht Megabytes mitlädt. Kein Bucket,
 * weil die bestehenden nur Projekt-Ordner zulassen.
 */
export const BILD_PREFIX = 'erstnachrichtenFeedbackBild:'

/** Verkleinert auf höchstens 1600 px Breite als JPEG — ein Screenshot landet so bei 100–300 KB. */
async function verkleinern(datei: Blob): Promise<string> {
  const bild = await createImageBitmap(datei)
  const faktor = Math.min(1, 1600 / bild.width)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bild.width * faktor)
  canvas.height = Math.round(bild.height * faktor)
  canvas.getContext('2d')!.drawImage(bild, 0, 0, canvas.width, canvas.height)
  bild.close()
  return canvas.toDataURL('image/jpeg', 0.82)
}

export async function bildSpeichern(datei: Blob): Promise<{ schluessel: string; vorschau: string } | null> {
  if (!supabase) return null
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return null
  const vorschau = await verkleinern(datei)
  const schluessel = `${BILD_PREFIX}${crypto.randomUUID()}`
  const { error } = await supabase
    .from('ui_settings')
    .upsert({ user_id: auth.user.id, setting_key: schluessel, setting_value: { data: vorschau, at: new Date().toISOString() } }, { onConflict: 'user_id,setting_key' })
  return error ? null : { schluessel, vorschau }
}

export async function bilderLoeschen(schluessel: string[]): Promise<void> {
  if (!supabase || !schluessel.length) return
  await supabase.from('ui_settings').delete().in('setting_key', schluessel)
}
