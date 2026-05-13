/**
 * World — Wurzel der dreischichtigen Welt (Universe / Brand-System / Planet-Surface / Moon-Surface).
 *
 * Phase 1: leere Bühne mit Basis-Lights. Inhalte kommen in Phase 3 (Universe),
 * Phase 4 (Brand-System), Phase 5 (Planet-Surface) und Phase 7 (Moon-Surface).
 *
 * Die Welt liest die aktuelle Stage aus `useWorldCamera` (nicht aus der Route),
 * damit Kamera-Tweens und Mount-Logik gemeinsam vom Store gesteuert werden.
 */
import { Suspense } from 'react'
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

  return (
    <Suspense fallback={null}>
      <ambientLight intensity={stage === 'universe' ? 0.15 : 0.22} />
      <hemisphereLight args={['#2a2a38', '#080810', 0.35]} />
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
      {/* Stage-bewusste Welt-Inhalte folgen in Phase 4–7. `stage` wird hier
          schon konsumiert damit das Mount-Pattern für späteres Conditional
          Rendering steht (kein React-Render ohne Bezug zur aktuellen Ebene). */}
      <group name={`world-stage-${stage}`} />
    </Suspense>
  )
}
