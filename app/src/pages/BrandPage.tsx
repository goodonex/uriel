import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { BrandSystemDashboard } from '../components/BrandSystemDashboard'
import { BrandScrollFlow } from '../components/BrandScrollFlow'
import { ModuleRenderer } from '../components/ModuleRenderer'
import { BrandWorkspaceSidebar, BRAND_FLOAT_SIDEBAR_CLEARANCE_X } from '../components/BrandWorkspaceSidebar'
import { useBrands } from '../hooks/useBrands'
import { useRouteModulesSync } from '../hooks/useRouteModulesSync'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useViewport } from '../hooks/useViewport'

const MODE_LABEL: Record<string, string> = {
  dashboard: 'Dashboard',
  foundation: 'Foundation',
  building: 'Foundation',
  discovery: 'Foundation',
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

function isBrandSystemRoute(pathname: string): boolean {
  return /^\/brand\/[^/]+(?:\/dashboard)?\/?$/.test(pathname)
}

export function BrandPage() {
  const { slug = '' } = useParams<{ slug: string }>()
  const { pathname } = useLocation()
  const { brands } = useBrands()
  const { isMobile, width } = useViewport()
  const useScrollFlow = width >= 1024
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const brand = useMemo(() => brands.find((b) => b.slug === slug), [brands, slug])
  const modeLabel = modeFromPath(pathname)
  const showBrandSystem = isBrandSystemRoute(pathname)

  useRouteModulesSync({
    slug,
    pathname,
    enabled: true,
    modeLabel: modeLabel ?? 'Bereich',
    mobile: isMobile,
    scrollFlowDesktop: useScrollFlow,
    brandSystemMobile: showBrandSystem && isMobile,
  })

  useDocumentTitle([brand?.name ?? slug, modeLabel])

  // Route-Wechsel schließt das Drawer automatisch
  useEffect(() => {
    setMobileNavOpen(false)
  }, [pathname])

  // Body-Scroll sperren, wenn Drawer offen
  useEffect(() => {
    if (mobileNavOpen) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = prev
      }
    }
  }, [mobileNavOpen])

  const brandAccent = brand?.color || 'var(--accent-teal)'

  return (
    <div
      className="relative min-h-0 w-full"
      style={
        {
          pointerEvents: 'auto',
          background: 'transparent',
          minHeight: '100vh',
          '--brand-accent': brandAccent,
        } as CSSProperties
      }
    >
      {/* Desktop: schwebendes Sidebar-Glas-Modul (kein Layout-Spalten-Block) */}
      {!isMobile ? <BrandWorkspaceSidebar slug={slug} layout="float" /> : null}

      {/* Mobile Drawer */}
      <AnimatePresence>
        {isMobile && mobileNavOpen ? (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setMobileNavOpen(false)}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.55)',
                backdropFilter: 'blur(4px)',
                WebkitBackdropFilter: 'blur(4px)',
                zIndex: 60,
              }}
            />
            <motion.div
              key="drawer"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                height: '100vh',
                zIndex: 70,
              }}
            >
              <BrandWorkspaceSidebar slug={slug} layout="drawer" />
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>

      <motion.div
        key={slug}
        className="min-w-0 w-full"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        style={{
          background: 'transparent',
          padding: 0,
          paddingLeft: !isMobile ? BRAND_FLOAT_SIDEBAR_CLEARANCE_X : undefined,
          minHeight: '100vh',
        }}
      >
        {isMobile ? (
          <header
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 40,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 14px',
              background: 'color-mix(in srgb, var(--bg-base) 88%, transparent)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              borderBottom: '1px solid var(--glass-border-1)',
            }}
          >
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Menü öffnen"
              style={{
                width: 38,
                height: 38,
                display: 'grid',
                placeItems: 'center',
                background: 'var(--glass-1)',
                border: '1px solid var(--glass-border-2)',
                borderRadius: 10,
                color: 'var(--text-primary)',
                cursor: 'pointer',
              }}
            >
              <svg width={18} height={14} viewBox="0 0 18 14" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path d="M1 1 H17 M1 7 H17 M1 13 H17" />
              </svg>
            </button>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                className="font-mono"
                style={{
                  fontSize: 9,
                  letterSpacing: '0.16em',
                  color: 'var(--text-tertiary)',
                  textTransform: 'uppercase',
                }}
              >
                {modeLabel ?? 'Brand OS'}
              </div>
              <div
                className="font-display"
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  letterSpacing: '-0.2px',
                  color: 'var(--text-primary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  borderLeft: `2px solid ${brandAccent}`,
                  paddingLeft: 8,
                  lineHeight: 1.15,
                }}
              >
                {brand?.name ?? slug}
              </div>
            </div>
          </header>
        ) : null}
        <div style={{ padding: isMobile ? '12px 14px 80px' : 0 }}>
          {isMobile && showBrandSystem ? (
            <motion.div
              key="brand-system"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
            >
              <BrandSystemDashboard slug={slug} />
            </motion.div>
          ) : useScrollFlow ? (
            <BrandScrollFlow slug={slug} />
          ) : (
            <ModuleRenderer slug={slug} mobile={isMobile} />
          )}
        </div>
      </motion.div>

      {/* Floating Action Button: Call Mode (nur Mobile, nicht auf Call-Mode-Page selbst) */}
      {isMobile && !pathname.endsWith('/call-mode') ? (
        <Link
          to={`/brand/${slug}/sales/call-mode`}
          aria-label="Call Mode öffnen"
          style={{
            position: 'fixed',
            right: 16,
            bottom: 16,
            zIndex: 50,
            width: 60,
            height: 60,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            background: 'linear-gradient(135deg, var(--mode-sales), color-mix(in srgb, var(--mode-sales) 60%, var(--accent-teal)))',
            color: '#0e0e10',
            fontSize: 24,
            textDecoration: 'none',
            boxShadow: '0 12px 32px color-mix(in srgb, var(--mode-sales) 45%, transparent), 0 0 0 1px rgba(0,0,0,0.18)',
            fontWeight: 700,
          }}
        >
          ☎
        </Link>
      ) : null}
    </div>
  )
}
