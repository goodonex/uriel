import { motion } from 'framer-motion'
import { Outlet, useParams } from 'react-router-dom'
import { AppHeader } from '../components/AppHeader'
import { useBrands } from '../hooks/useBrands'

export function BrandPage() {
  const { slug } = useParams<{ slug: string }>()
  const { brands, loading } = useBrands()
  const current = brands.find((b) => b.slug === slug)

  return (
    <div style={{ pointerEvents: 'auto', background: 'transparent' }}>
      <AppHeader />
      <motion.div
        key={slug}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        style={{ background: 'transparent' }}
      >
        <div className="mb-4 flex items-baseline justify-between">
          <h1
            className="font-display"
            style={{
              fontSize: 26,
              fontWeight: 600,
              color: 'var(--text-primary)',
              letterSpacing: '-0.4px',
            }}
          >
            {loading ? 'Lade…' : (current?.name ?? slug)}
          </h1>
          <span
            className="font-mono"
            style={{
              fontSize: 10,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--text-tertiary)',
            }}
          >
            Modi
          </span>
        </div>
        <Outlet />
      </motion.div>
    </div>
  )
}
