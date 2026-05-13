import { Html } from '@react-three/drei'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { latLonToVector3, type RegionDef } from './regionGeometry'

interface RegionLabelProps {
  def: RegionDef
  slug: string
  planetRadius: number
}

export function RegionLabel({ def, slug, planetRadius }: RegionLabelProps) {
  const navigate = useNavigate()
  const anchor = useMemo(
    () => latLonToVector3(def.lat, def.lon, planetRadius + 0.08),
    [def.lat, def.lon, planetRadius],
  )

  return (
    <Html
      position={[anchor.x, anchor.y, anchor.z]}
      distanceFactor={9}
      transform={false}
      occlude={false}
      style={{ pointerEvents: 'auto' }}
    >
      <button
        type="button"
        onClick={() => navigate(`/brand/${slug}/${def.key}`)}
        style={{
          border: 'none',
          background: 'transparent',
          color: 'var(--text-primary)',
          opacity: 0.72,
          cursor: 'pointer',
          padding: 0,
          textAlign: 'left',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span
            style={{
              width: 28,
              height: 1,
              background: 'color-mix(in srgb, var(--text-primary) 40%, transparent)',
              display: 'inline-block',
            }}
          />
          <span
            className="font-mono"
            style={{
              fontSize: 10,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
            }}
          >
            {def.label}
          </span>
        </div>
      </button>
    </Html>
  )
}
