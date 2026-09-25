import { supabase } from '../../lib/supabase'
import { RUNNER_BASE_URL } from './useRunnerStatus'
import { leseSpiegel, runnerDirekt } from './runnerBridge'

/**
 * Aufträge auf dem Mini (24.09.2026) — was läuft, wie weit, was kommt, was es
 * an Tokens kostet. Gerechnet wird ausschließlich im Runner
 * (`runner/auftraege.mjs`); hier wird nur gelesen und formatiert.
 *
 * Lokal zuerst direkt, sonst (und wenn der lokale Runner nicht antwortet —
 * auf dem Laptop läuft keiner) der Spiegel `auftraege`.
 */

export type AuftragZustand = 'laeuft' | 'pausiert' | 'brach' | 'gestoppt' | 'fertig'
export type PhasenStatus = 'fertig' | 'laeuft' | 'offen' | 'fehler'

export interface AuftragPhase {
  id: string
  titel: string
  status: PhasenStatus
  /** Null: für die laufende Phase gibt es noch keinen Anhaltspunkt. */
  prozent: number | null
  /** Aus Tokens gegen den Schnitt der fertigen Phasen hochgerechnet. */
  geschaetzt: boolean
  tokens: number
  schritt: string | null
}

export interface AuftragWaechter {
  jobs: number | null
  maxJobs: number | null
  stichtag: string | null
  beendet: string | null
  fehlschlaege: number
  ruheBis: string | null
  letzterTitel: string | null
}

export interface Auftrag {
  projekt: string
  titel: string
  quelle: 'FORTSCHRITT.json' | 'STAND.md'
  gestartet: string | null
  notiz: string | null
  zustand: AuftragZustand
  letzteAktivitaet: string | null
  seitStunden: number | null
  phasen: AuftragPhase[]
  aktuell: number | null
  gesamtProzent: number
  fertig: boolean
  tokens: {
    verbraucht: number
    usd: number
    geplant: number | null
    geplantArt: 'vorgabe' | 'hochrechnung' | null
    schnittJePhase: number | null
  }
  waechter: AuftragWaechter | null
}

/** Ein Projekt mit Plan, aus dem sich keine Phasen lesen ließen. */
export interface AuftragHinweis {
  projekt: string
  grund: string
}

export interface AuftraegeStand {
  auftraege: Auftrag[]
  hinweise: AuftragHinweis[]
  /** Wann der Mini den Stand zuletzt geschrieben hat (nur über den Spiegel bekannt). */
  stand: string | null
}

export async function fetchAuftraege(): Promise<AuftraegeStand> {
  if (runnerDirekt()) {
    try {
      const res = await fetch(`${RUNNER_BASE_URL}/auftraege`)
      if (res.ok) {
        const data = (await res.json()) as Omit<AuftraegeStand, 'stand'>
        return { ...data, hinweise: data.hinweise ?? [], stand: new Date().toISOString() }
      }
    } catch {
      /* lokal kein Runner — dann der Spiegel */
    }
  }
  const spiegel = await leseSpiegel<Omit<AuftraegeStand, 'stand'>>('auftraege')
  if (!spiegel) throw new Error('Der Mini hat noch keinen Auftrags-Stand gemeldet.')
  return { ...spiegel.data, hinweise: spiegel.data.hinweise ?? [], stand: spiegel.updatedAt }
}

// ---------- Nutzung der letzten 30 Tage (25.09.2026) ----------

export interface NutzungsWert {
  tokens: number
  usd: number
}

export interface NutzungsZeile {
  projekt: string
  /** Ein Programm (Ordner mit Code) — sonst Arbeit ohne Programm (Vault, Kundenordner). */
  programm: boolean
  bauen: NutzungsWert
  betrieb: NutzungsWert
  arbeit: NutzungsWert
  letzte: string | null
}

export interface NutzungsStand {
  /** Rechner, die gemeldet haben, mit dem Zeitpunkt ihrer letzten Meldung. */
  rechner: { name: string; stand: string }[]
  zeilen: NutzungsZeile[]
}

interface NutzungsSpiegel {
  rechner: string
  tage: number
  projekte: NutzungsZeile[]
}

/**
 * Jeder Rechner meldet seine eigenen Sitzungen (`nutzung_<rechner>`): der Mini
 * über den Runner, der Laptop über `scripts/nutzung-melden.mjs`. Hier wird
 * zusammengezählt.
 */
export async function fetchNutzung(): Promise<NutzungsStand> {
  if (!supabase) throw new Error('Keine Supabase-Verbindung')
  const { data, error } = await supabase.from('runner_snapshots').select('key, data, updated_at').like('key', 'nutzung_%')
  if (error) throw new Error(error.message)
  const zeilen = new Map<string, NutzungsZeile>()
  const plus = (a: NutzungsWert, b: NutzungsWert) => ({ tokens: a.tokens + b.tokens, usd: a.usd + b.usd })
  const rechner: NutzungsStand['rechner'] = []
  for (const row of data ?? []) {
    const d = row.data as NutzungsSpiegel
    rechner.push({ name: d.rechner ?? String(row.key).slice(8), stand: row.updated_at as string })
    for (const z of d.projekte ?? []) {
      const alt = zeilen.get(z.projekt)
      zeilen.set(
        z.projekt,
        alt
          ? {
              ...alt,
              programm: alt.programm || z.programm,
              bauen: plus(alt.bauen, z.bauen),
              betrieb: plus(alt.betrieb, z.betrieb),
              arbeit: plus(alt.arbeit, z.arbeit),
              letzte: [alt.letzte, z.letzte].filter(Boolean).sort().pop() ?? null,
            }
          : z,
      )
    }
  }
  // Nach Geld sortiert, nicht nach Tokens: Cache-Lesen bläht die Tokenzahl auf, kostet aber ein Zehntel.
  const summe = (z: NutzungsZeile) => z.bauen.usd + z.betrieb.usd + z.arbeit.usd
  return { rechner, zeilen: [...zeilen.values()].sort((a, b) => summe(b) - summe(a)) }
}

const ZAHL = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 })

/** 25 600 000 → „25,6 Mio.", 850 000 → „850 Tsd." */
export function tokenText(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '–'
  if (n >= 1e9) return `${ZAHL.format(n / 1e9)} Mrd.`
  if (n >= 1e6) return `${ZAHL.format(n / 1e6)} Mio.`
  if (n >= 1e3) return `${Math.round(n / 1e3)} Tsd.`
  return String(Math.round(n))
}

export function usdText(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return ''
  return `≈ ${Math.round(n)} $`
}

/** „vor 12 Min", „vor 3 Std", „seit 2 Tagen" — je nach Zweck. */
export function alterText(iso: string | null, jetzt = Date.now()): string {
  if (!iso) return 'unbekannt'
  const min = Math.max(0, Math.round((jetzt - new Date(iso).getTime()) / 60_000))
  if (min < 60) return `${min} Min`
  const std = Math.round(min / 60)
  if (std < 48) return `${std} Std`
  return `${Math.round(std / 24)} Tagen`
}

export function zustandText(a: Pick<Auftrag, 'zustand' | 'letzteAktivitaet' | 'waechter'>, jetzt = Date.now()): string {
  const alter = alterText(a.letzteAktivitaet, jetzt)
  switch (a.zustand) {
    case 'laeuft':
      return 'läuft'
    case 'pausiert':
      return `Pause seit ${alter}`
    case 'brach':
      return `liegt seit ${alter} brach`
    case 'gestoppt':
      return `gestoppt: ${a.waechter?.beendet ?? 'Wächter aus'}`
    case 'fertig':
      return a.letzteAktivitaet ? `fertig seit ${datumText(a.letzteAktivitaet)}` : 'fertig'
  }
}

const DATUM = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit' })
export function datumText(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : DATUM.format(d)
}
