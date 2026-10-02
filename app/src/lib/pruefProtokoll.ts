import { supabase } from './supabase'

/**
 * Kevins Prüf-Entscheidungen ins Protokoll (02.10.2026, Migration 0096).
 *
 * Kevin: „Schreib einen Log, dass das protokolliert wird, dass man nach 30
 * Tagen daraus lernen kann." Fire-and-forget: Ein Fehler hier darf nie einen
 * Klick scheitern lassen — das Protokoll ist Beobachtung, keine Voraussetzung.
 */
export function protokolliereKevin(
  brandId: string | null | undefined,
  eintrag: { art: string; name: string; firma?: string; entscheidung: string; grund?: string; daten?: Record<string, unknown> },
): void {
  if (!supabase || !brandId) return
  void supabase
    .from('pruef_protokoll')
    .insert({
      brand_id: brandId,
      art: eintrag.art,
      name: eintrag.name.slice(0, 200),
      firma: (eintrag.firma ?? '').slice(0, 200),
      von: 'kevin',
      entscheidung: eintrag.entscheidung,
      grund: (eintrag.grund ?? '').slice(0, 500),
      daten: eintrag.daten ?? {},
    })
    .then(({ error }) => {
      if (error) console.warn('[pruefProtokoll] nicht gespeichert:', error.message)
    })
}
