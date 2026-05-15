import { Html } from '@react-three/drei'
import { motion } from 'framer-motion'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { latLonToVector3, type RegionDef } from './regionGeometry'

interface RegionLabelProps {
  def: RegionDef
  slug: string
  planetRadius: number
  hovered?: boolean
}

export function RegionLabel({ def, slug, planetRadius, hovered = false }: RegionLabelProps) {
  const navigate = useNavigate()
  const anchor = useMemo(
    () => latLonToVector3(def.lat, def.lon, planetRadius + 0.2),
    [def.lat, def.lon, planetRadius],
  )

  const navigateToRegion = () => {
    const pathMode = def.key === 'building' ? 'foundation' : def.key
    navigate(`/brand/${slug}/${pathMode}`)
  }

  return (
    <Html
      position={[anchor.x, anchor.y, anchor.z]}
      distanceFactor={hovered ? 6.5 : 8}
      transform
      occlude={false}
      style={{ pointerEvents: 'none' }}
    >
      <motion.button
        type="button"
        onClick={navigateToRegion}
        animate={{
          opacity: hovered ? 1 : 0.82,
          scale: hovered ? 1.06 : 1,
        }}
        transition={{ type: 'spring', stiffness: 380, damping: 26 }}
        style={{
          border: 'none',
          background: hovered ? 'rgba(8, 8, 16, 0.82)' : 'rgba(8, 8, 16, 0.55)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          borderRadius: 10,
          padding: hovered ? '8px 14px' : '6px 12px',
          color: 'var(--text-primary)',
          cursor: 'pointer',
          textAlign: 'left',
          textShadow: hovered
            ? '0 0 18px rgba(235,235,245,0.45)'
            : '0 0 10px rgba(235,235,245,0.22)',
          pointerEvents: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              width: hovered ? 40 : 28,
              height: 1.5,
              background: '#aab0bf',
              opacity: hovered ? 0.7 : 0.4,
              display: 'inline-block',
              transition: 'width 0.25s ease',
            }}
          />
          <motion.span
            className="font-mono"
            layout
            style={{
              fontSize: hovered ? 17 : 14,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
              fontWeight: hovered ? 600 : 500,
            }}
          >
            {def.label}
          </motion.span>
        </div>
      </motion.button>
    </Html>
  )
}
