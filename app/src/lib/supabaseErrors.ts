/** PostgREST / Supabase, wenn Migrationen noch nicht ausgeführt wurden. */
export function isMissingSupabaseTableError(message: string): boolean {
  const m = message.toLowerCase()
  return (
    m.includes('could not find the table') ||
    m.includes('schema cache') ||
    (m.includes('relation') && m.includes('does not exist'))
  )
}
