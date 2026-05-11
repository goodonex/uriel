import { motion } from 'framer-motion'
import { Outlet, useParams } from 'react-router-dom'
import { BrandWorkspaceSidebar } from '../components/BrandWorkspaceSidebar'

export function BrandPage() {
  const { slug = '' } = useParams<{ slug: string }>()

  return (
    <div
      className="flex min-h-0 w-full"
      style={{
        pointerEvents: 'auto',
        background: 'transparent',
        minHeight: '100vh',
      }}
    >
      <BrandWorkspaceSidebar slug={slug} />
      <motion.div
        key={slug}
        className="min-h-0 min-w-0 flex-1"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        style={{
          background: 'transparent',
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '20px 24px 48px',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <Outlet />
      </motion.div>
    </div>
  )
}
