import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { useConfiguredTexture } from './hooks/useConfiguredTexture'
import { useShouldLoadTextures } from './hooks/useShouldLoadTextures'
import { MOON_TEXTURE } from './textureRegistry'

const MOON_BUMP_SCALE = 0.55

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
        bumpMap={surfaceTexture ?? undefined}
        bumpScale={surfaceTexture ? MOON_BUMP_SCALE : 0}
        roughnessMap={surfaceTexture ?? undefined}
        roughness={0.9}
        metalness={0}
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
