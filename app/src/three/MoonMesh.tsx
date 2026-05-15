import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { useConfiguredTexture } from './hooks/useConfiguredTexture'
import { MOON_TEXTURE, shouldLoadTextures } from './textureRegistry'

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
        bumpScale={surfaceTexture ? 0.32 : 0}
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
  if (shouldLoadTextures()) {
    return <MoonMeshWithTexture {...props} />
  }
  return <MoonMeshInner {...props} surfaceTexture={null} />
}
