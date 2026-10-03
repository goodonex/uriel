/**
 * Dritte Lead-Quelle (03.10.2026): "Recherchierte Leads" = contact_lists mit
 * list_type = 'recherchiert'. Sie sind weder Kaltakquise noch LinkedIn und
 * werden an genau einer Stelle von den Kaltakquise-Listen getrennt.
 * Rein, ohne Netz — geprüft von `scripts/verify-listen-quellen.ts`.
 */
export const RECHERCHIERT = 'recherchiert'

export const istRecherchiert = (listType: unknown): boolean => listType === RECHERCHIERT

/** Teilt Listen in Kaltakquise (alles außer 'recherchiert') und Recherchierte Leads. */
export function trenneListen<T extends { list_type?: unknown }>(listen: T[]): { kaltakquise: T[]; recherchiert: T[] } {
  const kaltakquise: T[] = []
  const recherchiert: T[] = []
  for (const l of listen) (istRecherchiert(l.list_type) ? recherchiert : kaltakquise).push(l)
  return { kaltakquise, recherchiert }
}
