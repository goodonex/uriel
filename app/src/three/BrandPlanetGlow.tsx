import { useMemo } from 'react'
import * as THREE from 'three'
import { useConfiguredTexture } from './hooks/useConfiguredTexture'
import { useShouldLoadTextures } from './hooks/useShouldLoadTextures'
import { GLOW_TEXTURE } from './textureRegistry'

interface BrandPlanetGlowProps {
  planetRadius: number
  color: string
  baseOpacity?: number
}

function BrandPlanetGlowInner({
  planetRadius,
  color,
  glowTexture,
  baseOpacity = 0.45,
}: BrandPlanetGlowProps & { glowTexture: THREE.Texture }) {
  const material = useMemo(
    () =>
      new THREE.SpriteMaterial({
        map: glowTexture,
        color,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: baseOpacity,
      }),
    [color, glowTexture, baseOpacity],
  )

  const scale = planetRadius * 1.6

  return <sprite scale={[scale, scale, 1]} material={material} />
}

function BrandPlanetGlowWithTexture(props: BrandPlanetGlowProps) {
  const glowTexture = useConfiguredTexture(GLOW_TEXTURE)
  return <BrandPlanetGlowInner {...props} glowTexture={glowTexture} />
}

export function BrandPlanetGlow(props: BrandPlanetGlowProps) {
  const canLoad = useShouldLoadTextures()
  if (!canLoad) return null
  return <BrandPlanetGlowWithTexture {...props} />
}
