import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'

export function UniversePage() {
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
    </div>
  )
}
