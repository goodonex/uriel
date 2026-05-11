import { motion } from 'framer-motion'
import { useMemo, type CSSProperties } from 'react'
import { Outlet, useLocation, useParams } from 'react-router-dom'
import { BrandWorkspaceSidebar } from '../components/BrandWorkspaceSidebar'
import { useBrands } from '../hooks/useBrands'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

const MODE_LABEL: Record<string, string> = {
  dashboard: 'Dashboard',
  building: 'Building',
  discovery: 'Discovery',
  promo: 'Promo',
  sales: 'Sales',
  intelligence: 'Intelligence',
  deliver: 'Deliver',
}

function modeFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/brand\/[^/]+\/([^/]+)/)
  if (!match) return null
  return MODE_LABEL[match[1] ?? ''] ?? null
}

export function BrandPage() {
  const { slug = '' } = useParams<{ slug: string }>()
  const { pathname } = useLocation()
  const { brands } = useBrands()

  const brand = useMemo(() => brands.find((b) => b.slug === slug), [brands, slug])
  const modeLabel = modeFromPath(pathname)

  useDocumentTitle([brand?.name ?? slug, modeLabel])

  const brandAccent = brand?.color || 'var(--accent-teal)'

  return (
    <div
      className="flex min-h-0 w-full"
      style={
        {
          pointerEvents: 'auto',
          background: 'transparent',
          minHeight: '100vh',
          '--brand-accent': brandAccent,
        } as CSSProperties
      }
    >
      <BrandWorkspaceSidebar slug={slug} />
      <motion.div
        key={slug}
        className="min-w-0 flex-1"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        style={{
          background: 'transparent',
          padding: '20px 24px 48px',
          minHeight: '100vh',
        }}
      >
        <Outlet />
      </motion.div>
    </div>
  )
}
