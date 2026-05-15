import * as THREE from 'three'
import type { WorldRegion } from '../../store/worldCamera'
import { latLonToVector3 } from './regionGeometry'
import { fbm2D, seedToNumber } from './valueNoise'

export interface ContinentMaterialDef {
  color: string
  emissive: string
  emissiveIntensity: number
}

export const REGION_MATERIALS: Record<
  'building' | 'promo' | 'sales' | 'intelligence',
  ContinentMaterialDef
> = {
  building: { color: '#2255aa', emissive: '#1a44cc', emissiveIntensity: 0.55 },
  promo: { color: '#8833cc', emissive: '#6622aa', emissiveIntensity: 0.55 },
  sales: { color: '#cc8822', emissive: '#aa6600', emissiveIntensity: 0.55 },
  intelligence: { color: '#aaaaaa', emissive: '#888888', emissiveIntensity: 0.5 },
}

const NOISE_SEED_BY_KEY: Record<'building' | 'promo' | 'sales' | 'intelligence', string> = {
  building: 'foundation',
  promo: 'promo',
  sales: 'sales',
  intelligence: 'intelligence',
}

export function noiseSeedForRegion(key: WorldRegion): string {
  if (key in NOISE_SEED_BY_KEY) return NOISE_SEED_BY_KEY[key as keyof typeof NOISE_SEED_BY_KEY]
  return key
}

export interface ContinentGeometryOptions {
  lat: number
  lon: number
  planetRadius: number
  angularRadiusDeg: number
  noiseSeed: string
  segments?: number
}

export function createContinentGeometry(opts: ContinentGeometryOptions): THREE.BufferGeometry {
  const {
    lat,
    lon,
    planetRadius,
    angularRadiusDeg,
    noiseSeed,
    segments = 36,
  } = opts

  const angularRadius = THREE.MathUtils.degToRad(angularRadiusDeg)
  const center = latLonToVector3(lat, lon, 1).normalize()
  const worldUp =
    Math.abs(center.y) > 0.92 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)
  const tangent = new THREE.Vector3().crossVectors(worldUp, center).normalize()
  const bitangent = new THREE.Vector3().crossVectors(center, tangent).normalize()
  const seed = seedToNumber(noiseSeed)

  const vertices: number[] = []
  const indices: number[] = []
  const grid: number[][] = []

  for (let row = 0; row <= segments; row++) {
    grid[row] = []
    const ty = (row / segments) * 2 - 1
    for (let col = 0; col <= segments; col++) {
      const tx = (col / segments) * 2 - 1
      const r = Math.sqrt(tx * tx + ty * ty)
      if (r > 1.02) {
        grid[row][col] = -1
        continue
      }

      const noiseX = tx * 2.2 + 0.5
      const noiseY = ty * 2.2 + 0.5
      const coastNoise = fbm2D(noiseX, noiseY, seed)
      const coastLimit = 0.78 + coastNoise * 0.2
      if (r > coastLimit) {
        grid[row][col] = -1
        continue
      }

      const heightNoise = fbm2D(noiseX * 1.4 + 2.1, noiseY * 1.4 + 4.3, seed + 113)
      const heightOffset = THREE.MathUtils.lerp(0.04, 0.18, heightNoise)
      const lift = planetRadius + heightOffset

      const angle = r * angularRadius
      const sinA = Math.sin(angle)
      const cosA = Math.cos(angle)
      const tangentDir = tangent
        .clone()
        .multiplyScalar(tx)
        .add(bitangent.clone().multiplyScalar(ty))
      if (tangentDir.lengthSq() < 1e-8) tangentDir.copy(tangent)
      tangentDir.normalize()

      const dir = center
        .clone()
        .multiplyScalar(cosA)
        .add(tangentDir.multiplyScalar(sinA))
        .normalize()

      const pos = dir.multiplyScalar(lift)
      grid[row][col] = vertices.length / 3
      vertices.push(pos.x, pos.y, pos.z)
    }
  }

  for (let row = 0; row < segments; row++) {
    for (let col = 0; col < segments; col++) {
      const a = grid[row][col]
      const b = grid[row][col + 1]
      const c = grid[row + 1][col]
      const d = grid[row + 1][col + 1]
      if (a >= 0 && b >= 0 && c >= 0) indices.push(a, c, b)
      if (b >= 0 && c >= 0 && d >= 0) indices.push(b, c, d)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  if (indices.length > 0) geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}
