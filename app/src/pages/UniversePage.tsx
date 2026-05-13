import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useBrands } from '../hooks/useBrands'
import { useViewport } from '../hooks/useViewport'

export function UniversePage() {
  const { brands } = useBrands()
  const { isMobile } = useViewport()
  const worldDesktop = !isMobile

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '100vh',
        pointerEvents: 'none',
        background: 'transparent',
        overflow: 'hidden',
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        style={{
          position: 'absolute',
          top: 24,
          left: 32,
          right: 32,
          pointerEvents: 'auto',
          zIndex: 3,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Link
          to="/"
          className="font-display"
          style={{
            fontSize: 17,
            fontWeight: 600,
            letterSpacing: '-0.3px',
            color: 'var(--text-primary)',
            textDecoration: 'none',
          }}
        >
          Brand OS
        </Link>
        <span
          className="font-mono"
          style={{
            fontSize: 10,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--text-tertiary)',
          }}
        >
          Universe
        </span>
      </motion.div>

      {worldDesktop ? (
        <div
          className="pointer-events-none font-mono"
          style={{
            position: 'absolute',
            bottom: 96,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1,
            fontSize: 10,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--text-tertiary)',
            textAlign: 'center',
            maxWidth: 420,
          }}
        >
          Klicke ein Sonnensystem um in die Brand zu fliegen
        </div>
      ) : (
        <div
          style={{
            pointerEvents: 'auto',
            position: 'relative',
            zIndex: 2,
            padding: '86px 16px 24px',
            maxWidth: 560,
            margin: '0 auto',
          }}
        >
          <div
            className="font-mono"
            style={{
              fontSize: 10,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--text-tertiary)',
              marginBottom: 10,
            }}
          >
            Brands
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {brands.map((b) => (
              <Link
                key={b.id}
                to={`/brand/${b.slug}`}
                style={{
                  borderRadius: 12,
                  border: '1px solid var(--glass-border-1)',
                  background: 'var(--glass-1)',
                  backdropFilter: 'blur(14px)',
                  WebkitBackdropFilter: 'blur(14px)',
                  textDecoration: 'none',
                  color: 'var(--text-primary)',
                  padding: '10px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: b.color?.startsWith('#') ? b.color : 'var(--accent-teal)',
                  }}
                />
                <span className="font-body" style={{ fontSize: 14 }}>
                  {b.name}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
