import { Html } from '@react-three/drei'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import { useMemo } from 'react'
import type { Brand } from '../types/db'
import { useBrands } from '../hooks/useBrands'
import { BrandSolarSystem } from './BrandSolarSystem'
import { BRAND_SYSTEM_POSITIONS } from './worldLayout'

const DISPLAY_ORDER = [
  'herrmann',
  'wertavio',
  'culturefit',
  'eversmell',
  'homeflower',
] as const

function sortBrandsForUniverse(brands: Brand[]): Brand[] {
  const rank = (slug: string) => {
    const i = (DISPLAY_ORDER as readonly string[]).indexOf(slug)
    return i === -1 ? 999 : i
  }
  return [...brands].sort(
    (a, b) => rank(a.slug) - rank(b.slug) || a.name.localeCompare(b.name),
  )
}

export function Universe() {
  const { brands, loading, error } = useBrands()

  const ordered = useMemo(() => sortBrandsForUniverse(brands), [brands])

  if (error) {
    return (
      <>
        <ambientLight intensity={0.35} />
        <Html center>
          <span className="font-mono text-xs" style={{ color: 'var(--accent-coral)' }}>
            Universe konnte nicht geladen werden: {error}
          </span>
        </Html>
      </>
    )
  }

  return (
    <>
      {ordered.map((b) => {
        const pos = BRAND_SYSTEM_POSITIONS[b.slug] ?? [0, 0, 0]
        return <BrandSolarSystem key={b.id} brand={b} position={pos} />
      })}

      <EffectComposer>
        <Bloom
          intensity={0.55}
          luminanceThreshold={0.25}
          luminanceSmoothing={0.5}
          mipmapBlur
        />
      </EffectComposer>

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
