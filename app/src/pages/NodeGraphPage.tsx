import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'

export function NodeGraphPage() {
  return (
    <div
      style={{
        pointerEvents: 'none',
        background: 'transparent',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100%',
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="flex items-center justify-between"
        style={{
          pointerEvents: 'auto',
          paddingBottom: 12,
          flexShrink: 0,
          background: 'transparent',
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

      <div style={{ flex: 1, minHeight: '40vh' }} aria-hidden />

      <div
        className="pointer-events-none flex shrink-0 justify-center pb-2 font-mono"
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
