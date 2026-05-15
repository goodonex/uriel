import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useLayoutEffect, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import { useBrandPlanetSurfaceTexture } from './hooks/useBrandPlanetSurfaceTexture'

const PLANET_BUMP_SCALE = 0.28

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

  useLayoutEffect(() => {
    const geo = ref.current?.geometry
    if (geo && !geo.attributes.uv2) {
      geo.setAttribute('uv2', geo.attributes.uv)
    }
  }, [ref])

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
        map={surfaceTexture ?? undefined}
        bumpMap={surfaceTexture ?? undefined}
        bumpScale={surfaceTexture ? PLANET_BUMP_SCALE : 0}
        roughnessMap={surfaceTexture ?? undefined}
        aoMap={surfaceTexture ?? undefined}
        aoMapIntensity={surfaceTexture ? 0.5 : 0}
        roughness={surfaceTexture ? 0.92 : 0.82}
        metalness={0.04}
        emissive={color}
        emissiveIntensity={surfaceTexture ? emissiveIntensity * 0.72 : emissiveIntensity}
      />
    </mesh>
  )
}

export function BrandPlanetMesh(props: BrandPlanetMeshProps) {
  const surfaceTexture = useBrandPlanetSurfaceTexture(props.slug)
  return <BrandPlanetMeshInner {...props} surfaceTexture={surfaceTexture} />
}
