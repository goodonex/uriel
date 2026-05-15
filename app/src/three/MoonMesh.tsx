import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useLayoutEffect, useRef } from 'react'
import * as THREE from 'three'
import { useConfiguredTexture } from './hooks/useConfiguredTexture'
import { useShouldLoadTextures } from './hooks/useShouldLoadTextures'
import { MOON_TEXTURE } from './textureRegistry'

const MOON_BUMP_SCALE = 0.72

interface MoonMeshProps {
  radius: number
  segments?: number
  rotationSpeed?: number
  onClick?: (e: ThreeEvent<MouseEvent>) => void
  onPointerOver?: (e: ThreeEvent<PointerEvent>) => void
  onPointerOut?: () => void
}

function MoonMeshInner({
  radius,
  segments = 96,
  rotationSpeed = 0,
  surfaceTexture,
  onClick,
  onPointerOver,
  onPointerOut,
}: MoonMeshProps & { surfaceTexture: THREE.Texture | null }) {
  const meshRef = useRef<THREE.Mesh>(null)

  useLayoutEffect(() => {
    const geo = meshRef.current?.geometry
    if (geo && !geo.attributes.uv2) {
      geo.setAttribute('uv2', geo.attributes.uv)
    }
  }, [])

  useFrame((_, delta) => {
    if (!meshRef.current || rotationSpeed <= 0) return
    meshRef.current.rotation.y += delta * rotationSpeed
  })

  return (
    <mesh
      ref={meshRef}
      onClick={onClick}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
    >
      <sphereGeometry args={[radius, segments, segments]} />
      <meshStandardMaterial
        color="#8a8276"
        map={surfaceTexture ?? undefined}
        bumpMap={surfaceTexture ?? undefined}
        bumpScale={surfaceTexture ? MOON_BUMP_SCALE : 0}
        roughnessMap={surfaceTexture ?? undefined}
        aoMap={surfaceTexture ?? undefined}
        aoMapIntensity={surfaceTexture ? 0.55 : 0}
        roughness={0.92}
        metalness={0}
        emissive="#1a1814"
        emissiveIntensity={surfaceTexture ? 0.03 : 0}
      />
    </mesh>
  )
}

function MoonMeshWithTexture(props: MoonMeshProps) {
  const surfaceTexture = useConfiguredTexture(MOON_TEXTURE)
  return <MoonMeshInner {...props} surfaceTexture={surfaceTexture} />
}

export function MoonMesh(props: MoonMeshProps) {
  const canLoad = useShouldLoadTextures()
  if (canLoad) {
    return <MoonMeshWithTexture {...props} />
  }
  return <MoonMeshInner {...props} surfaceTexture={null} />
}
