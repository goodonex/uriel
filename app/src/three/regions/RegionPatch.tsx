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
import { latLonToVector3 } from './regionGeometry'

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
  const edgeMatRef = useRef<THREE.MeshBasicMaterial>(null)
  const rippleMeshRef = useRef<THREE.Mesh>(null)
  const rippleMatRef = useRef<THREE.MeshBasicMaterial>(null)
  const [hovered, setHovered] = useState(false)

  const matDef = REGION_MATERIALS[materialKeyFor(def)]

  const flashUntilRef = useRef(0)
  const rippleRef = useRef({ active: false, t: 0 })

  const surfaceDir = useMemo(
    () => latLonToVector3(def.lat, def.lon, planetRadius).normalize(),
    [def.lat, def.lon, planetRadius],
  )

  const ringLayout = useMemo(() => {
    const dir = surfaceDir.clone()
    const pos = dir.clone().multiplyScalar(planetRadius * 1.012)
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir)
    const patchR = planetRadius * Math.sin(THREE.MathUtils.degToRad(def.angularRadiusDeg))
    const inner = Math.max(0.05, patchR * 0.2)
    const outer = inner + patchR * 0.28
    return { pos, q, inner, outer }
  }, [def.angularRadiusDeg, planetRadius, surfaceDir])

  const emissiveColor = useMemo(() => new THREE.Color(matDef.emissive), [matDef.emissive])

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

  const emissiveTarget = useRef(matDef.emissiveIntensity)

  useFrame((_, delta) => {
    const mat = matRef.current
    if (!mat) return

    const now = typeof performance !== 'undefined' ? performance.now() : 0
    if (now > 0 && now < flashUntilRef.current) {
      mat.emissiveIntensity = 1
      emissiveTarget.current = 1
    } else {
      const base = matDef.emissiveIntensity
      const target = hovered ? 0.9 : base
      emissiveTarget.current += (target - emissiveTarget.current) * Math.min(1, delta * 12)
      mat.emissiveIntensity = emissiveTarget.current
    }

    const rippleMesh = rippleMeshRef.current
    const rippleMat = rippleMatRef.current
    if (rippleRef.current.active && rippleMesh && rippleMat) {
      rippleRef.current.t += delta
      const u = rippleRef.current.t / 0.4
      if (u >= 1) {
        rippleRef.current.active = false
        rippleMesh.visible = false
      } else {
        rippleMesh.visible = true
        const sc = Math.max(0.02, u * 2.5)
        rippleMesh.scale.setScalar(sc)
        rippleMat.opacity = 0.6 * (1 - u)
      }
    }

    const edge = edgeMatRef.current
    if (edge) {
      edge.color.copy(emissiveColor)
    }
  })

  const navigateToRegion = (key: WorldRegion) => {
    const pathMode = key === 'building' ? 'foundation' : key
    navigate(`/brand/${slug}/${pathMode}`)
  }

  const triggerClickFeedback = () => {
    flashUntilRef.current =
      (typeof performance !== 'undefined' ? performance.now() : 0) + 150
    const mat = matRef.current
    if (mat) mat.emissiveIntensity = 1

    rippleRef.current = { active: true, t: 0 }
    const rippleMesh = rippleMeshRef.current
    const rippleMat = rippleMatRef.current
    if (rippleMesh && rippleMat) {
      rippleMesh.visible = true
      rippleMesh.position.copy(ringLayout.pos)
      rippleMesh.quaternion.copy(ringLayout.q)
      rippleMesh.scale.setScalar(0.02)
      rippleMat.opacity = 0.6
      rippleMat.color.copy(emissiveColor)
    }
  }

  return (
    <group>
      <mesh geometry={geometry} scale={1.018} raycast={() => undefined}>
        <meshBasicMaterial
          ref={edgeMatRef}
          color={matDef.emissive}
          transparent
          opacity={0.3}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>

      <mesh
        geometry={geometry}
        onClick={(e) => {
          e.stopPropagation()
          triggerClickFeedback()
          window.setTimeout(() => navigateToRegion(def.key), 150)
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

      <mesh ref={rippleMeshRef} position={ringLayout.pos} quaternion={ringLayout.q} visible={false} renderOrder={2} raycast={() => undefined}>
        <ringGeometry args={[ringLayout.inner, ringLayout.outer, 48]} />
        <meshBasicMaterial
          ref={rippleMatRef}
          color={matDef.emissive}
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}
