import type { ReactNode } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

export function RequireAuthShell({ children }: { children: ReactNode }) {
  if (!supabase || !isSupabaseConfigured) {
    return (
      <div
        className="font-mono"
        style={{
          pointerEvents: 'auto',
          padding: 24,
          color: 'var(--accent-coral)',
          fontSize: 13,
        }}
      >
        Supabase ist nicht konfiguriert (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).
      </div>
    )
  }

  return <>{children}</>
}
