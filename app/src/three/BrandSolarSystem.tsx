import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as THREE from 'three'
import type { Brand } from '../types/db'
import { useUniverseNodeHover } from '../lib/universeNodeHover'
import { createPlanetSurfaceTextures } from './textures/noiseSurface'
import {
  BRAND_MOON_ORBIT_RADIUS,
  BRAND_MOON_RADIUS,
  BRAND_PLANET_RADIUS,
  getBrandWorldColor,
} from './worldLayout'

function createRadialGlowTexture(): THREE.CanvasTexture {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    const tex = new THREE.CanvasTexture(canvas)
    tex.needsUpdate = true
    return tex
  }
  const g = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  )
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.35, 'rgba(255,255,255,0.35)')
  g.addColorStop(0.7, 'rgba(255,255,255,0.08)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(canvas)
  tex.needsUpdate = true
  return tex
}

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
  const planetRef = useRef<THREE.Mesh>(null)
  const moonRef = useRef<THREE.Mesh>(null)
  const glowRef = useRef<THREE.Sprite>(null)
  const [hovered, setHovered] = useState(false)

  const nodeEnter = useUniverseNodeHover((s) => s.nodeEnter)
  const nodeLeave = useUniverseNodeHover((s) => s.nodeLeave)

  const color = useMemo(() => resolvePlanetColor(brand), [brand])
  const surfaceTextures = useMemo(
    () =>
      createPlanetSurfaceTextures({
        baseColor: color,
        seed: brand.slug.length * 3.17,
      }),
    [brand.slug.length, color],
  )

  const glowTexture = useMemo(() => createRadialGlowTexture(), [])
  const glowMaterial = useMemo(() => {
    const m = new THREE.SpriteMaterial({
      map: glowTexture,
      color,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0.4,
    })
    return m
  }, [color, glowTexture])

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
    if (planetRef.current) {
      planetRef.current.rotation.y += delta * (hovered ? 0.32 : 0.18)
    }
    if (moonRef.current) {
      moonRef.current.rotation.y += delta * 0.12
      const t = state.clock.elapsedTime * 0.22
      const p = orbitCurve.getPoint(t % 1)
      moonRef.current.position.set(p.x, 0.35, p.y)
    }
    if (glowRef.current && glowMaterial) {
      glowMaterial.opacity = hovered ? 0.45 : 0.25
    }
  })

  return (
    <group ref={groupRef} position={position}>
      <pointLight
        color={color}
        intensity={1.8}
        distance={8}
        decay={2}
        position={[2, 3, 2]}
      />
      <pointLight color="#ffffff" intensity={0.3} distance={8} decay={2} position={[-2.2, -2.2, -1.8]} />

      <mesh
        ref={planetRef}
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
      >
        <sphereGeometry args={[BRAND_PLANET_RADIUS, 64, 64]} />
        <meshStandardMaterial
          map={surfaceTextures.map}
          bumpMap={surfaceTextures.bumpMap}
          roughnessMap={surfaceTextures.roughnessMap}
          bumpScale={0.15}
          color={color}
          emissive={color}
          emissiveIntensity={hovered ? 0.12 : 0.08}
          roughness={0.82}
          metalness={0.08}
        />
      </mesh>

      <sprite
        ref={glowRef}
        scale={[BRAND_PLANET_RADIUS * 1.3, BRAND_PLANET_RADIUS * 1.3, 1]}
        material={glowMaterial}
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
            fontSize: 16,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--text-primary)',
            opacity: 0.8,
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
