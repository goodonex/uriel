import * as THREE from 'three'
import type { WorldRegion } from '../../store/worldCamera'

/** Kontinent-Oberflächenfarben — Single Source in continentGeometry.ts */
export { REGION_MATERIALS } from './continentGeometry'

/** Gebäude auf der Planetenoberfläche — später wieder true setzen. */
export const SHOW_REGION_BUILDINGS = false

/** Kontinent-Labels (SALES, FOUNDATION, …) — wieder true wenn Regionen klickbar sind. */
export const SHOW_REGION_LABELS = false

export interface RegionDef {
  key: WorldRegion
  label: string
  /** Grad */
  lat: number
  /** Grad */
  lon: number
  /** Winkelradius der Kontinent-Kappe in Grad */
  angularRadiusDeg: number
  /** Legacy — Bauwerke / Fallback */
  patchRadius: number
  tone: string
  accent: string
}

export const REGION_DEFS: RegionDef[] = [
  {
    key: 'building',
    label: 'FOUNDATION',
    lat: 25,
    lon: -40,
    angularRadiusDeg: 35,
    patchRadius: 1.4,
    tone: '#4a6fa5',
    accent: '#2a4f85',
  },
  {
    key: 'promo',
    label: 'PROMO',
    lat: -15,
    lon: 60,
    angularRadiusDeg: 28,
    patchRadius: 1.12,
    tone: '#7a4fa5',
    accent: '#5a2f85',
  },
  {
    key: 'sales',
    label: 'SALES',
    lat: 10,
    lon: 150,
    angularRadiusDeg: 35,
    patchRadius: 1.4,
    tone: '#a57a30',
    accent: '#855a10',
  },
  {
    key: 'intelligence',
    label: 'INTELLIGENCE',
    lat: -45,
    lon: -20,
    angularRadiusDeg: 22,
    patchRadius: 0.88,
    tone: '#a5a5a5',
    accent: '#858585',
  },
]

export function byRegionKey(key: WorldRegion): RegionDef {
  const hit = REGION_DEFS.find((x) => x.key === key)
  if (hit) return hit
  if (key === 'discovery') return REGION_DEFS.find((x) => x.key === 'building') ?? REGION_DEFS[0]
  return REGION_DEFS[0]
}

export function latLonToVector3(
  latDeg: number,
  lonDeg: number,
  radius: number,
): THREE.Vector3 {
  const lat = THREE.MathUtils.degToRad(latDeg)
  const lon = THREE.MathUtils.degToRad(lonDeg)
  const x = radius * Math.cos(lat) * Math.sin(lon)
  const y = radius * Math.sin(lat)
  const z = radius * Math.cos(lat) * Math.cos(lon)
  return new THREE.Vector3(x, y, z)
}
