import type { User } from '@supabase/supabase-js'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type AppUserRole = 'owner' | 'client'

export interface UseAuthResult {
  user: User | null
  role: AppUserRole | null
  /** Nur gesetzt wenn role = client; optionaler Deep-Link ins Portal */
  clientSlug: string | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

async function fetchRoleRow(userId: string): Promise<{
  role: AppUserRole
  client_slug: string | null
} | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('user_roles')
    .select('role, client_slug')
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !data) return null
  return {
    role: data.role as AppUserRole,
    client_slug: data.client_slug as string | null,
  }
}

/** Erste Session ohne Zeile: als Owner anlegen (nur wenn Tabelle noch ohne RLS-Schreibschutz). */
async function ensureOwnerRow(userId: string): Promise<void> {
  if (!supabase) return
  const existing = await fetchRoleRow(userId)
  if (existing) return
  const { error } = await supabase.from('user_roles').insert({
    user_id: userId,
    role: 'owner',
    client_slug: null,
  })
  if (error) {
    console.warn('[useAuth] user_roles Insert (owner) übersprungen:', error.message)
  }
}

export function useAuth(): UseAuthResult {
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<AppUserRole | null>(null)
  const [clientSlug, setClientSlug] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const applySession = useCallback(async (u: User | null) => {
    setUser(u)
    if (!u) {
      setRole(null)
      setClientSlug(null)
      return
    }
    let row = await fetchRoleRow(u.id)
    if (!row) {
      await ensureOwnerRow(u.id)
      row = await fetchRoleRow(u.id)
    }
    if (row) {
      setRole(row.role)
      setClientSlug(row.client_slug)
    } else {
      setRole(null)
      setClientSlug(null)
    }
  }, [])

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    let cancelled = false

    const finishInitial = () => {
      if (!cancelled) setLoading(false)
    }

    setLoading(true)
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return
      void applySession(session?.user ?? null).finally(finishInitial)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void applySession(session?.user ?? null)
    })

    return () => {
      cancelled = true
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

  return { user, role, clientSlug, loading, signIn, signOut }
}
