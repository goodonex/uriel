import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL ?? ''
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

function logBrandsProbe(client: SupabaseClient): void {
  void client
    .from('brands')
    .select('*', { count: 'exact', head: true })
    .then(({ error, count }) => {
      if (error) {
        console.error('[Supabase] brands-Probe fehlgeschlagen:', error.message, error)
      } else {
        console.info(
          '[Supabase] Verbunden. Tabelle `brands` erreichbar (Zeilen geschätzt:',
          count ?? 0,
          ')',
        )
      }
    })
}

export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null

export const isSupabaseConfigured = supabase !== null

if (typeof window !== 'undefined' && supabase) {
  logBrandsProbe(supabase)
}
