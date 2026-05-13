import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { latLonToVector3, type RegionDef } from './regionGeometry'
import { useGrowthSpring } from './useGrowthSpring'

interface FoundationStructureProps {
  def: RegionDef
  planetRadius: number
  foundationHealth: number
  signalCount: number
}

export function FoundationStructure({
  def,
  planetRadius,
  foundationHealth,
  signalCount,
}: FoundationStructureProps) {
  const base = useMemo(
    () => latLonToVector3(def.lat, def.lon, planetRadius + 0.2),
    [def.lat, def.lon, planetRadius],
  )
  const trigger = `${Math.round(foundationHealth)}-${signalCount}`
  const spring = useGrowthSpring(trigger, Math.max(0.2, foundationHealth / 100))
  const pulse = useMemo(() => ({ v: 0 }), [])
  const SCALE = 2.5

  useFrame((state) => {
    pulse.v =
      signalCount > 0
        ? 0.18 + Math.sin(state.clock.elapsedTime * 2.2) * 0.12
        : 0.04
  })

  return (
    <group position={[base.x, base.y, base.z]} scale={[SCALE, SCALE, SCALE]}>
      <mesh scale={[1, spring.get(), 1]}>
        <coneGeometry args={[0.62, 1.4, 4]} />
        <meshStandardMaterial
          color={def.accent}
          emissive={def.accent}
          emissiveIntensity={0.1 + (foundationHealth / 100) * 0.45}
          roughness={0.7}
          metalness={0.12}
        />
      </mesh>
      <mesh position={[0, 1.02, 0]}>
        <cylinderGeometry args={[0.18, 0.24, 0.85, 14]} />
        <meshStandardMaterial
          color={def.accent}
          emissive={def.accent}
          emissiveIntensity={0.1 + pulse.v}
          roughness={0.64}
          metalness={0.2}
        />
      </mesh>
      <mesh position={[0, 1.56, 0]}>
        <sphereGeometry args={[0.11, 14, 14]} />
        <meshStandardMaterial
          color="#dfe8ff"
          emissive="#dfe8ff"
          emissiveIntensity={0.18 + pulse.v}
        />
      </mesh>
    </group>
  )
}
