/**
 * Call-Nachbereitung per Sprache (08.10.2026).
 *
 * Kevin spricht nach einem Sales-Call EINMAL in Uriel — frei, ohne Struktur —
 * und Uriel trägt alles in den Kontakt ein. Uriel zerlegt das Diktat in die
 * Felder des Werkzeugs `call_nachbereiten`; dieses Modul prüft die Eingabe und
 * rechnet daraus den Kontakt-Patch und den Timeline-Eintrag. Reine Funktionen,
 * damit die Regeln ohne React lesbar bleiben.
 *
 * Grundregel wie bei `log_metric`: nichts Vorhandenes still wegwerfen.
 * Textfelder werden mit Datumskopf ANGEHÄNGT — ein zweites Gespräch
 * überschreibt nicht, was im ersten herauskam. Einzige Ausnahme sind die
 * nächsten Schritte: die gelten immer nur ab jetzt.
 */
import type { Contact, FollowUpType, PipelineStage } from '../../types/db'
import type { ActivityType } from '../../lib/activityTypes'

export const CALL_ARTEN = ['setting', 'closing', 'gespraech'] as const
export type CallArt = (typeof CALL_ARTEN)[number]

const STUFEN: PipelineStage[] = ['first_contact', 'conversation', 'follow_up', 'proposal', 'deal', 'paused']
const FOLLOW_UP_TYPEN: FollowUpType[] = ['call', 'meeting', 'email', 'other']

/** Textfelder am Kontakt, die angehängt werden (nicht überschrieben). */
export const ANHAENGE_FELDER = [
  'bedarf',
  'aktuelle_situation',
  'hauptproblem',
  'einwaende',
  'timeline',
  'budget',
] as const
type AnhaengeFeld = (typeof ANHAENGE_FELDER)[number]

export interface NeuerKontakt {
  name: string
  firma?: string
  email?: string
  telefon?: string
  position?: string
}

export interface Nachbereitung {
  art: CallArt
  zusammenfassung: string
  punkte: string[]
  felder: Partial<Record<AnhaengeFeld, string>>
  naechste_schritte?: string
  entscheider_name?: string
  ist_entscheider?: boolean
  abschluss_wahrscheinlichkeit?: number
  potenzial_betrag?: number
  pipeline_stage?: PipelineStage
  naechster_kontakt?: { at: string; typ: FollowUpType }
  learnings: string[]
  ergebnis?: string
}

type Pruefung = { ok: true; wert: Nachbereitung } | { ok: false; text: string }

function text(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function liste(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.map(text).filter(Boolean)
}

/** Prüft die rohe Werkzeug-Eingabe. Unbekannte Werte fallen weg statt zu raten. */
export function pruefeNachbereitung(input: Record<string, unknown>): Pruefung {
  const art = text(input.art) as CallArt
  if (!CALL_ARTEN.includes(art)) {
    return { ok: false, text: `art muss eins von ${CALL_ARTEN.join(', ')} sein.` }
  }
  const zusammenfassung = text(input.zusammenfassung)
  const punkte = liste(input.punkte)
  if (!zusammenfassung && !punkte.length) {
    return { ok: false, text: 'Weder Zusammenfassung noch Punkte — es gibt nichts einzutragen.' }
  }

  const felder: Nachbereitung['felder'] = {}
  for (const f of ANHAENGE_FELDER) {
    const v = text(input[f])
    if (v) felder[f] = v
  }

  const stufe = text(input.pipeline_stage) as PipelineStage
  const wahrscheinlichkeit = Number(input.abschluss_wahrscheinlichkeit)
  const potenzial = Number(input.potenzial_betrag)

  let naechster_kontakt: Nachbereitung['naechster_kontakt']
  const datum = text(input.naechster_kontakt_datum)
  if (datum) {
    const at = new Date(/T/.test(datum) ? datum : `${datum}T10:00:00`)
    if (Number.isNaN(at.getTime())) {
      return { ok: false, text: `naechster_kontakt_datum „${datum}" ist kein Datum (YYYY-MM-DD).` }
    }
    const typ = text(input.naechster_kontakt_typ) as FollowUpType
    naechster_kontakt = { at: at.toISOString(), typ: FOLLOW_UP_TYPEN.includes(typ) ? typ : 'call' }
  }

  return {
    ok: true,
    wert: {
      art,
      zusammenfassung,
      punkte,
      felder,
      naechste_schritte: text(input.naechste_schritte) || undefined,
      entscheider_name: text(input.entscheider_name) || undefined,
      ist_entscheider: typeof input.ist_entscheider === 'boolean' ? input.ist_entscheider : undefined,
      abschluss_wahrscheinlichkeit: Number.isFinite(wahrscheinlichkeit) && input.abschluss_wahrscheinlichkeit != null
        ? Math.max(0, Math.min(100, Math.round(wahrscheinlichkeit)))
        : undefined,
      potenzial_betrag: Number.isFinite(potenzial) && potenzial > 0 ? Math.round(potenzial) : undefined,
      pipeline_stage: STUFEN.includes(stufe) ? stufe : undefined,
      naechster_kontakt,
      learnings: liste(input.learnings),
      ergebnis: text(input.ergebnis) || undefined,
    },
  }
}

export function pruefeNeuenKontakt(v: unknown): NeuerKontakt | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  const name = text(o.name)
  if (!name) return null
  return {
    name,
    firma: text(o.firma) || undefined,
    email: text(o.email) || undefined,
    telefon: text(o.telefon) || undefined,
    position: text(o.position) || undefined,
  }
}

function datumKopf(jetzt: Date): string {
  return jetzt.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function anhaengen(vorher: string | undefined, neu: string, kopf: string): string {
  const alt = (vorher ?? '').trim()
  const block = `${kopf}: ${neu}`
  return alt ? `${alt}\n\n${block}` : block
}

/** Kontakt-Patch: Texte anhängen, Zustände setzen, letzten Kontakt auf jetzt. */
export function kontaktPatch(
  kontakt: Contact,
  n: Nachbereitung,
  jetzt = new Date(),
): Partial<Omit<Contact, 'id' | 'brand_id'>> {
  const kopf = datumKopf(jetzt)
  const patch: Partial<Omit<Contact, 'id' | 'brand_id'>> = { last_contact_at: jetzt.toISOString() }

  for (const [feld, wert] of Object.entries(n.felder) as [AnhaengeFeld, string][]) {
    patch[feld] = anhaengen(kontakt[feld], wert, kopf)
  }

  const protokoll = [n.zusammenfassung, ...n.punkte.map((p) => `- ${p}`)].filter(Boolean).join('\n')
  patch.call_notes = anhaengen(kontakt.call_notes, `\n${protokoll}`, `${kopf} · ${ART_LABEL[n.art]}`)

  if (n.naechste_schritte) patch.naechste_schritte = `${kopf}: ${n.naechste_schritte}`
  if (n.entscheider_name) {
    const alt = (kontakt.entscheider_name ?? '').trim()
    patch.entscheider_name = !alt
      ? n.entscheider_name
      : alt.toLowerCase().includes(n.entscheider_name.toLowerCase())
        ? alt
        : `${alt}, ${n.entscheider_name}`
  }
  if (n.ist_entscheider !== undefined) patch.ist_entscheider = n.ist_entscheider
  if (n.abschluss_wahrscheinlichkeit !== undefined) patch.abschluss_wahrscheinlichkeit = n.abschluss_wahrscheinlichkeit
  if (n.potenzial_betrag !== undefined) patch.potenzial_betrag = n.potenzial_betrag
  if (n.pipeline_stage && n.pipeline_stage !== kontakt.pipeline_stage) {
    patch.pipeline_stage = n.pipeline_stage
    patch.stage_changed_at = jetzt.toISOString()
  }
  if (n.naechster_kontakt) {
    patch.next_follow_up_at = n.naechster_kontakt.at
    patch.follow_up_type = n.naechster_kontakt.typ
  }
  return patch
}

export const ART_LABEL: Record<CallArt, string> = {
  setting: 'Setting',
  closing: 'Closing',
  gespraech: 'Sales-Call',
}

/** Timeline-Eintrag. Setting/Closing nutzen ihre bestehenden Typen, alles andere ist eine Notiz. */
export function timelineEintrag(n: Nachbereitung): { activity_type: ActivityType; data: Record<string, unknown> } {
  const basis = {
    quelle: 'uriel',
    zusammenfassung: n.zusammenfassung,
    punkte: n.punkte,
    learnings: n.learnings,
    naechste_schritte: n.naechste_schritte ?? '',
  }
  if (n.art === 'setting') {
    return { activity_type: 'setting', data: { ...basis, termin_stattgefunden: 'Ja' } }
  }
  if (n.art === 'closing') {
    return { activity_type: 'closing', data: { ...basis, ergebnis: n.ergebnis ?? 'offen' } }
  }
  return {
    activity_type: 'notiz',
    data: { ...basis, text: `${ART_LABEL.gespraech}: ${n.zusammenfassung || n.punkte[0]}` },
  }
}
