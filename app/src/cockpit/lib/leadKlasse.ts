/**
 * Lead-Klasse A/B/C (22.09.2026, Migration 0092).
 *
 * Berechnet wird sie im Runner (`runner/linkedin/leadProfil.mjs`, `klasseFuer`)
 * aus dem Lead-Profil der Recherche. Hier steht nur, was das Cockpit damit tut:
 * die Follow-ups danach ordnen und sie neben dem Namen zeigen.
 *
 * - **A** — zahlt schon für Anzeigen, solide Firma, aber schwache Seite (Wunschkunde)
 * - **B** — solide Firma ohne Anzeigen, oder Anzeigen + ordentliche Seite
 * - **C** — Einzelkämpfer, neu oder unklar
 */
export type LeadKlasse = 'A' | 'B' | 'C'

export interface LeadKlassenInfo {
  klasse: LeadKlasse
  grund: string
}

export function istLeadKlasse(x: unknown): x is LeadKlasse {
  return x === 'A' || x === 'B' || x === 'C'
}

/**
 * Rang für die Sortierung: A, B, dann ohne Klasse, dann C.
 *
 * „Ohne Klasse" steht VOR C: Das sind Leads, deren Profil noch nicht erhoben
 * ist — darunter können A-Kunden sein. C dagegen ist geprüft und schwach.
 * Muss mit `klassenRang` im Runner übereinstimmen (`scripts/verify-lead-profil.ts`).
 */
export function klassenRang(klasse: LeadKlasse | null | undefined): number {
  return klasse === 'A' ? 0 : klasse === 'B' ? 1 : klasse === 'C' ? 3 : 2
}
