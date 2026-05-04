import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { isMissingSupabaseTableError } from './supabaseErrors'

const url = import.meta.env.VITE_SUPABASE_URL ?? ''
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

function logBrandsProbe(client: SupabaseClient): void {
  void client
    .from('brands')
    .select('*', { count: 'exact', head: true })
    .then(({ error, count }) => {
      if (error) {
        if (isMissingSupabaseTableError(error.message)) {
          console.info(
            '[Supabase] Verbunden — Tabelle `brands` noch nicht angelegt (Migration 0001). App nutzt localStorage-Fallbacks.',
          )
        } else {
          console.error('[Supabase] brands-Probe fehlgeschlagen:', error.message, error)
        }
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
