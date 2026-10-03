/**
 * Marktkarte (Phase 1): Typen und reine Hilfen für Wettbewerber und ihre
 * Referenzkunden. Tabellen: Migration 0097. Ohne React und Supabase, damit
 * die Regeln einzeln prüfbar bleiben.
 */

export type WettbewerberTyp = 'agentur' | 'makler_starke_seite' | 'sonstiges'
export type WettbewerberStatus = 'neu' | 'geprueft' | 'beobachten' | 'verworfen'
export type ReferenzQuelle = 'footer' | 'referenzseite' | 'trustpilot' | 'google' | 'linkedin'

export interface Wettbewerber {
  id: string
  name: string
  domain: string
  typ: WettbewerberTyp
  zielgruppe: string
  einstiegsangebot: string
  /** null = noch nicht geprüft. */
  kundengewinnung: boolean | null
  instagram: string
  linkedin: string
  notizen: string
  quelle: string
  status: WettbewerberStatus
  created_at: string
}

export interface WettbewerberReferenz {
  id: string
  wettbewerber_id: string
  kunde_domain: string
  kunde_name: string
  contact_id: string | null
  quelle: ReferenzQuelle
  /** 0 = direkt bei der Agentur gefunden, höchstens 2. */
  tiefe: number
  created_at: string
}

export const TYP_LABEL: Record<WettbewerberTyp, string> = {
  agentur: 'Agentur',
  makler_starke_seite: 'Makler mit starker Seite',
  sonstiges: 'Sonstiges',
}

export const STATUS_LABEL: Record<WettbewerberStatus, string> = {
  neu: 'Neu',
  geprueft: 'Geprüft',
  beobachten: 'Beobachten',
  verworfen: 'Verworfen',
}

export const QUELLE_LABEL: Record<ReferenzQuelle, string> = {
  footer: 'Footer-Credit',
  referenzseite: 'Referenzseite',
  trustpilot: 'Trustpilot',
  google: 'Google-Bewertung',
  linkedin: 'LinkedIn',
}

export const TYPEN = Object.keys(TYP_LABEL) as WettbewerberTyp[]
export const STATUS = Object.keys(STATUS_LABEL) as WettbewerberStatus[]
export const QUELLEN = Object.keys(QUELLE_LABEL) as ReferenzQuelle[]

/**
 * Aus einem eingeworfenen Link (oder nacktem Domain-Namen) die Domain machen:
 * klein, ohne Protokoll, ohne „www.", ohne Pfad/Query. Gibt null zurück, wenn
 * nichts Domain-Artiges drin steht.
 */
export function domainAusLink(eingabe: string): string | null {
  let s = eingabe.trim().toLowerCase()
  if (!s) return null
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
  s = s.replace(/^[^@/]*@/, '')
  s = s.split(/[/?#\s]/)[0] ?? ''
  s = s.replace(/:\d+$/, '').replace(/^www\./, '').replace(/\.$/, '')
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(s)) return null
  return s
}

/** Anzeigename, solange noch keiner eingetragen ist: die Domain ohne Endung, Anfangsbuchstabe groß. */
export function namensVorschlag(domain: string): string {
  const kern = domain.split('.')[0] ?? domain
  return kern.charAt(0).toUpperCase() + kern.slice(1)
}
