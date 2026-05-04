import { useCallback, useEffect, useRef, useState } from 'react'
import { loadOne, saveOne } from '../lib/storage'

interface FocusPreferencesDoc {
  dismissed_ids: string[]
  updated_at: string
}

interface UseFocusPreferencesResult {
  dismissedIds: string[]
  loading: boolean
  dismiss: (id: string) => void
  restoreAll: () => void
}

function emptyPrefs(): FocusPreferencesDoc {
  return {
    dismissed_ids: [],
    updated_at: new Date().toISOString(),
  }
}

export function useFocusPreferences(
  brandSlug: string | undefined,
): UseFocusPreferencesResult {
  const [doc, setDoc] = useState<FocusPreferencesDoc | null>(null)
  const [loading, setLoading] = useState(true)
  const docRef = useRef<FocusPreferencesDoc | null>(null)
  docRef.current = doc

  useEffect(() => {
    if (!brandSlug) {
      setDoc(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const t = window.setTimeout(() => {
      setDoc(loadOne<FocusPreferencesDoc>([brandSlug, 'focus-preferences']) ?? emptyPrefs())
      setLoading(false)
    }, 60)
    return () => window.clearTimeout(t)
  }, [brandSlug])

  const persist = useCallback(
    (next: FocusPreferencesDoc) => {
      if (!brandSlug) return
      saveOne([brandSlug, 'focus-preferences'], next)
    },
    [brandSlug],
  )

  const dismiss = useCallback(
    (id: string) => {
      if (!brandSlug) return
      const base = docRef.current ?? emptyPrefs()
      if (base.dismissed_ids.includes(id)) return
      const next: FocusPreferencesDoc = {
        dismissed_ids: [...base.dismissed_ids, id],
        updated_at: new Date().toISOString(),
      }
      setDoc(next)
      persist(next)
    },
    [brandSlug, persist],
  )

  const restoreAll = useCallback(() => {
    if (!brandSlug) return
    const next = emptyPrefs()
    setDoc(next)
    persist(next)
  }, [brandSlug, persist])

  return {
    dismissedIds: doc?.dismissed_ids ?? [],
    loading,
    dismiss,
    restoreAll,
  }
}
