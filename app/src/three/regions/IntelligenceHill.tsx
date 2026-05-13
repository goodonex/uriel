import { Line } from '@react-three/drei'
import { useMemo } from 'react'
import { latLonToVector3, type RegionDef } from './regionGeometry'

interface IntelligenceHillProps {
  def: RegionDef
  planetRadius: number
  hasData: boolean
  sourceAnchors: Array<[number, number, number]>
}

export function IntelligenceHill({
  def,
  planetRadius,
  hasData,
  sourceAnchors,
}: IntelligenceHillProps) {
  const base = useMemo(
    () => latLonToVector3(def.lat, def.lon, planetRadius + 0.12),
    [def.lat, def.lon, planetRadius],
  )

  return (
    <group position={[base.x, base.y, base.z]}>
      <mesh>
        <sphereGeometry args={[0.36, 24, 24]} />
        <meshStandardMaterial
          color={def.tone}
          emissive={def.accent}
          emissiveIntensity={hasData ? 0.22 : 0.08}
          roughness={0.9}
        />
      </mesh>
      <pointLight
        color={def.accent}
        intensity={hasData ? 0.7 : 0.2}
        distance={4}
        decay={2}
        position={[0, 0.3, 0]}
      />
      {hasData
        ? sourceAnchors.map((p, i) => (
            <Line
              key={i}
              points={[
                [0, 0.18, 0],
                [p[0], p[1], p[2]],
              ]}
              color={def.accent}
              transparent
              opacity={0.28}
              lineWidth={1}
            />
          ))
        : null}
    </group>
  )
}
