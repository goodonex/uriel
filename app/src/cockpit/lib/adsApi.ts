import { RUNNER_BASE_URL } from './useRunnerStatus'

/**
 * Kunden-Ads (Cockpit /ads): Typen + Fetcher für das Dateisystem-Manifest.
 * Quelle der Wahrheit ist `<Kundenordner>/<adsDir>/ads.json` — gelesen und
 * geschrieben über den lokalen Runner (Register = Kunden/cockpit-kunden.json).
 */

export interface KundeWebsite {
  live?: string
  dev?: string
  project?: string
}

export interface Kunde {
  slug: string
  name: string
  folder: string
  adsDir?: string
  website?: KundeWebsite
}

export type AdStatus = 'draft' | 'review' | 'approved' | 'live' | 'archived'

export interface AdFileRef {
  path: string
  format: '1:1' | '9:16' | 'mockup'
  note?: string
}

export interface ChecklistItem {
  id: string
  label: string
  done: boolean
}

export interface AdNote {
  at: string
  text: string
}

export interface AdVersion {
  v: number
  createdAt: string
  files: AdFileRef[]
  preview?: string
  copy?: { headline?: string; primary?: string; cta?: string }
  review?: { design: ChecklistItem[]; copy: ChecklistItem[] }
  notes?: AdNote[]
}

export interface Ad {
  id: string
  title: string
  angle?: string
  status: AdStatus
  versions: AdVersion[]
}

export interface OverviewFile {
  label: string
  path: string
  kind: 'html' | 'png'
}

export interface AdManifest {
  schemaVersion: 1
  customer: string
  updatedAt: string | null
  overviewFiles: OverviewFile[]
  ads: Ad[]
}

export const AD_STATUS_LABEL: Record<AdStatus, string> = {
  draft: 'Entwurf',
  review: 'In Review',
  approved: 'Freigegeben',
  live: 'Live',
  archived: 'Archiv',
}

export const AD_STATUS_ORDER: AdStatus[] = ['draft', 'review', 'approved', 'live', 'archived']

/** Checklisten-Templates: werden pro Version beim ersten Öffnen geseedet. */
export const DESIGN_CHECKS: Array<{ id: string; label: string }> = [
  { id: 'hierarchy', label: 'Visuelle Hierarchie klar (1 Blickpfad)' },
  { id: 'brand', label: 'Brand-Farben & Fonts korrekt' },
  { id: 'mobile', label: 'Lesbarkeit auf Handy-Größe geprüft' },
  { id: 'contrast', label: 'Kontrast Text/CTA ausreichend' },
  { id: 'calm', label: 'Ruhe statt Effekt — nichts Unruhiges' },
  { id: 'formats', label: '1:1 und 9:16 vorhanden/konsistent' },
]

export const COPY_CHECKS: Array<{ id: string; label: string }> = [
  { id: 'hook', label: 'Hook stoppt den Scroll (erste 2 Zeilen)' },
  { id: 'benefit', label: 'Nutzenversprechen konkret, nicht generisch' },
  { id: 'spirit', label: 'Reichentrog-Spirit statt Standard-Makler' },
  { id: 'cta', label: 'CTA klar + konkreter nächster Schritt' },
  { id: 'one-idea', label: 'Ein Gedanke pro Ad' },
  { id: 'spelling', label: 'Rechtschreibung & Fakten geprüft' },
]

export function seedReview(): { design: ChecklistItem[]; copy: ChecklistItem[] } {
  return {
    design: DESIGN_CHECKS.map((c) => ({ ...c, done: false })),
    copy: COPY_CHECKS.map((c) => ({ ...c, done: false })),
  }
}

// ---------- Fetcher ----------
async function req<T>(path: string, init?: RequestInit): Promise<T> {
  // no-store: das Manifest darf nie aus dem Browser-HTTP-Cache kommen —
  // ein stale GET würde Checklisten-/Notiz-Stand zurückdrehen.
  const res = await fetch(`${RUNNER_BASE_URL}${path}`, { cache: 'no-store', ...init })
  const body = (await res.json()) as T & { error?: string }
  if (!res.ok) {
    const err = new Error(body.error ?? `Runner-Fehler ${res.status}`) as Error & {
      status?: number
      body?: unknown
    }
    err.status = res.status
    err.body = body
    throw err
  }
  return body
}

export async function fetchKunden(): Promise<Kunde[]> {
  const { kunden } = await req<{ kunden: Kunde[] }>('/ads/customers')
  return kunden
}

export function fetchAdManifest(slug: string): Promise<AdManifest> {
  return req<AdManifest>(`/ads/manifest?kunde=${encodeURIComponent(slug)}`)
}

/** Wirft bei 409 einen Error mit `.status === 409` und `.body.current` (Disk-Stand). */
export function putAdManifest(
  slug: string,
  manifest: AdManifest,
  baseUpdatedAt: string | null,
): Promise<{ ok: true; updatedAt: string }> {
  return req(`/ads/manifest?kunde=${encodeURIComponent(slug)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ baseUpdatedAt, manifest }),
  })
}

/**
 * URL für eine Datei aus dem Ads-Ordner des Kunden (relativ zu adsDir).
 * Segmentweise encoden: der Ordnername enthält Leerzeichen ("KP - Reichentrog"),
 * die Slashes müssen aber Pfadtrenner bleiben.
 */
export function kundenFileUrl(kunde: Kunde, relPath: string): string {
  const full = `${kunde.folder}/${kunde.adsDir ?? '05_leadgen'}/${relPath}`
  const encoded = full.split('/').map(encodeURIComponent).join('/')
  return `${RUNNER_BASE_URL}/files/kunden/${encoded}`
}
