import { MeshDistortMaterial } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { useUniverseNodeHover } from '../lib/universeNodeHover'

interface BrandNodeProps {
  slug: string
  position: [number, number, number]
  color: string
  label: string
  onSelect: (target: THREE.Vector3) => void
}

const RADIUS = 0.7

export function BrandNode({ slug, position, color, label, onSelect }: BrandNodeProps) {
  const groupRef = useRef<THREE.Group>(null)
  const meshRef = useRef<THREE.Mesh>(null)
  const atmosphereRef = useRef<THREE.Mesh>(null)
  const [hovered, setHovered] = useState(false)
  const nodeEnter = useUniverseNodeHover((s) => s.nodeEnter)
  const nodeLeave = useUniverseNodeHover((s) => s.nodeLeave)

  /** Atmosphäre darf Raycasts nicht abfangen — sonst blockiert sie den Planeten. */
  useLayoutEffect(() => {
    const m = atmosphereRef.current
    if (m) m.raycast = () => {}
  }, [])

  useFrame((state, delta) => {
    const g = groupRef.current
    if (g) {
      const t = state.clock.elapsedTime
      const yOff = Math.sin(t * 0.6 + position[0]) * 0.06
      g.position.set(position[0], position[1] + yOff, position[2])
      const pulse = 1 + Math.sin(t * 1.2 + position[0]) * 0.02
      g.scale.setScalar(hovered ? pulse * 1.06 : pulse)
    }
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * (hovered ? 0.35 : 0.18)
    }
    if (atmosphereRef.current) {
      atmosphereRef.current.rotation.y -= delta * 0.06
    }
  })

  return (
    <group ref={groupRef} position={position}>
      <pointLight
        color={color}
        intensity={0.42}
        distance={4}
        decay={2}
        position={[1.4, 0.35, 1.1]}
      />
      <mesh
        ref={meshRef}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHovered(true)
          nodeEnter(slug)
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          setHovered(false)
          nodeLeave()
          document.body.style.cursor = ''
        }}
        onClick={(e) => {
          e.stopPropagation()
          onSelect(new THREE.Vector3(...position))
        }}
        userData={{ label }}
      >
        <sphereGeometry args={[RADIUS, 64, 64]} />
        <MeshDistortMaterial
          color={color}
          emissive={color}
          emissiveIntensity={hovered ? 0.2 : 0.08}
          roughness={0.94}
          metalness={0.05}
          clearcoat={0.12}
          clearcoatRoughness={0.55}
          distort={hovered ? 0.32 : 0.22}
          speed={hovered ? 1.8 : 1.1}
          radius={0.75}
        />
      </mesh>
      <mesh ref={atmosphereRef} scale={1.06}>
        <sphereGeometry args={[RADIUS, 48, 48]} />
        <meshPhysicalMaterial
          color={color}
          transparent
          opacity={0.14}
          roughness={0.35}
          metalness={0}
          emissive={color}
          emissiveIntensity={0.04}
          transmission={0.45}
          thickness={0.35}
          ior={1.12}
          depthWrite={false}
          side={THREE.FrontSide}
        />
      </mesh>
    </group>
  )
}
