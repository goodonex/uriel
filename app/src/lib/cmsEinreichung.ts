/**
 * "Schau bitte drauf" — die Einreichung des Kunden als Projekt-Nachricht.
 *
 * Reine Funktionen, kein React, kein Supabase — per
 * `npx tsx scripts/verify-cms-einreichung.ts` prüfbar.
 *
 * **Keine neue Tabelle, keine Warteschlange.** Genau wie die Deliverable-Abnahme
 * (lib/abnahme.ts, O11/D6) ist eine Einreichung eine strukturierte
 * `project_messages` mit `sender_role='client'` und einem Präfix im Body. Damit
 * hängt sie an allem dran, was es schon gibt: am Posteingang in /freigaben, am
 * Ungelesen-Zähler und an der Benachrichtigungs-Mail.
 *
 * Der Zustand der Felder steht weiterhin allein in `site_content.status`
 * ('pending'). Die Nachricht ist das Ereignis, nicht die Wahrheit — sonst gäbe
 * es zwei Stellen, die auseinanderlaufen können.
 *
 * Warum ein Präfix und kein JSON: Die Nachricht muss auch dort lesbar bleiben,
 * wo sie ohne Aufbereitung erscheint — in der Mail, in der Datenbank-Ansicht.
 * `[website:12] Die Preise sind neu, passt das so?` erklärt sich von selbst.
 */

export interface CmsEinreichung {
  /** Wie viele Felder der Kunde geändert hat. */
  anzahl: number
  /** Was er dazu sagt. Darf leer sein — dann wollte er nur, dass jemand draufschaut. */
  notiz: string
}

const EINREICHUNG_RE = /^\[website:(\d{1,4})\]\s*([\s\S]*)$/

/** Der Text, der als `project_messages.body` in die Datenbank geht. */
export function baueCmsEinreichung(anzahl: number, notiz = ''): string {
  const n = Math.max(0, Math.min(9999, Math.trunc(anzahl)))
  const rest = notiz.trim()
  return rest ? `[website:${n}] ${rest}` : `[website:${n}]`
}

/** Null = eine ganz normale Nachricht. */
export function leseCmsEinreichung(body: string): CmsEinreichung | null {
  const m = EINREICHUNG_RE.exec(body.trim())
  if (!m) return null
  return { anzahl: Number(m[1]), notiz: m[2].trim() }
}

/** Überschrift im Posteingang — ohne dass dort das Projekt geladen sein muss. */
export function cmsEinreichungTitel(anzahl: number): string {
  if (anzahl <= 0) return 'Website — Änderungen'
  return `Website — ${anzahl} ${anzahl === 1 ? 'Änderung' : 'Änderungen'}`
}
