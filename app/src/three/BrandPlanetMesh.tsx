import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useRef, type RefObject } from 'react'
import * as THREE from 'three'
import { useConfiguredTexture } from './hooks/useConfiguredTexture'
import { useShouldLoadTextures } from './hooks/useShouldLoadTextures'
import { PLANET_TEXTURES } from './textureRegistry'

const PLANET_BUMP_SCALE = 0.42

export interface BrandPlanetMaterialProps {
  color: string
  surfaceTexture: THREE.Texture | null
  emissiveIntensity?: number
}

export function createBrandPlanetMaterialProps(
  color: string,
  surfaceTexture: THREE.Texture | null,
  emissiveIntensity = 0.08,
): BrandPlanetMaterialProps {
  return { color, surfaceTexture, emissiveIntensity }
}

interface BrandPlanetMeshProps {
  slug: string
  radius: number
  color: string
  segments?: number
  emissiveIntensity?: number
  meshRef?: RefObject<THREE.Mesh | null>
  rotationSpeed?: number
  onPointerOver?: (e: ThreeEvent<PointerEvent>) => void
  onPointerOut?: () => void
  onClick?: (e: ThreeEvent<MouseEvent>) => void
}

function BrandPlanetMeshInner({
  radius,
  color,
  surfaceTexture,
  segments = 64,
  emissiveIntensity = 0.08,
  meshRef,
  rotationSpeed = 0.18,
  onPointerOver,
  onPointerOut,
  onClick,
}: Omit<BrandPlanetMeshProps, 'slug'> & { surfaceTexture: THREE.Texture | null }) {
  const localRef = useRef<THREE.Mesh>(null)
  const ref = meshRef ?? localRef

  useFrame((_, delta) => {
    if (!ref.current || rotationSpeed <= 0) return
    ref.current.rotation.y += delta * rotationSpeed
  })

  return (
    <mesh
      ref={ref}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
      onClick={onClick}
    >
      <sphereGeometry args={[radius, segments, segments]} />
      <meshStandardMaterial
        color={color}
        bumpMap={surfaceTexture ?? undefined}
        bumpScale={surfaceTexture ? PLANET_BUMP_SCALE : 0}
        roughnessMap={surfaceTexture ?? undefined}
        roughness={surfaceTexture ? 0.82 : 0.75}
        metalness={0.12}
        emissive={color}
        emissiveIntensity={surfaceTexture ? emissiveIntensity * 0.5 : emissiveIntensity}
      />
    </mesh>
  )
}

function BrandPlanetMeshWithTexture(props: BrandPlanetMeshProps & { texturePath: string }) {
  const surfaceTexture = useConfiguredTexture(props.texturePath)
  return (
    <BrandPlanetMeshInner
      {...props}
      surfaceTexture={surfaceTexture}
    />
  )
}

export function BrandPlanetMesh(props: BrandPlanetMeshProps) {
  const texturePath = PLANET_TEXTURES[props.slug]
  const canLoad = useShouldLoadTextures() && Boolean(texturePath)

  if (canLoad && texturePath) {
    return <BrandPlanetMeshWithTexture {...props} texturePath={texturePath} />
  }

  return <BrandPlanetMeshInner {...props} surfaceTexture={null} />
}
