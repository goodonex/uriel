import * as THREE from 'three'
import type { WorldRegion } from '../../store/worldCamera'

export interface RegionDef {
  key: WorldRegion
  label: string
  /** Grad */
  lat: number
  /** Grad */
  lon: number
  patchRadius: number
  tone: string
  accent: string
}

export const REGION_DEFS: RegionDef[] = [
  {
    key: 'building',
    label: 'BUILDING',
    lat: 26,
    lon: -38,
    patchRadius: 1.3,
    tone: '#665742', // Sandstein
    accent: '#b48d61',
  },
  {
    key: 'discovery',
    label: 'DISCOVERY',
    lat: 18,
    lon: 36,
    patchRadius: 1.22,
    tone: '#4e5d6c',
    accent: '#7890a9',
  },
  {
    key: 'promo',
    label: 'PROMO',
    lat: -12,
    lon: 18,
    patchRadius: 1.28,
    tone: '#5f4f69',
    accent: '#9d79b4',
  },
  {
    key: 'sales',
    label: 'SALES',
    lat: -22,
    lon: -52,
    patchRadius: 1.18,
    tone: '#6d5a40',
    accent: '#b89458',
  },
  {
    key: 'intelligence',
    label: 'INTELLIGENCE',
    lat: 4,
    lon: 74,
    patchRadius: 1.14,
    tone: '#7a7a80',
    accent: '#c6c7cf',
  },
]

export function byRegionKey(key: WorldRegion): RegionDef {
  const hit = REGION_DEFS.find((x) => x.key === key)
  if (!hit) return REGION_DEFS[0]
  return hit
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
