/**
 * useWorldCamera — Single Source of Truth für die Welt-Ebene.
 *
 * Die App hat vier Welt-Ebenen (Stages). Die URL ist führend:
 *   /                        -> universe
 *   /brand/:slug             -> brand-system
 *   /brand/:slug/deliver*    -> moon-surface
 *   /brand/:slug/:mode*      -> planet-surface (region = mode)
 *
 * Komponenten lesen aus dem Store, der WorldCameraController synct die Kamera.
 * Geschrieben wird ausschließlich aus `useWorldCameraSyncFromRoute()` — niemals
 * aus Welt-Komponenten direkt (sonst klingelt der Store gegen die Route an).
 */
import { useEffect, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { create } from 'zustand'

export type WorldStage =
  | 'universe'
  | 'brand-system'
  | 'planet-surface'
  | 'moon-surface'

export type WorldRegion =
  | 'building'
  | 'discovery'
  | 'promo'
  | 'sales'
  | 'intelligence'

const REGION_FOR_MODE: Record<string, WorldRegion | 'deliver'> = {
  foundation: 'building',
  building: 'building',
  discovery: 'discovery',
  promo: 'promo',
  sales: 'sales',
  intelligence: 'intelligence',
  deliver: 'deliver',
}

export interface WorldCameraState {
  stage: WorldStage
  brandSlug: string | null
  region: WorldRegion | null
  setFromRoute: (next: {
    stage: WorldStage
    brandSlug: string | null
    region: WorldRegion | null
  }) => void
}

export const useWorldCamera = create<WorldCameraState>((set) => ({
  stage: 'universe',
  brandSlug: null,
  region: null,
  setFromRoute: ({ stage, brandSlug, region }) =>
    set((prev) => {
      if (
        prev.stage === stage &&
        prev.brandSlug === brandSlug &&
        prev.region === region
      ) {
        return prev
      }
      return { stage, brandSlug, region }
    }),
}))

interface DerivedStage {
  stage: WorldStage
  brandSlug: string | null
  region: WorldRegion | null
}

/** Reine Funktion damit sie sich gut testen / wiederverwenden lässt. */
export function deriveStageFromPath(pathname: string): DerivedStage {
  if (!pathname.startsWith('/brand/')) {
    return { stage: 'universe', brandSlug: null, region: null }
  }

  const parts = pathname.split('/').filter(Boolean) // ['brand', slug, mode?, ...]
  const slug = parts[1] ?? null
  const mode = parts[2] ?? null

  if (!slug) {
    return { stage: 'universe', brandSlug: null, region: null }
  }

  if (!mode || mode === 'dashboard') {
    return { stage: 'brand-system', brandSlug: slug, region: null }
  }

  const resolved = REGION_FOR_MODE[mode]
  if (resolved === 'deliver') {
    return { stage: 'moon-surface', brandSlug: slug, region: null }
  }
  if (resolved) {
    return { stage: 'planet-surface', brandSlug: slug, region: resolved }
  }
  // Unbekannter Modus → Brand-System (defensiv, kein Crash)
  return { stage: 'brand-system', brandSlug: slug, region: null }
}

/**
 * Mountet einmal in der App-Shell. Synct Store mit aktueller Route.
 * Welt-Komponenten lesen danach nur noch aus `useWorldCamera`.
 */
export function useWorldCameraSyncFromRoute(): void {
  const { pathname } = useLocation()
  const setFromRoute = useWorldCamera((s) => s.setFromRoute)
  const derived = useMemo(() => deriveStageFromPath(pathname), [pathname])

  useEffect(() => {
    setFromRoute(derived)
  }, [derived, setFromRoute])
}
