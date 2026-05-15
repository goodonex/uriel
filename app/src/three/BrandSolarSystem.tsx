import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as THREE from 'three'
import type { Brand } from '../types/db'
import { useUniverseNodeHover } from '../lib/universeNodeHover'
import { BrandPlanetGlow } from './BrandPlanetGlow'
import { BrandPlanetMesh } from './BrandPlanetMesh'
import {
  BRAND_MOON_ORBIT_RADIUS,
  BRAND_MOON_RADIUS,
  BRAND_PLANET_RADIUS,
  getBrandWorldColor,
} from './worldLayout'

function resolvePlanetColor(brand: Brand): string {
  const c = brand.color?.trim()
  if (c && c.startsWith('#')) return c
  return getBrandWorldColor(brand.slug)
}

interface BrandSolarSystemProps {
  brand: Brand
  position: [number, number, number]
}

export function BrandSolarSystem({ brand, position }: BrandSolarSystemProps) {
  const navigate = useNavigate()
  const groupRef = useRef<THREE.Group>(null)
  const moonRef = useRef<THREE.Mesh>(null)
  const [hovered, setHovered] = useState(false)

  const nodeEnter = useUniverseNodeHover((s) => s.nodeEnter)
  const nodeLeave = useUniverseNodeHover((s) => s.nodeLeave)

  const color = useMemo(() => resolvePlanetColor(brand), [brand])

  const orbitCurve = useMemo(
    () =>
      new THREE.EllipseCurve(0, 0, BRAND_MOON_ORBIT_RADIUS, BRAND_MOON_ORBIT_RADIUS, 0, Math.PI * 2, false, 0),
    [],
  )

  useFrame((state, delta) => {
    const g = groupRef.current
    if (g) {
      g.rotation.y += delta * 0.04
    }
    if (moonRef.current) {
      moonRef.current.rotation.y += delta * 0.12
      const t = state.clock.elapsedTime * 0.22
      const p = orbitCurve.getPoint(t % 1)
      moonRef.current.position.set(p.x, 0.35, p.y)
    }
  })

  return (
    <group ref={groupRef} position={position}>
      <pointLight
        color={color}
        intensity={2.8}
        distance={8}
        decay={2}
        position={[2, 3, 2]}
      />
      <pointLight color="#ffffff" intensity={0.4} distance={8} decay={2} position={[-3, -2, -2]} />

      <BrandPlanetMesh
        slug={brand.slug}
        radius={BRAND_PLANET_RADIUS}
        color={color}
        segments={64}
        emissiveIntensity={hovered ? 0.1 : 0.08}
        rotationSpeed={hovered ? 0.32 : 0.18}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHovered(true)
          nodeEnter(brand.slug)
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          setHovered(false)
          nodeLeave()
          document.body.style.cursor = ''
        }}
        onClick={(e) => {
          e.stopPropagation()
          navigate(`/brand/${brand.slug}`)
        }}
      />

      <BrandPlanetGlow
        planetRadius={BRAND_PLANET_RADIUS}
        color={color}
        baseOpacity={hovered ? 0.55 : 0.45}
      />

      <mesh ref={moonRef}>
        <sphereGeometry args={[BRAND_MOON_RADIUS, 32, 32]} />
        <meshStandardMaterial
          color="#6b6b78"
          emissive="#1a1a22"
          emissiveIntensity={0.08}
          roughness={0.95}
          metalness={0.02}
        />
      </mesh>

      <Html
        position={[BRAND_PLANET_RADIUS + 1.1, BRAND_PLANET_RADIUS * 0.35, 0]}
        distanceFactor={10}
        style={{ pointerEvents: 'none' }}
      >
        <div
          className="font-mono"
          style={{
            fontSize: 18,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--text-primary)',
            opacity: 1,
            whiteSpace: 'nowrap',
            textShadow: '0 1px 14px rgba(0,0,0,0.55)',
          }}
        >
          {brand.name}
        </div>
      </Html>
    </group>
  )
}
