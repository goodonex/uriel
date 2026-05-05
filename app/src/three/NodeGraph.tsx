import { Html } from '@react-three/drei'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import { useThree } from '@react-three/fiber'
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import * as THREE from 'three'
import type { Brand } from '../types/db'
import { useBrands } from '../hooks/useBrands'
import { BrandNode } from './BrandNode'
import { CameraRig } from './CameraRig'
import { Connections } from './Connections'

/** Nicht-/: Nodes unten rechts, visuell max. ~20 % Viewport-Breite (Skalierung an Canvas-Breite gekoppelt). */
const CORNER_NODES_OFFSET: [number, number, number] = [5.15, -3.45, 0]
const CORNER_SCALE_CAP = 0.2
const CORNER_SCALE_MIN = 0.11
const NODE_POSITIONS: [number, number, number][] = [
  [-2.45, 0.55, 0],
  [-1.2, -0.82, 0],
  [0.05, 0.92, 0],
  [1.2, -0.72, 0],
  [2.35, 0.48, 0],
]

const COLOR_FALLBACK = ['#4f7fff', '#8b5cf6', '#2dd4bf', '#c8a97a', '#e0593e']

function resolveColor(brand: Brand, idx: number): string {
  if (brand.color === 'var(--accent-ember)') {
    return '#e0593e'
  }
  if (!brand.color || brand.color.startsWith('var(')) {
    return COLOR_FALLBACK[idx % COLOR_FALLBACK.length]
  }
  return brand.color
}

function applyMeshOpacity(root: THREE.Object3D | null, ambient: boolean) {
  if (!root) return
  root.traverse((o) => {
    if (o instanceof THREE.Mesh && o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material]
      for (const mat of mats) {
        if (
          mat instanceof THREE.MeshStandardMaterial ||
          mat instanceof THREE.MeshPhysicalMaterial
        ) {
          mat.transparent = ambient
          mat.opacity = ambient ? 0.3 : 1
          mat.needsUpdate = true
        }
      }
    }
  })
}

export function NodeGraph() {
  const { brands, loading, error } = useBrands()
  const navigate = useNavigate()
  const location = useLocation()
  const cornerMode = location.pathname !== '/'
  const { size } = useThree()

  const cornerClusterScale = useMemo(() => {
    if (!cornerMode) return 1
    const w = size.width
    return Math.min(
      CORNER_SCALE_CAP,
      Math.max(CORNER_SCALE_MIN, w * 0.000165),
    )
  }, [cornerMode, size.width])

  const [tunnelTarget, setTunnelTarget] = useState<THREE.Vector3 | null>(null)
  const [pendingSlug, setPendingSlug] = useState<string | null>(null)

  const nodesGroupRef = useRef<THREE.Group>(null)

  /* Tunnel-Zustand zurücksetzen nach Navigation — sonst bleibt FOV/Position im „Flug“ und ein Node wirkt riesig. */
  useEffect(() => {
    if (location.pathname === '/') {
      setTunnelTarget(null)
      setPendingSlug(null)
    }
  }, [location.pathname])

  useLayoutEffect(() => {
    applyMeshOpacity(nodesGroupRef.current, cornerMode)
  }, [cornerMode, brands])

  if (error) {
    return (
      <>
        <ambientLight intensity={0.35} />
        <Html center>
          <span
            className="font-mono text-xs"
            style={{ color: 'var(--accent-coral)' }}
          >
            3D-Graph konnte nicht geladen werden: {error}
          </span>
        </Html>
      </>
    )
  }

  const handleSelect = (slug: string, target: THREE.Vector3) => {
    setPendingSlug(slug)
    setTunnelTarget(target)
  }

  const handleTunnelComplete = () => {
    const slug = pendingSlug
    setTunnelTarget(null)
    setPendingSlug(null)
    if (slug) navigate(`/brand/${slug}`)
  }

  return (
    <>
      <ambientLight intensity={0.35} />
      <Suspense fallback={null}>
        <CameraRig
          tunnelTarget={tunnelTarget}
          onTunnelComplete={handleTunnelComplete}
          brandAmbient={cornerMode}
        />
        {/* Nur auf Universe: Linien wirken über Glas-Panels wie ein „V zur Mitte“. */}
        {location.pathname === '/' ? (
          <Connections positions={NODE_POSITIONS.slice(0, brands.length)} />
        ) : null}
        <group
          ref={nodesGroupRef}
          position={cornerMode ? CORNER_NODES_OFFSET : [0, 0, 0]}
          scale={cornerMode ? cornerClusterScale : 1}
        >
          {brands.map((brand, idx) => (
            <BrandNode
              key={brand.id}
              position={NODE_POSITIONS[idx % NODE_POSITIONS.length]}
              color={resolveColor(brand, idx)}
              label={brand.name}
              onSelect={(pos) => handleSelect(brand.slug, pos)}
            />
          ))}
        </group>
        <EffectComposer>
          <Bloom
            intensity={0.65}
            luminanceThreshold={0.25}
            luminanceSmoothing={0.5}
            mipmapBlur
          />
        </EffectComposer>
      </Suspense>

      {loading ? (
        <Html center>
          <span
            className="font-mono"
            style={{
              fontSize: 11,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--text-tertiary)',
            }}
          >
            Lade Brands…
          </span>
        </Html>
      ) : null}
    </>
  )
}
