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
 * Organisch in Tiefe und Höhe gestaffelt — keine Reihe.
 */
export const BRAND_SYSTEM_POSITIONS: Record<string, [number, number, number]> = {
  herrmann: [-32, 6, -14],
  wertavio: [26, -4, 10],
  culturefit: [0, 14, -24],
  homeflower: [-10, -14, 20],
  eversmell: [34, 10, -4],
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
export const BRAND_MOON_ORBIT_RADIUS = 3.2
/** Universe & Brand-System — größere Planeten für Lesbarkeit */
export const BRAND_PLANET_RADIUS = 1.4
export const UNIVERSE_PLANET_RADIUS = 1.4
export const BRAND_MOON_RADIUS = 0.28
export const BRAND_MOON_SURFACE_OFFSET: [number, number, number] = [
  BRAND_MOON_ORBIT_RADIUS,
  0.2,
  0,
]
