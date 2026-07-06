import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useBrands } from '../../hooks/useBrands'
import type { Brand } from '../../types/db'

const STORAGE_KEY = 'cockpit.activeBrandSlug'
const DEFAULT_SLUG = 'herrmann'

interface ActiveBrandContextValue {
  brands: Brand[]
  loading: boolean
  activeSlug: string
  activeBrand: Brand | null
  setActiveSlug: (slug: string) => void
}

const ActiveBrandContext = createContext<ActiveBrandContextValue | null>(null)

/** Cockpit-weiter Brand-Kontext. Persistiert die Auswahl in localStorage. */
export function ActiveBrandProvider({ children }: { children: ReactNode }) {
  const { brands, loading } = useBrands()
  const [activeSlug, setActiveSlugState] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_SLUG
    } catch {
      return DEFAULT_SLUG
    }
  })

  const setActiveSlug = useCallback((slug: string) => {
    setActiveSlugState(slug)
    try {
      localStorage.setItem(STORAGE_KEY, slug)
    } catch {
      /* localStorage nicht verfügbar — Auswahl gilt nur für die Session */
    }
  }, [])

  const activeBrand = useMemo(
    () => brands.find((b) => b.slug === activeSlug) ?? brands[0] ?? null,
    [brands, activeSlug],
  )

  const value = useMemo(
    () => ({ brands, loading, activeSlug, activeBrand, setActiveSlug }),
    [brands, loading, activeSlug, activeBrand, setActiveSlug],
  )

  return <ActiveBrandContext.Provider value={value}>{children}</ActiveBrandContext.Provider>
}

export function useActiveBrand(): ActiveBrandContextValue {
  const ctx = useContext(ActiveBrandContext)
  if (!ctx) throw new Error('useActiveBrand muss innerhalb von ActiveBrandProvider laufen')
  return ctx
}
