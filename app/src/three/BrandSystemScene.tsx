import { Line } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { BRAND_MOON_ORBIT_RADIUS, getBrandWorldColor } from './worldLayout'

export function BrandSystemScene({ slug }: { slug: string }) {
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
      <pointLight color={color} intensity={1.25} distance={24} position={[0, 2.2, 0]} />
      <mesh ref={planetRef}>
        <sphereGeometry args={[2.4, 80, 80]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.16}
          roughness={0.84}
          metalness={0.06}
        />
      </mesh>
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
      <mesh ref={moonRef}>
        <sphereGeometry args={[0.46, 30, 30]} />
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
