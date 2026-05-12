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
import { WorldCameraController } from './WorldCameraController'

export function World() {
  const stage = useWorldCamera((s) => s.stage)

  return (
    <Suspense fallback={null}>
      <ambientLight intensity={0.3} />
      <WorldCameraController />
      {/* Stage-bewusste Welt-Inhalte folgen in Phase 3–7. `stage` wird hier
          schon konsumiert damit das Mount-Pattern für späteres Conditional
          Rendering steht (kein React-Render ohne Bezug zur aktuellen Ebene). */}
      <group name={`world-stage-${stage}`} />
    </Suspense>
  )
}
