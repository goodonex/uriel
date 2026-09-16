import { supabase } from './supabase'

/**
 * Freigabe/Verwerfen einzelner Website-Felder — der EINE Weg dorthin.
 *
 * Wie beim projectMessageService: Der Projekt-Editor (`useSiteContent`) und der
 * Kunden-Posteingang in /freigaben müssen exakt dieselbe Schreiboperation
 * fahren. Freigeben heißt draft → published; ab dem Moment liest die
 * Kundenwebsite über die View `site_content_published` den neuen Wert.
 * Das ist eine Änderung nach außen — der Aufrufer holt vorher eine Bestätigung.
 */

export type SchreibErgebnis = { ok: true } | { ok: false; error: string }

/**
 * Eine ganze Einreichung freigeben — der Weg, den der Posteingang nimmt.
 *
 * Seit 0086 macht das eine Funktion in der Datenbank: alle offenen Entwürfe
 * EINES Projekts in einer Transaktion, alles oder nichts. Vorher lief das als
 * N einzelne Schreibvorgänge aus dem Browser; klemmte der siebte, stand die
 * Kundenseite halb aktualisiert da, ohne dass es jemandem auffiel.
 */
export async function gibProjektFrei(projectId: string): Promise<SchreibErgebnis> {
  if (!supabase) return { ok: false, error: 'Supabase nicht verbunden' }
  const { error } = await supabase.rpc('site_content_live_schalten', { p_project: projectId })
  return error ? { ok: false, error: error.message } : { ok: true }
}

/** Eine ganze Einreichung verwerfen: Entwürfe zurück auf den Live-Stand. */
export async function verwirfProjektEntwuerfe(projectId: string): Promise<SchreibErgebnis> {
  if (!supabase) return { ok: false, error: 'Supabase nicht verbunden' }
  const { error } = await supabase.rpc('site_content_verwerfen', { p_project: projectId })
  return error ? { ok: false, error: error.message } : { ok: true }
}

export async function gibSiteContentFrei(
  fieldId: string,
  valueDraft: string | null,
): Promise<SchreibErgebnis> {
  if (!supabase) return { ok: false, error: 'Supabase nicht verbunden' }
  const { error } = await supabase
    .from('site_content')
    .update({
      value_published: valueDraft,
      status: 'published',
      published_at: new Date().toISOString(),
    })
    .eq('id', fieldId)
  return error ? { ok: false, error: error.message } : { ok: true }
}

export async function verwirfSiteContentEntwurf(
  fieldId: string,
  valuePublished: string | null,
): Promise<SchreibErgebnis> {
  if (!supabase) return { ok: false, error: 'Supabase nicht verbunden' }
  // Entwurf auf den veröffentlichten Stand zurücksetzen — dadurch fällt
  // status wieder auf 'published' und der Posten verlässt die Warteschlange.
  const { error } = await supabase
    .from('site_content')
    .update({ value_draft: valuePublished, status: 'published' })
    .eq('id', fieldId)
  return error ? { ok: false, error: error.message } : { ok: true }
}
