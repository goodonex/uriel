import { Html } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as THREE from 'three'
import type { Brand } from '../types/db'
import { useUniverseNodeHover } from '../lib/universeNodeHover'
import { BrandPlanetGlow } from './BrandPlanetGlow'
import { BrandPlanetMesh } from './BrandPlanetMesh'
import {
  BRAND_MOON_ORBIT_RADIUS,
  BRAND_MOON_RADIUS,
  UNIVERSE_PLANET_RADIUS,
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
  const { clock } = useThree()
  const groupRef = useRef<THREE.Group>(null)
  const moonRef = useRef<THREE.Mesh>(null)
  const planetShellRef = useRef<THREE.Group>(null)
  const [hovered, setHovered] = useState(false)

  const moonBoostUntilRef = useRef(0)
  const clickPulseRef = useRef<{ start: number } | null>(null)

  const nodeEnter = useUniverseNodeHover((s) => s.nodeEnter)
  const nodeLeave = useUniverseNodeHover((s) => s.nodeLeave)

  const color = useMemo(() => resolvePlanetColor(brand), [brand])
  const planetRadius = UNIVERSE_PLANET_RADIUS

  const orbitCurve = useMemo(
    () =>
      new THREE.EllipseCurve(0, 0, BRAND_MOON_ORBIT_RADIUS, BRAND_MOON_ORBIT_RADIUS, 0, Math.PI * 2, false, 0),
    [],
  )

  const orbitResources = useMemo(() => {
    const pts = orbitCurve.getPoints(96).map((p) => new THREE.Vector3(p.x, 0.35, p.y))
    const geo = new THREE.BufferGeometry().setFromPoints(pts)
    const mat = new THREE.LineDashedMaterial({
      color: 0xb8c4dd,
      transparent: true,
      opacity: 0.22,
      dashSize: 0.07,
      gapSize: 0.055,
      depthWrite: false,
    })
    const line = new THREE.Line(geo, mat)
    line.computeLineDistances()
    return { line, mat, geo }
  }, [orbitCurve])

  useEffect(
    () => () => {
      orbitResources.geo.dispose()
      orbitResources.mat.dispose()
    },
    [orbitResources.geo, orbitResources.mat],
  )

  useFrame((state, delta) => {
    const elapsed = state.clock.elapsedTime
    const g = groupRef.current
    const orbitYaw = 0.04
    if (g) {
      g.rotation.y += delta * (hovered ? orbitYaw * 0.2 : orbitYaw)
    }

    const orbitBoost = elapsed < moonBoostUntilRef.current ? 1.85 : 1

    if (moonRef.current) {
      moonRef.current.rotation.y += delta * 0.12 * orbitBoost
      const t = elapsed * 0.22 * orbitBoost
      const p = orbitCurve.getPoint(t % 1)
      moonRef.current.position.set(p.x, 0.35, p.y)
    }

    const shell = planetShellRef.current
    if (shell) {
      let s = 1
      const pulse = clickPulseRef.current
      if (pulse) {
        const u = (elapsed - pulse.start) / 0.25
        if (u >= 1) {
          clickPulseRef.current = null
        } else {
          s = 1 + 0.06 * Math.sin(Math.PI * Math.min(1, Math.max(0, u)))
        }
      }
      shell.scale.setScalar(s)
    }

    orbitResources.mat.opacity = hovered ? 0.5 : 0.22
  })

  return (
    <group ref={groupRef} position={position}>
      <pointLight
        color={color}
        intensity={6}
        distance={16}
        decay={1.8}
        position={[2.5, 3.5, 2]}
      />
      <pointLight color="#eef2ff" intensity={1.1} distance={18} decay={1.8} position={[-4, -1, -3]} />

      <primitive object={orbitResources.line} />

      <group ref={planetShellRef}>
        <BrandPlanetMesh
          slug={brand.slug}
          radius={planetRadius}
          color={color}
          segments={72}
          emissiveIntensity={hovered ? 0.34 : 0.26}
          rotationSpeed={hovered ? 0.036 : 0.18}
          onPointerOver={(e) => {
            e.stopPropagation()
            setHovered(true)
            moonBoostUntilRef.current = clock.elapsedTime + 1
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
            clickPulseRef.current = { start: clock.elapsedTime }
            window.setTimeout(() => navigate(`/brand/${brand.slug}`), 250)
          }}
        />
      </group>

      <BrandPlanetGlow
        planetRadius={planetRadius}
        color={color}
        baseOpacity={hovered ? 0.82 : 0.72}
      />

      <mesh ref={moonRef}>
        <sphereGeometry args={[BRAND_MOON_RADIUS, 32, 32]} />
        <meshStandardMaterial
          color="#8a8a9a"
          emissive="#2a2a36"
          emissiveIntensity={0.14}
          roughness={0.9}
          metalness={0.04}
        />
      </mesh>

      <Html
        center
        transform
        position={[0, planetRadius + 1.65, 0]}
        distanceFactor={5.2}
        zIndexRange={[50, 0]}
        style={{ pointerEvents: 'none' }}
      >
        <motion.div
          initial={{ opacity: 0.75 }}
          animate={{ opacity: hovered ? 1 : 0.82 }}
          transition={{ duration: 0.15 }}
        >
          <div
            className="universe-planet-label"
            style={{
              color: hovered ? '#ffffff' : 'var(--text-primary)',
              fontSize: hovered ? 18 : 13,
              fontWeight: hovered ? 600 : 500,
              letterSpacing: hovered ? '0.06em' : '0.14em',
              borderColor: hovered
                ? `color-mix(in srgb, ${color} 55%, transparent)`
                : 'rgba(255,255,255,0.14)',
              boxShadow: hovered
                ? `0 0 28px color-mix(in srgb, ${color} 50%, transparent), 0 8px 28px rgba(0,0,0,0.45)`
                : '0 8px 28px rgba(0,0,0,0.45)',
              textShadow: hovered
                ? `0 0 18px color-mix(in srgb, ${color} 55%, transparent)`
                : undefined,
            }}
          >
            {brand.name}
          </div>
        </motion.div>
      </Html>
    </group>
  )
}
