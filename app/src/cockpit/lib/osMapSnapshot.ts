import { supabase } from '../../lib/supabase'
import { isMissingSupabaseTableError } from '../../lib/supabaseErrors'
import type { OsMap } from './runnerApi'

// Der Agentic-OS-Graph lädt seine Objekte vom lokalen Runner (127.0.0.1:4711).
// Von der HTTPS-Live-Domain ist der Runner nicht erreichbar. Damit der Graph
// dort trotzdem voll ist, spiegelt das lokal geöffnete Cockpit die frische Map
// nach Supabase (saveOsMapSnapshot); die Live-Seite liest sie (loadOsMapSnapshot).

const ROW_ID = 'global'

/** Spiegelt die frisch vom Runner geladene Map nach Supabase (fire-and-forget). */
export async function saveOsMapSnapshot(map: OsMap): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('os_map_snapshot').upsert({
    id: ROW_ID,
    data: map,
    generated_at: map.generatedAt || null,
    updated_at: new Date().toISOString(),
  })
  if (error && !isMissingSupabaseTableError(error.message)) {
    console.warn('[os-map] Snapshot-Upsert fehlgeschlagen:', error.message)
  }
}

/** Liest den letzten Snapshot — für die Live-Domain, wenn der Runner offline ist. */
export async function loadOsMapSnapshot(): Promise<OsMap | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('os_map_snapshot')
    .select('data')
    .eq('id', ROW_ID)
    .maybeSingle()
  if (error) {
    if (!isMissingSupabaseTableError(error.message)) {
      console.warn('[os-map] Snapshot-Laden fehlgeschlagen:', error.message)
    }
    return null
  }
  return (data?.data as OsMap | undefined) ?? null
}
