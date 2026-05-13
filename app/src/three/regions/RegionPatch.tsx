import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import * as THREE from 'three'
import { latLonToVector3, type RegionDef } from './regionGeometry'

interface RegionPatchProps {
  def: RegionDef
  slug: string
  planetRadius: number
}

export function RegionPatch({ def, slug, planetRadius }: RegionPatchProps) {
  const navigate = useNavigate()
  const pos = useMemo(
    () => latLonToVector3(def.lat, def.lon, planetRadius + 0.06),
    [def.lat, def.lon, planetRadius],
  )

  const up = useMemo(() => pos.clone().normalize(), [pos])
  const q = useMemo(() => {
    const qq = new THREE.Quaternion()
    qq.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up)
    return qq
  }, [up])

  return (
    <mesh
      position={[pos.x, pos.y, pos.z]}
      quaternion={q}
      onClick={(e) => {
        e.stopPropagation()
        navigate(`/brand/${slug}/${def.key}`)
      }}
      onPointerOver={() => {
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        document.body.style.cursor = ''
      }}
    >
      <circleGeometry args={[def.patchRadius, 30]} />
      <meshStandardMaterial
        color={def.tone}
        transparent
        opacity={0.78}
        roughness={0.8}
        metalness={0.03}
        emissive={def.accent}
        emissiveIntensity={0.25}
      />
    </mesh>
  )
}

