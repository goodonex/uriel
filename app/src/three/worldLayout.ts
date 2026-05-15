/**
 * worldLayout — räumliche Konstanten der Welt.
 *
 * Eine Single Source of Truth für Brand-Positionen, Farben und Orbit-Radien.
 * Wird von Universe (Render), WorldCameraController (Targets) und Region-
 * Komponenten gelesen, damit Kamera + Welt zwingend übereinstimmen.
 */

import * as THREE from 'three'

/** Welt-Primärfarben pro Brand. Quelle: world-roadmap.md, Phase 3. */
export const BRAND_WORLD_COLORS: Record<string, string> = {
  herrmann: '#3B6FE8',
  wertavio: '#B8902A',
  culturefit: '#DC4628',
  homeflower: '#2D7A4F',
  eversmell: '#D4A843',
}

/**
 * Position des Brand-Sonnensystems im Universe.
 * Zwei sichtbare Cluster (Kamera: Offset 0,30,80 → Blick auf ~0,6,0):
 * — links: Herrmann · Wertavio · Culturefit (Dreieck)
 * — rechts: Homeflower · Eversmell (Paar)
 */
export const BRAND_SYSTEM_POSITIONS: Record<string, [number, number, number]> = {
  herrmann: [-26, 8, -4],
  culturefit: [-14, 12, -10],
  wertavio: [-22, 3, 4],
  homeflower: [18, 7, 3],
  eversmell: [26, 9, -5],
}

/** Mittelpunkte der Universe-Cluster (Ambient / Guides) */
export const UNIVERSE_CLUSTER_CENTERS = {
  core: [-20, 7.5, -2] as [number, number, number],
  duo: [22, 8, -1] as [number, number, number],
}

/** Default für unbekannte Slugs. Hält die Kamera handhabbar. */
export const DEFAULT_BRAND_POSITION: [number, number, number] = [0, 0, 0]

/**
 * Hilfsfunktion: liefert die Welt-Position eines Brand-Sonnensystems.
 */
export function getBrandSystemPosition(
  slug: string | null | undefined,
): THREE.Vector3 {
  if (!slug) return new THREE.Vector3(...DEFAULT_BRAND_POSITION)
  const pos = BRAND_SYSTEM_POSITIONS[slug] ?? DEFAULT_BRAND_POSITION
  return new THREE.Vector3(...pos)
}

/**
 * Hilfsfunktion: liefert die Welt-Primärfarbe eines Brand-Slugs.
 * Fallback auf einen neutralen Teal damit nichts unsichtbar wird.
 */
export function getBrandWorldColor(
  slug: string | null | undefined,
): string {
  if (!slug) return '#5ee3c1'
  return BRAND_WORLD_COLORS[slug] ?? '#5ee3c1'
}

/** Radius des Deliver-Mondes im Brand-Sonnensystem. */
export const BRAND_MOON_ORBIT_RADIUS = 5.4
/** Universe & Brand-System — große, gut lesbare Planeten */
export const BRAND_PLANET_RADIUS = 2.8
export const UNIVERSE_PLANET_RADIUS = 2.8
export const BRAND_MOON_RADIUS = 0.28
export const BRAND_MOON_SURFACE_OFFSET: [number, number, number] = [
  BRAND_MOON_ORBIT_RADIUS,
  0.2,
  0,
]

/** Detaillierte Planet-Surface-Szene (World Stage planet-surface) — Zoom-Clamps & Hinweise */
export const PLANET_SURFACE_SCENE_RADIUS = 5
/** Deliver-Mond in Moon.tsx — Zoom-Clamps moon-surface */
export const MOON_SCENE_RADIUS = 3.2
