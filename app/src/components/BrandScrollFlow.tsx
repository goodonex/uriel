import { animate, motion, useMotionValue } from 'framer-motion'
import { useCallback, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ScrollFlowProvider } from '../context/ScrollFlowContext'
import { useScrollSection } from '../hooks/useScrollSection'
import {
  SECTION_ORDER,
  pathForSection,
  sectionFromPathname,
  type SectionKey,
} from '../lib/scrollFlow'
import { DashboardSection } from './sections/DashboardSection'
import { DeliverSection } from './sections/DeliverSection'
import { FoundationSection } from './sections/FoundationSection'
import { IntelligenceSection } from './sections/IntelligenceSection'
import { PromoSection } from './sections/PromoSection'
import { SalesSection } from './sections/SalesSection'
import { SectionDotNav } from './SectionDotNav'

interface BrandScrollFlowProps {
  slug: string
}

function SectionView({ section, slug }: { section: SectionKey; slug: string }) {
  switch (section) {
    case 'dashboard':
      return <DashboardSection slug={slug} />
    case 'foundation':
      return <FoundationSection />
    case 'promo':
      return <PromoSection />
    case 'sales':
      return <SalesSection />
    case 'deliver':
      return <DeliverSection slug={slug} />
    case 'intelligence':
      return <IntelligenceSection />
    default:
      return null
  }
}

export function BrandScrollFlow({ slug }: BrandScrollFlowProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const activeSection = sectionFromPathname(pathname)
  const resistanceY = useMotionValue(0)
  const navigatingRef = useRef(false)
  const scrollSyncRef = useRef(false)

  const onSectionChange = useCallback(
    (section: SectionKey) => {
      if (section === activeSection) return
      navigatingRef.current = true
      navigate(pathForSection(slug, section))
    },
    [activeSection, navigate, slug],
  )

  const { suppressObserverRef } = useScrollSection({
    containerRef,
    enabled: true,
    activeSection,
    onSectionChange,
  })

  useEffect(() => {
    if (navigatingRef.current) {
      navigatingRef.current = false
      return
    }
    const root = containerRef.current
    if (!root) return
    const target = root.querySelector(`[data-scroll-section="${activeSection}"]`)
    if (!target) return
    scrollSyncRef.current = true
    suppressObserverRef.current = true
    target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    const t = window.setTimeout(() => {
      scrollSyncRef.current = false
      suppressObserverRef.current = false
    }, 700)
    return () => window.clearTimeout(t)
  }, [activeSection, pathname, suppressObserverRef])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    let resistanceTimer: ReturnType<typeof setTimeout> | null = null

    const onWheel = (e: WheelEvent) => {
      if (scrollSyncRef.current) return
      const { scrollTop, clientHeight } = el
      if (clientHeight <= 0) return
      const sectionProgress = (scrollTop % clientHeight) / clientHeight
      const nearEdge =
        (sectionProgress > 0.82 && e.deltaY > 0) || (sectionProgress < 0.18 && e.deltaY < 0)
      if (!nearEdge) return

      const push = Math.min(40, Math.abs(e.deltaY) * 0.12) * Math.sign(e.deltaY)
      void animate(resistanceY, push, { duration: 0.12, ease: 'easeOut' })
      if (resistanceTimer) clearTimeout(resistanceTimer)
      resistanceTimer = setTimeout(() => {
        void animate(resistanceY, 0, { duration: 0.28, ease: [0.16, 1, 0.3, 1] })
      }, 300)
    }

    el.addEventListener('wheel', onWheel, { passive: true })
    return () => {
      el.removeEventListener('wheel', onWheel)
      if (resistanceTimer) clearTimeout(resistanceTimer)
    }
  }, [resistanceY])

  const scrollToSection = useCallback((section: SectionKey) => {
    const root = containerRef.current
    if (!root) return
    const target = root.querySelector(`[data-scroll-section="${section}"]`)
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  return (
    <ScrollFlowProvider slug={slug} containerRef={containerRef}>
      <div
        ref={containerRef}
        className="brand-scroll-flow"
        style={{
          height: '100vh',
          overflowY: 'auto',
          overflowX: 'hidden',
          scrollSnapType: 'y mandatory',
          overscrollBehavior: 'contain',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <motion.div ref={innerRef} style={{ y: resistanceY }}>
          {SECTION_ORDER.map((section) => (
            <SectionView key={section} section={section} slug={slug} />
          ))}
        </motion.div>
      </div>
      <SectionDotNav
        active={activeSection}
        onSelect={(section) => {
          scrollToSection(section)
          onSectionChange(section)
        }}
      />
    </ScrollFlowProvider>
  )
}
