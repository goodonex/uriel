/**
 * World — Wurzel der dreischichtigen Welt (Universe / Brand-System / Planet-Surface / Moon-Surface).
 */
import { Suspense } from 'react'
import { Stars } from '@react-three/drei'
import { useWorldCamera } from '../store/worldCamera'
import { BrandSystemScene } from './BrandSystemScene'
import { Moon } from './Moon'
import { PlanetSurface } from './PlanetSurface'
import { Universe } from './Universe'
import { WorldCameraController } from './WorldCameraController'
import { BRAND_MOON_SURFACE_OFFSET, getBrandSystemPosition } from './worldLayout'

export function World() {
  const stage = useWorldCamera((s) => s.stage)
  const brandSlug = useWorldCamera((s) => s.brandSlug)
  const anchor = getBrandSystemPosition(brandSlug)

  const showStars = stage === 'universe' || stage === 'brand-system'

  return (
    <Suspense fallback={null}>
      {showStars ? (
        <Stars
          radius={150}
          depth={50}
          count={3500}
          factor={4}
          saturation={0}
          fade
          speed={0.5}
        />
      ) : null}
      {stage === 'universe' ? <fog attach="fog" args={['#080810', 60, 120]} /> : null}
      <ambientLight intensity={0.25} />
      <WorldCameraController />
      {stage === 'universe' ? <Universe /> : null}
      {stage === 'brand-system' && brandSlug ? (
        <group position={[anchor.x, anchor.y, anchor.z]}>
          <BrandSystemScene slug={brandSlug} />
        </group>
      ) : null}
      {stage === 'planet-surface' && brandSlug ? (
        <group position={[anchor.x, anchor.y, anchor.z]}>
          <PlanetSurface slug={brandSlug} />
        </group>
      ) : null}
      {stage === 'moon-surface' && brandSlug ? (
        <group
          position={[
            anchor.x + BRAND_MOON_SURFACE_OFFSET[0],
            anchor.y + BRAND_MOON_SURFACE_OFFSET[1],
            anchor.z + BRAND_MOON_SURFACE_OFFSET[2],
          ]}
        >
          <Moon slug={brandSlug} />
        </group>
      ) : null}
      <group name={`world-stage-${stage}`} />
    </Suspense>
  )
}
