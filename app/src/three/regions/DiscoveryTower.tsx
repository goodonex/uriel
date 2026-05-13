import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { latLonToVector3, type RegionDef } from './regionGeometry'
import { useGrowthSpring } from './useGrowthSpring'

interface DiscoveryTowerProps {
  def: RegionDef
  planetRadius: number
  signalCount: number
}

export function DiscoveryTower({
  def,
  planetRadius,
  signalCount,
}: DiscoveryTowerProps) {
  const base = useMemo(
    () => latLonToVector3(def.lat, def.lon, planetRadius + 0.12),
    [def.lat, def.lon, planetRadius],
  )
  const spring = useGrowthSpring(String(signalCount), 1)
  const pulse = useMemo(() => ({ v: 0 }), [])

  useFrame((state) => {
    pulse.v =
      signalCount > 0
        ? 0.18 + Math.sin(state.clock.elapsedTime * 2.2) * 0.12
        : 0.05
  })

  return (
    <group position={[base.x, base.y, base.z]}>
      <mesh scale={[1, spring.get(), 1]}>
        <cylinderGeometry args={[0.18, 0.24, 1.3, 14]} />
        <meshStandardMaterial
          color={def.accent}
          emissive={def.accent}
          emissiveIntensity={0.12 + pulse.v}
          roughness={0.65}
          metalness={0.18}
        />
      </mesh>
      <mesh position={[0, 0.84, 0]}>
        <sphereGeometry args={[0.16, 16, 16]} />
        <meshStandardMaterial
          color="#dfe8ff"
          emissive="#dfe8ff"
          emissiveIntensity={0.22 + pulse.v}
        />
      </mesh>
      {Array.from({ length: Math.min(signalCount, 8) }).map((_, i) => {
        const a = (i / Math.max(1, signalCount)) * Math.PI * 2
        const r = 0.55
        return (
          <mesh key={i} position={[Math.cos(a) * r, 0.08, Math.sin(a) * r]}>
            <sphereGeometry args={[0.05, 12, 12]} />
            <meshStandardMaterial
              color={def.accent}
              emissive={def.accent}
              emissiveIntensity={0.22}
            />
          </mesh>
        )
      })}
    </group>
  )
}
