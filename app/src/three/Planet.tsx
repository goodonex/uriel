import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'

interface PlanetProps {
  radius?: number
}

export function Planet({ radius = 5 }: PlanetProps) {
  const meshRef = useRef<THREE.Mesh>(null)

  useFrame((_, delta) => {
    if (!meshRef.current) return
    meshRef.current.rotation.y += delta * 0.035
  })

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[radius, 96, 96]} />
      <meshStandardMaterial
        color="#1d1d24"
        roughness={0.9}
        metalness={0.03}
        emissive="#0d0d12"
        emissiveIntensity={0.08}
      />
    </mesh>
  )
}
