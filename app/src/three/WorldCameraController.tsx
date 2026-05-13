/**
 * WorldCameraController — bewegt die `PerspectiveCamera` deterministisch
 * zwischen den vier Welt-Stages und panned innerhalb der Planet-Surface
 * zur jeweils aktiven Region.
 *
 * Liest ausschließlich aus `useWorldCamera`. Schreibt nichts zurück in
 * den Store; die Quelle bleibt die URL.
 *
 * Tween-Mechanik:
 *   - Bei Stage-Wechsel: ~1.2 s (Ease-Out durch Lerp-Decay).
 *   - Bei Region-Pan innerhalb planet-surface: ~0.8 s.
 *   - Schwung zum Mond (brand-system ↔ moon-surface): ~1.5 s.
 *
 * OrbitControls (drei) sind nur auf `universe` und `brand-system` aktiv,
 * und auch dort nur, wenn gerade kein Tween läuft. Auf `planet-surface`
 * und `moon-surface` steuert ausschließlich der Store.
 */
import { OrbitControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type ElementRef } from 'react'
import * as THREE from 'three'
import {
  useWorldCamera,
  type WorldRegion,
  type WorldStage,
} from '../store/worldCamera'
import { BRAND_MOON_SURFACE_OFFSET, getBrandSystemPosition } from './worldLayout'

interface StageCamera {
  /** Offset relativ zum `look`-Punkt der Stage. */
  offset: THREE.Vector3
  fov: number
}

/**
 * Stage-Offsets relativ zum aktuellen "look"-Anker:
 *   universe       → Anker `[0,0,0]`, weit weg im All
 *   brand-system   → Anker am Brand-System, etwas vor/oben
 *   planet-surface → Anker am Brand-System, schräg oben (~60°)
 *   moon-surface   → Anker am Brand-System + Mond-Versatz
 *
 * Die tatsächliche Anker-Position kommt in `resolveTarget` aus
 * `brandSlug` (Phase 3) und der Region-Offset (Phase 2).
 */
const STAGE_CAMERA: Record<WorldStage, StageCamera> = {
  universe: {
    offset: new THREE.Vector3(0, 30, 80),
    fov: 35,
  },
  'brand-system': {
    offset: new THREE.Vector3(0, 1.5, 6.5),
    fov: 35,
  },
  'planet-surface': {
    // ~60° Neigung über dem Pol, Distanz so dass alle Regionen ins Bild passen.
    offset: new THREE.Vector3(0, 18, 18),
    fov: 45,
  },
  'moon-surface': {
    offset: new THREE.Vector3(0, 6, 10),
    fov: 45,
  },
}

/**
 * Lateraler Pan-Offset pro Region auf der Planet-Oberfläche.
 * Wird in Phase 5 final auf die tatsächlichen Region-Positionen abgestimmt;
 * die Werte hier sind so gewählt, dass jede Region in eine andere Bild-
 * Quadrant rückt ohne Reinzoomen.
 */
const REGION_PAN: Record<WorldRegion, THREE.Vector3> = {
  building: new THREE.Vector3(-3.5, 0, 1.5),
  discovery: new THREE.Vector3(3.5, 0.5, -1),
  promo: new THREE.Vector3(0, -0.5, 3.5),
  sales: new THREE.Vector3(-2.5, -1, -2.5),
  intelligence: new THREE.Vector3(3.5, 1.5, 1.5),
}

/**
 * Lerp-Damping pro Frame, so kalibriert dass die Bewegung sich ungefähr wie
 * eine Ease-Out über die jeweils angepeilte Dauer anfühlt (60 fps).
 *
 *   alpha = 1 - 0.001^(1/frames)
 *
 * Stage-Wechsel ~1.2 s ≈ 72 Frames → ~0.094
 * Region-Pan   ~0.8 s ≈ 48 Frames → ~0.139
 * Moon-Swing  ~1.5 s ≈ 90 Frames → ~0.076
 */
const DAMPING_STAGE = 0.094
const DAMPING_REGION = 0.139
const DAMPING_MOON = 0.076

const TWEEN_EPSILON_POS = 0.05
const TWEEN_EPSILON_FOV = 0.15

interface ResolvedTarget {
  pos: THREE.Vector3
  look: THREE.Vector3
  fov: number
}

function resolveTarget(
  stage: WorldStage,
  brandSlug: string | null,
  region: WorldRegion | null,
): ResolvedTarget {
  const base = STAGE_CAMERA[stage]

  // Universe: Anker im Ursprung, weit weg.
  if (stage === 'universe') {
    return {
      pos: base.offset.clone(),
      look: new THREE.Vector3(0, 0, 0),
      fov: base.fov,
    }
  }

  // Alle anderen Stages: Anker am Brand-System.
  const anchor = getBrandSystemPosition(brandSlug)

  if (stage === 'moon-surface') {
    const moonAnchor = anchor
      .clone()
      .add(
        new THREE.Vector3(
          BRAND_MOON_SURFACE_OFFSET[0],
          BRAND_MOON_SURFACE_OFFSET[1],
          BRAND_MOON_SURFACE_OFFSET[2],
        ),
      )
    return {
      pos: moonAnchor.clone().add(base.offset),
      look: moonAnchor,
      fov: base.fov,
    }
  }

  if (stage === 'planet-surface' && region) {
    const regionOffset = REGION_PAN[region]
    return {
      pos: anchor.clone().add(base.offset).add(regionOffset),
      look: anchor.clone().add(regionOffset),
      fov: base.fov,
    }
  }

  return {
    pos: anchor.clone().add(base.offset),
    look: anchor.clone(),
    fov: base.fov,
  }
}

function chooseDamping(
  prevStage: WorldStage,
  nextStage: WorldStage,
  prevRegion: WorldRegion | null,
  nextRegion: WorldRegion | null,
): number {
  if (prevStage === 'moon-surface' || nextStage === 'moon-surface') {
    return DAMPING_MOON
  }
  if (
    prevStage === 'planet-surface' &&
    nextStage === 'planet-surface' &&
    prevRegion !== nextRegion
  ) {
    return DAMPING_REGION
  }
  return DAMPING_STAGE
}

export function WorldCameraController() {
  const { camera } = useThree()
  const stage = useWorldCamera((s) => s.stage)
  const region = useWorldCamera((s) => s.region)
  const brandSlug = useWorldCamera((s) => s.brandSlug)

  const targetPos = useRef(new THREE.Vector3())
  const targetLook = useRef(new THREE.Vector3())
  const currentLook = useRef(new THREE.Vector3())
  const targetFov = useRef(STAGE_CAMERA.universe.fov)
  const tweening = useRef(true) // Beim Mount ein Initial-Tween auf Universe.
  const damping = useRef(DAMPING_STAGE)
  const orbitRef = useRef<ElementRef<typeof OrbitControls> | null>(null)
  const prev = useRef<{ stage: WorldStage; region: WorldRegion | null }>({
    stage,
    region,
  })

  // Initial-Snap auf den Universe-Default damit die Kamera nicht aus dem
  // bisherigen Default des `<Canvas camera>`-Props in die Welt fallen muss.
  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return
    const t = resolveTarget(stage, brandSlug, region)
    targetPos.current.copy(t.pos)
    targetLook.current.copy(t.look)
    currentLook.current.copy(t.look)
    targetFov.current = t.fov
    camera.position.copy(t.pos)
    camera.fov = t.fov
    camera.updateProjectionMatrix()
    camera.lookAt(t.look)
    tweening.current = false
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Stage- / Region- / Brand-Wechsel → neues Ziel + Tween-Flag.
  useEffect(() => {
    const t = resolveTarget(stage, brandSlug, region)
    targetPos.current.copy(t.pos)
    targetLook.current.copy(t.look)
    targetFov.current = t.fov
    damping.current = chooseDamping(
      prev.current.stage,
      stage,
      prev.current.region,
      region,
    )
    tweening.current = true
    prev.current = { stage, region }
    if (orbitRef.current) {
      orbitRef.current.target.copy(t.look)
      orbitRef.current.update()
    }
  }, [stage, region, brandSlug])

  useFrame(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return
    if (!tweening.current) return

    const d = damping.current
    camera.position.lerp(targetPos.current, d)
    currentLook.current.lerp(targetLook.current, d)
    camera.lookAt(currentLook.current)

    const fovDelta = targetFov.current - camera.fov
    if (Math.abs(fovDelta) > TWEEN_EPSILON_FOV) {
      camera.fov += fovDelta * d
      camera.updateProjectionMatrix()
    }

    const posDist = camera.position.distanceTo(targetPos.current)
    const lookDist = currentLook.current.distanceTo(targetLook.current)
    if (
      posDist < TWEEN_EPSILON_POS &&
      lookDist < TWEEN_EPSILON_POS &&
      Math.abs(fovDelta) < TWEEN_EPSILON_FOV
    ) {
      camera.position.copy(targetPos.current)
      currentLook.current.copy(targetLook.current)
      camera.lookAt(currentLook.current)
      camera.fov = targetFov.current
      camera.updateProjectionMatrix()
      tweening.current = false
      if (orbitRef.current) {
        orbitRef.current.target.copy(targetLook.current)
        orbitRef.current.update()
      }
    }
  })

  const orbitEnabled = useMemo(
    () => stage === 'universe' || stage === 'brand-system',
    [stage],
  )

  const orbitTarget = useMemo<[number, number, number]>(() => {
    const t = resolveTarget(stage, brandSlug, region)
    return [t.look.x, t.look.y, t.look.z]
  }, [stage, brandSlug, region])

  return (
    <OrbitControls
      ref={orbitRef}
      enabled={orbitEnabled}
      enablePan={false}
      enableZoom={stage === 'universe'}
      makeDefault={false}
      target={orbitTarget}
      minDistance={4}
      maxDistance={140}
      rotateSpeed={0.45}
      dampingFactor={0.08}
    />
  )
}
