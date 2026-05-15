import { Line } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import * as THREE from 'three'
import { BrandPlanetMesh } from './BrandPlanetMesh'
import {
  BRAND_MOON_ORBIT_RADIUS,
  BRAND_MOON_RADIUS,
  BRAND_PLANET_RADIUS,
  getBrandWorldColor,
} from './worldLayout'

export function BrandSystemScene({ slug }: { slug: string }) {
  const navigate = useNavigate()
  const planetRef = useRef<THREE.Mesh>(null)
  const moonRef = useRef<THREE.Mesh>(null)
  const orbit = useMemo(
    () =>
      new THREE.EllipseCurve(
        0,
        0,
        BRAND_MOON_ORBIT_RADIUS,
        BRAND_MOON_ORBIT_RADIUS * 0.72,
        0,
        Math.PI * 2,
      ),
    [],
  )
  const orbitPoints = useMemo(() => {
    const pts = orbit
      .getPoints(90)
      .map((p) => [p.x, 0, p.y] as [number, number, number])
    return pts
  }, [orbit])

  const color = getBrandWorldColor(slug)

  useFrame((state, delta) => {
    if (planetRef.current) planetRef.current.rotation.y += delta * 0.09
    if (moonRef.current) {
      moonRef.current.rotation.y += delta * 0.08
      const t = (state.clock.elapsedTime * 0.12) % 1
      const p = orbit.getPoint(t)
      moonRef.current.position.set(p.x, 0.2, p.y)
    }
  })

  return (
    <group>
      <pointLight color={color} intensity={1.8} distance={8} decay={2} position={[2, 3, 2]} />
      <pointLight color="#ffffff" intensity={0.4} distance={8} decay={2} position={[-3, -2, -2]} />
      <BrandPlanetMesh
        slug={slug}
        radius={BRAND_PLANET_RADIUS}
        color={color}
        segments={80}
        meshRef={planetRef}
        rotationSpeed={0.09}
      />
      <Line
        points={orbitPoints}
        color="#b8bdd8"
        transparent
        opacity={0.15}
        dashed
        dashScale={16}
        dashSize={0.55}
        gapSize={0.45}
        lineWidth={1}
      />
      <mesh
        ref={moonRef}
        onClick={(e) => {
          e.stopPropagation()
          navigate(`/brand/${slug}/deliver`)
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          document.body.style.cursor = ''
        }}
      >
        <sphereGeometry args={[BRAND_MOON_RADIUS, 30, 30]} />
        <meshStandardMaterial
          color="#6d6f79"
          emissive="#1f2027"
          emissiveIntensity={0.08}
          roughness={0.92}
        />
      </mesh>
    </group>
  )
}
