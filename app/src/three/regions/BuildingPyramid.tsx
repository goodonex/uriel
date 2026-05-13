import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { latLonToVector3, type RegionDef } from './regionGeometry'
import { useGrowthSpring } from './useGrowthSpring'

interface BuildingPyramidProps {
  def: RegionDef
  planetRadius: number
  foundationHealth: number
}

export function BuildingPyramid({
  def,
  planetRadius,
  foundationHealth,
}: BuildingPyramidProps) {
  const base = useMemo(
    () => latLonToVector3(def.lat, def.lon, planetRadius + 0.2),
    [def.lat, def.lon, planetRadius],
  )
  const trigger = String(Math.round(foundationHealth))
  const spring = useGrowthSpring(trigger, Math.max(0.1, foundationHealth / 100))

  useFrame((_, delta) => {
    const phase = (Date.now() % 5000) / 5000
    void phase
    void delta
  })

  return (
    <group position={[base.x, base.y, base.z]}>
      <mesh scale={[1, spring.get(), 1]}>
        <coneGeometry args={[0.55, 1.4, 4]} />
        <meshStandardMaterial
          color={def.accent}
          emissive={def.accent}
          emissiveIntensity={0.1 + (foundationHealth / 100) * 0.55}
          roughness={0.7}
          metalness={0.12}
        />
      </mesh>
    </group>
  )
}
