import { Canvas } from '@react-three/fiber'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import { Suspense, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as THREE from 'three'
import type { Brand } from '../types/db'
import { useBrands } from '../hooks/useBrands'
import { BrandNode } from './BrandNode'
import { CameraRig } from './CameraRig'
import { Connections } from './Connections'

const NODE_POSITIONS: [number, number, number][] = [
  [-2.4, 0.6, 0],
  [0, -0.9, 0],
  [2.4, 0.6, 0],
]

const COLOR_FALLBACK = ['#4f7fff', '#8b5cf6', '#2dd4bf']

function resolveColor(brand: Brand, idx: number): string {
  if (!brand.color || brand.color.startsWith('var(')) {
    return COLOR_FALLBACK[idx % COLOR_FALLBACK.length]
  }
  return brand.color
}

export function NodeGraph() {
  const { brands, loading, error } = useBrands()
  const navigate = useNavigate()
  const [tunnelTarget, setTunnelTarget] = useState<THREE.Vector3 | null>(null)
  const [pendingSlug, setPendingSlug] = useState<string | null>(null)

  if (error) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <span
          className="font-mono text-xs"
          style={{ color: 'var(--accent-coral)' }}
        >
          3D-Graph konnte nicht geladen werden: {error}
        </span>
      </div>
    )
  }

  const handleSelect = (slug: string, target: THREE.Vector3) => {
    setPendingSlug(slug)
    setTunnelTarget(target)
  }

  const handleTunnelComplete = () => {
    if (pendingSlug) navigate(`/brand/${pendingSlug}`)
  }

  return (
    <div
      className="relative w-full"
      style={{ height: 'calc(100vh - 64px)' }}
    >
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
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
        </div>
      )}

      <Canvas
        gl={{ alpha: true, antialias: true }}
        camera={{ position: [0, 0, 11], fov: 35 }}
        style={{ background: 'transparent' }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.35} />
          <CameraRig
            tunnelTarget={tunnelTarget}
            onTunnelComplete={handleTunnelComplete}
          />
          <Connections positions={NODE_POSITIONS.slice(0, brands.length)} />
          {brands.map((brand, idx) => (
            <BrandNode
              key={brand.id}
              position={NODE_POSITIONS[idx % NODE_POSITIONS.length]}
              color={resolveColor(brand, idx)}
              label={brand.name}
              onSelect={(pos) => handleSelect(brand.slug, pos)}
            />
          ))}
          <EffectComposer>
            <Bloom
              intensity={0.65}
              luminanceThreshold={0.25}
              luminanceSmoothing={0.5}
              mipmapBlur
            />
          </EffectComposer>
        </Suspense>
      </Canvas>

      <div
        className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 font-mono"
        style={{
          fontSize: 10,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--text-tertiary)',
        }}
      >
        Klicke einen Node um in die Brand zu fliegen
      </div>
    </div>
  )
}
