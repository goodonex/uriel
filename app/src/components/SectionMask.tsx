import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { ReactNode } from 'react'

interface SectionMaskProps {
  slug: string
  modeLabel: string
  children: ReactNode
  mobile: boolean
}

export function SectionMask({ slug, modeLabel, children, mobile }: SectionMaskProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const hasMounted = useRef(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      navigate(`/brand/${slug}`)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate, slug])

  useEffect(() => {
    hasMounted.current = true
  }, [])

  return (
    <div
      style={{
        position: mobile ? 'relative' : 'fixed',
        inset: mobile ? undefined : 0,
        pointerEvents: mobile ? 'auto' : 'none',
        zIndex: mobile ? 'auto' : 12,
      }}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.section
          key={location.pathname}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{
            duration: 0.2,
            ease: [0.16, 1, 0.3, 1],
            delay: hasMounted.current ? 0.9 : 0,
          }}
          style={{
            pointerEvents: 'auto',
            width: mobile ? '100%' : 'min(78vw, 1120px)',
            height: mobile ? '100%' : 'calc(100vh - 48px)',
            marginLeft: mobile ? 0 : 'auto',
            marginRight: mobile ? 0 : 24,
            marginTop: mobile ? 0 : 24,
            borderRadius: mobile ? 0 : 18,
            border: '1px solid var(--glass-border-1)',
            background: 'rgba(8, 8, 16, 0.7)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: '0 24px 72px rgba(0,0,0,0.45)',
            overflow: 'hidden',
            display: 'grid',
            gridTemplateRows: 'auto 1fr',
          }}
        >
          <header
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '10px 14px',
              borderBottom: '1px solid var(--glass-border-1)',
            }}
          >
            <div
              className="font-mono"
              style={{
                fontSize: 10,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--text-secondary)',
              }}
            >
              {modeLabel}
            </div>
            <button
              type="button"
              onClick={() => navigate(`/brand/${slug}`)}
              className="font-mono"
              style={{
                borderRadius: 8,
                border: '1px solid var(--glass-border-2)',
                background: 'var(--glass-1)',
                color: 'var(--text-secondary)',
                padding: '6px 8px',
                fontSize: 10,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              Welt
            </button>
          </header>
          <div style={{ minHeight: 0, overflow: 'auto', padding: 14 }}>{children}</div>
        </motion.section>
      </AnimatePresence>
    </div>
  )
}
