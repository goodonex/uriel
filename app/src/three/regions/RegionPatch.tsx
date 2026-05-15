import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as THREE from 'three'
import type { WorldRegion } from '../../store/worldCamera'
import {
  REGION_MATERIALS,
  createContinentGeometry,
  noiseSeedForRegion,
} from './continentGeometry'
import type { RegionDef } from './regionGeometry'

interface RegionPatchProps {
  def: RegionDef
  slug: string
  planetRadius: number
  onHoverChange?: (hovered: boolean) => void
}

function materialKeyFor(def: RegionDef): keyof typeof REGION_MATERIALS {
  if (def.key === 'building') return 'building'
  if (def.key === 'promo') return 'promo'
  if (def.key === 'sales') return 'sales'
  return 'intelligence'
}

export function RegionPatch({ def, slug, planetRadius, onHoverChange }: RegionPatchProps) {
  const navigate = useNavigate()
  const matRef = useRef<THREE.MeshStandardMaterial>(null)
  const [hovered, setHovered] = useState(false)
  const emissiveTarget = useRef(def.key === 'intelligence' ? 0.35 : 0.4)

  const matDef = REGION_MATERIALS[materialKeyFor(def)]

  const geometry = useMemo(
    () =>
      createContinentGeometry({
        lat: def.lat,
        lon: def.lon,
        planetRadius,
        angularRadiusDeg: def.angularRadiusDeg,
        noiseSeed: noiseSeedForRegion(def.key),
      }),
    [def.lat, def.lon, def.angularRadiusDeg, def.key, planetRadius],
  )

  useFrame((_, delta) => {
    const mat = matRef.current
    if (!mat) return
    const base = matDef.emissiveIntensity
    const target = hovered ? 0.7 : base
    emissiveTarget.current += (target - emissiveTarget.current) * Math.min(1, delta * 12)
    mat.emissiveIntensity = emissiveTarget.current
  })

  const navigateToRegion = (key: WorldRegion) => {
    const pathMode = key === 'building' ? 'foundation' : key
    navigate(`/brand/${slug}/${pathMode}`)
  }

  return (
    <mesh
      geometry={geometry}
      onClick={(e) => {
        e.stopPropagation()
        navigateToRegion(def.key)
      }}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(true)
        onHoverChange?.(true)
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        setHovered(false)
        onHoverChange?.(false)
        document.body.style.cursor = 'auto'
      }}
    >
      <meshStandardMaterial
        ref={matRef}
        color={matDef.color}
        emissive={matDef.emissive}
        emissiveIntensity={matDef.emissiveIntensity}
        roughness={0.82}
        metalness={0.05}
      />
    </mesh>
  )
}
