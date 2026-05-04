import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { BrandSwitcher } from './BrandSwitcher'

export function AppHeader() {
  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="glass-2 mb-8 flex min-w-0 items-center gap-3"
      style={{
        padding: '14px 20px',
        borderRadius: 16,
      }}
    >
      <Link
        to="/"
        className="font-display shrink-0"
        style={{
          fontSize: 17,
          fontWeight: 600,
          letterSpacing: '-0.3px',
          color: 'var(--text-primary)',
        }}
      >
        Brand OS
      </Link>

      <div
        className="min-h-0 min-w-0 flex-1 overflow-x-auto overscroll-x-contain"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <BrandSwitcher />
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <div
          className="flex items-center justify-center"
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: 'var(--glass-3)',
            border: '1px solid var(--glass-border-2)',
            fontSize: 11,
            fontWeight: 500,
            color: 'var(--text-primary)',
          }}
        >
          K
        </div>
      </div>
    </motion.header>
  )
}
