/** PostgREST / Supabase, wenn Migrationen noch nicht ausgeführt wurden. */
export function isMissingSupabaseTableError(message: string): boolean {
  const m = message.toLowerCase()
  return (
    m.includes('could not find the table') ||
    m.includes('schema cache') ||
    (m.includes('relation') && m.includes('does not exist'))
  )
}

/**
 * Wenn Remote zwar erreichbar ist, aber Writes/Reads scheitern (fehlende Spalte,
 * Schema-Drift, RLS in Dev): dieselben Daten lokal in localStorage fortsetzen.
 */
export function shouldFallbackToLocalSupabase(message: string): boolean {
  if (!message) return false
  if (isMissingSupabaseTableError(message)) return true
  const m = message.toLowerCase()
  if (m.includes('schema cache')) return true
  if (m.includes('could not find') && m.includes('column')) return true
  if (m.includes('column') && m.includes('does not exist')) return true
  if (m.includes('42703')) return true /* undefined_column */
  if (m.includes('23503') || m.includes('foreign key')) return true
  if (m.includes('42501')) return true /* insufficient_privilege */
  if (m.includes('row-level security') || m.includes('violates row-level security')) return true
  if (m.includes('permission denied')) return true
  return false
}

export function supabaseErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
    return (err as { message: string }).message
  }
  return String(err ?? '')
}
