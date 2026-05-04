import { useFrame } from '@react-three/fiber'
import { useRef, useState } from 'react'
import * as THREE from 'three'

interface BrandNodeProps {
  position: [number, number, number]
  color: string
  label: string
  onSelect: (target: THREE.Vector3) => void
}

const RADIUS = 0.7

export function BrandNode({ position, color, label, onSelect }: BrandNodeProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const [hovered, setHovered] = useState(false)
  const baseY = position[1]

  // Subtle floating + breathing pulse for life-like feel.
  useFrame((state) => {
    if (!meshRef.current) return
    const t = state.clock.elapsedTime
    meshRef.current.position.y =
      baseY + Math.sin(t * 0.6 + position[0]) * 0.06
    const pulse = 1 + Math.sin(t * 1.2 + position[0]) * 0.02
    meshRef.current.scale.setScalar(hovered ? pulse * 1.08 : pulse)
  })

  return (
    <group position={position}>
      <pointLight color={color} intensity={1.2} distance={2.6} decay={2} position={[0, 0.4, 0.8]} />
      <mesh
        ref={meshRef}
        onPointerOver={(e) => {
          e.stopPropagation()
          setHovered(true)
          document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          setHovered(false)
          document.body.style.cursor = ''
        }}
        onClick={(e) => {
          e.stopPropagation()
          onSelect(new THREE.Vector3(...position))
        }}
        userData={{ label }}
      >
        <sphereGeometry args={[RADIUS, 48, 48]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={hovered ? 0.9 : 0.55}
          roughness={0.4}
          metalness={0.1}
        />
      </mesh>
    </group>
  )
}
