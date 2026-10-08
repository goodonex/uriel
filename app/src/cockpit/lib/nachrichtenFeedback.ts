/**
 * „Claude sagen, was nicht passt" — Feedback an jeder Nachricht (08.10.2026).
 *
 * Kevin: *„Ich will überall, bei jeder Nachricht, selbst bei den Erstnachrichten,
 * irgendwas reinschreiben können. Und dann wird es einfach an dich geschickt."*
 * Und: *„wenn ich die an dich schicke, will ich die vorerst abgehakt, dass ich
 * einmal fertig sehe, dann Claude sagen ‚bearbeite den Rest', und dann habe ich
 * wieder z. B. 32 von 36."*
 *
 * Darum gilt eine Nachricht mit offenem Feedback als **bei Claude**: Sie fehlt in
 * ihrer Liste und zählt in „n von m" als erledigt, ohne dass etwas als gesendet
 * gezählt wird. Arbeitet eine Session sie ab (`scripts/nachrichten-feedback.ts
 * setzen`), verschwindet der Eintrag, die Nachricht steht mit neuem Text wieder
 * in ihrer Liste und der Zähler geht zurück.
 *
 * Gespeichert in `ui_settings` (ein Eintrag je Nachricht), keine Schemaänderung.
 * Vorgänger war `erstnachrichtenFeedback` (nur Stufe „Prüfen", 05.10.2026); dessen
 * Einträge werden beim ersten Laden hierher übernommen.
 */

import { useEffect, useSyncExternalStore } from 'react'
import { DATEN_NEU_LADEN_EVENT } from '../../lib/datenFrische'
import { supabase } from '../../lib/supabase'

export const FEEDBACK_SCHLUESSEL = 'nachrichtenFeedback'
const ALT_SCHLUESSEL = 'erstnachrichtenFeedback'
const CACHE = `cockpit.ui.${FEEDBACK_SCHLUESSEL}`

/** In welcher Liste die Nachricht stand — bestimmt, wo sie zählt und wohin der neue Text geht. */
export type FeedbackStufe = 'anfragen' | 'pruefen' | 'erstnachrichten' | 'antworten' | 'followups' | 'looms'

export interface FeedbackEintrag {
  /** Kevins Satz. Darf leer sein, wenn ein Screenshot alles sagt. */
  text: string
  /** Schlüssel der Screenshot-Zeilen in `ui_settings`. */
  bilder?: string[]
  at: string
  stufe: FeedbackStufe
  name: string
  firma?: string
  /** Der Text, so wie Kevin ihn gesehen hat — die Session liest trotzdem frisch aus der Tabelle. */
  nachricht?: string
}

/** Schlüssel = Posten-ID (`erstnachricht:<id>`, `thread:<id>`, `loom:<id>`, `anfrage:<id>`). */
export type FeedbackSammlung = Record<string, FeedbackEintrag>

export const STUFEN_NAME: Record<FeedbackStufe, string> = {
  anfragen: 'Anfrage an dich',
  pruefen: 'Prüfen',
  erstnachrichten: 'Erstnachricht',
  antworten: 'Antwort',
  followups: 'Follow-up',
  looms: 'Loom',
}

// ── Ein Speicher je Tab ────────────────────────────────────────────────────
// Liste, Zähler und Tagesfluss lesen denselben Stand; ein Eintrag wirkt sofort
// überall, ohne dass jede Stelle eine eigene Kopie hält.

let stand: FeedbackSammlung = leseCache()
const hoerer = new Set<() => void>()

function leseCache(): FeedbackSammlung {
  try {
    const roh = localStorage.getItem(CACHE)
    return roh ? (JSON.parse(roh) as FeedbackSammlung) : {}
  } catch {
    return {}
  }
}

function setzeLokal(neu: FeedbackSammlung): void {
  stand = neu
  try {
    localStorage.setItem(CACHE, JSON.stringify(neu))
  } catch {
    /* Privatmodus — dann ohne Zwischenspeicher */
  }
  for (const h of hoerer) h()
}

async function nutzerId(): Promise<string | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id ?? null
}

/** Der Stand in der Datenbank, mit den alten „Prüfen"-Einträgen zusammengeführt. */
async function holeRemote(): Promise<FeedbackSammlung | null> {
  const uid = await nutzerId()
  if (!supabase || !uid) return null
  const { data, error } = await supabase
    .from('ui_settings')
    .select('setting_key, setting_value')
    .eq('user_id', uid)
    .in('setting_key', [FEEDBACK_SCHLUESSEL, ALT_SCHLUESSEL])
  if (error) return null
  const zeile = (k: string) => data?.find((z) => z.setting_key === k)?.setting_value as Record<string, any> | undefined
  const sammlung: FeedbackSammlung = { ...(zeile(FEEDBACK_SCHLUESSEL) ?? {}) }
  const alt = zeile(ALT_SCHLUESSEL) ?? {}
  const altIds = Object.keys(alt)
  if (altIds.length) {
    for (const id of altIds) {
      const e = alt[id]
      sammlung[`erstnachricht:${id}`] ??= { text: e.text ?? '', bilder: e.bilder, at: e.at, name: e.name, stufe: 'pruefen' }
    }
    await schreibeRemote(uid, sammlung)
    await supabase.from('ui_settings').delete().eq('user_id', uid).eq('setting_key', ALT_SCHLUESSEL)
  }
  return sammlung
}

async function schreibeRemote(uid: string, neu: FeedbackSammlung): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase
    .from('ui_settings')
    .upsert({ user_id: uid, setting_key: FEEDBACK_SCHLUESSEL, setting_value: neu }, { onConflict: 'user_id,setting_key' })
  return !error
}

let laeuft: Promise<void> | null = null
/** Frisch aus der Datenbank — beim Öffnen und bei jedem Neu-Laden-Anstoß (Fokus, Takt). */
function aktualisiere(): Promise<void> {
  laeuft ??= holeRemote()
    .then((remote) => {
      if (remote) setzeLokal(remote)
    })
    .finally(() => {
      laeuft = null
    })
  return laeuft
}

/**
 * Lesen, ändern, schreiben — immer auf dem Stand der Datenbank, nicht auf dem
 * des Tabs. Sonst schriebe ein seit gestern offener Tab die von Claude schon
 * abgearbeiteten Einträge beim nächsten Feedback wieder zurück.
 */
async function aendere(f: (alt: FeedbackSammlung) => FeedbackSammlung): Promise<boolean> {
  // Sofort im Tab, damit die Nachricht beim Klick verschwindet — die Datenbank folgt.
  setzeLokal(f(stand))
  const uid = await nutzerId()
  if (!uid) return true
  const remote = await holeRemote()
  const neu = f(remote ?? stand)
  setzeLokal(neu)
  return schreibeRemote(uid, neu)
}

export function gibFeedback(schluessel: string, eintrag: Omit<FeedbackEintrag, 'at'>): Promise<boolean> {
  return aendere((alt) => ({ ...alt, [schluessel]: { ...eintrag, at: new Date().toISOString() } }))
}

/** Zurückholen, bevor Claude dran war: Die Nachricht steht wieder unverändert in ihrer Liste. */
export function holeZurueck(schluessel: string): Promise<boolean> {
  const bilder = stand[schluessel]?.bilder ?? []
  void bilderLoeschen(bilder)
  return aendere((alt) => {
    const neu = { ...alt }
    delete neu[schluessel]
    return neu
  })
}

let wacheAktiv = 0
export function useNachrichtenFeedback(): FeedbackSammlung {
  useEffect(() => {
    wacheAktiv++
    if (wacheAktiv === 1) void aktualisiere()
    const auf = () => void aktualisiere()
    window.addEventListener(DATEN_NEU_LADEN_EVENT, auf)
    return () => {
      wacheAktiv--
      window.removeEventListener(DATEN_NEU_LADEN_EVENT, auf)
    }
  }, [])
  return useSyncExternalStore(
    (h) => {
      hoerer.add(h)
      return () => hoerer.delete(h)
    },
    () => stand,
  )
}

/**
 * Teilt eine Liste in „noch offen" und „bei Claude". Die Zahl der Herausgenommenen
 * ist genau das, was im Zähler als vorerst erledigt dazukommt — so zählt nur, was
 * wirklich in dieser Liste stand, und alte Einträge bleiben ohne Wirkung.
 */
export function ohneBeiClaude<T>(liste: readonly T[], sammlung: FeedbackSammlung, schluessel: (x: T) => string): { offen: T[]; beiClaude: number } {
  const offen: T[] = []
  let beiClaude = 0
  for (const x of liste) {
    if (sammlung[schluessel(x)]) beiClaude++
    else offen.push(x)
  }
  return { offen, beiClaude }
}

// ── Abholen in einer Session ───────────────────────────────────────────────

const SESSION_ORDNER = '/Users/kevin/Kevin OS/02 Projekte/uriel'

export function abarbeitenPrompt(anzahl: number): string {
  return [
    `Zieh dir die ${anzahl === 1 ? 'neue Rückmeldung' : `${anzahl} neuen Rückmeldungen`} aus Uriel und arbeite sie komplett ab, ohne Rückfragen.`,
    ``,
    `Ablauf steht im Skill .claude/skills/nachrichten-feedback/SKILL.md (holen mit npx tsx scripts/nachrichten-feedback.ts holen).`,
    `Am Ende ein Satz Ergebnis und, falls Regeln nachgeschärft wurden, die als kurze Liste.`,
  ].join('\n')
}

/** Deep-Link, der in der Claude-App eine neue Code-Session im Uriel-Ordner öffnet. */
export function abarbeitenLink(anzahl: number): string {
  const q = new URLSearchParams({ q: abarbeitenPrompt(anzahl), folder: SESSION_ORDNER })
  return `claude://code/new?${q.toString().replace(/\+/g, '%20')}`
}

// ── Screenshots ────────────────────────────────────────────────────────────
// Jedes Bild als eigene Zeile in `ui_settings`, damit die Sammlung klein bleibt
// und beim Öffnen der Listen nicht Megabytes mitlädt. Kein Bucket, weil die
// bestehenden nur Projekt-Ordner zulassen.

const BILD_PREFIX = 'nachrichtenFeedbackBild:'

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
  const uid = await nutzerId()
  if (!supabase || !uid) return null
  const vorschau = await verkleinern(datei)
  const schluessel = `${BILD_PREFIX}${crypto.randomUUID()}`
  const { error } = await supabase
    .from('ui_settings')
    .upsert({ user_id: uid, setting_key: schluessel, setting_value: { data: vorschau, at: new Date().toISOString() } }, { onConflict: 'user_id,setting_key' })
  return error ? null : { schluessel, vorschau }
}

export async function bilderLoeschen(schluessel: string[]): Promise<void> {
  if (!supabase || !schluessel.length) return
  await supabase.from('ui_settings').delete().in('setting_key', schluessel)
}
