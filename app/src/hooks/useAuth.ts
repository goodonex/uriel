import type { User } from '@supabase/supabase-js'
import { useCallback, useEffect, useState } from 'react'
import { isMissingSupabaseTableError } from '../lib/supabaseErrors'
import { supabase } from '../lib/supabase'

export type AppUserRole = 'owner' | 'client'

export interface UseAuthResult {
  user: User | null
  role: AppUserRole | null
  /** Nur gesetzt wenn role = client; optionaler Deep-Link / Reporting */
  clientSlug: string | null
  /** Deliver-Projekt-UUID für roll=client — Login-Redirect /portal/:id */
  clientProjectId: string | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

/** `undefined` = Lesefehler (Netz o. ä.), `null` = Konto hat keine Rolle. */
async function fetchRoleRow(userId: string): Promise<{
  role: AppUserRole
  client_slug: string | null
  project_id: string | null
} | null | undefined> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('user_roles')
    .select('role, client_slug, project_id')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) {
    if (isMissingSupabaseTableError(error.message)) {
      return { role: 'owner' as const, client_slug: null, project_id: null }
    }
    console.warn('[useAuth] Rolle nicht lesbar:', error.message)
    return undefined
  }
  if (!data) return null
  return {
    role: data.role as AppUserRole,
    client_slug: data.client_slug as string | null,
    project_id: (data.project_id as string | null) ?? null,
  }
}

/**
 * Rollen legt nur der Server an (Migration 0093, 25.09.2026): Owner per Hand,
 * Portal-Kunden über die Function invite-client. Früher schrieb der Browser
 * jedem Konto ohne Zeile `role = 'owner'` — bei offener Registrierung wurde so
 * jeder Fremde zum Agentur-Owner. Konto ohne Zeile = kein Zugang.
 */
export function useAuth(): UseAuthResult {
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<AppUserRole | null>(null)
  const [clientSlug, setClientSlug] = useState<string | null>(null)
  const [clientProjectId, setClientProjectId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const applySession = useCallback(async (u: User | null) => {
    setUser(u)
    if (!u) {
      setRole(null)
      setClientSlug(null)
      setClientProjectId(null)
      return
    }
    const row = await fetchRoleRow(u.id)
    // Lesefehler beim Token-Refresh sperrt niemanden aus: letzte Rolle bleibt.
    if (row === undefined) return
    if (row) {
      setRole(row.role)
      setClientSlug(row.client_slug)
      setClientProjectId(row.project_id)
    } else {
      setRole(null)
      setClientSlug(null)
      setClientProjectId(null)
    }
  }, [])

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    let cancelled = false
    let initialDone = false

    const finishInitial = () => {
      if (cancelled || initialDone) return
      initialDone = true
      setLoading(false)
    }

    setLoading(true)

    const safetyTimer = window.setTimeout(finishInitial, 8000)

    void supabase.auth
      .getSession()
      .then(({ data: { session } }) => applySession(session?.user ?? null))
      .catch((err) => {
        console.warn('[useAuth] getSession fehlgeschlagen:', err)
      })
      .finally(() => {
        window.clearTimeout(safetyTimer)
        finishInitial()
      })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void applySession(session?.user ?? null)
    })

    return () => {
      cancelled = true
      window.clearTimeout(safetyTimer)
      subscription.unsubscribe()
    }
  }, [applySession])

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Supabase ist nicht konfiguriert')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }, [])

  const signOut = useCallback(async () => {
    if (!supabase) return
    await supabase.auth.signOut()
  }, [])

  return { user, role, clientSlug, clientProjectId, loading, signIn, signOut }
}
