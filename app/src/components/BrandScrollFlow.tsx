import { useCallback, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ScrollFlowProvider } from '../context/ScrollFlowContext'
import { useScrollSectionContext } from '../context/ScrollSectionContext'
import { useHeavySectionScroll } from '../hooks/useHeavySectionScroll'
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
  const navigatingRef = useRef(false)
  const scrollCtx = useScrollSectionContext()

  const onSectionChange = useCallback(
    (section: SectionKey) => {
      if (section === activeSection) return
      scrollCtx?.setActiveSection(section)
      navigatingRef.current = true
      navigate(pathForSection(slug, section))
    },
    [activeSection, navigate, scrollCtx, slug],
  )

  const { suppressObserverRef } = useScrollSection({
    containerRef,
    enabled: true,
    activeSection,
    onSectionChange,
  })

  const lockObserver = useCallback(() => {
    suppressObserverRef.current = true
  }, [suppressObserverRef])

  const unlockObserver = useCallback(() => {
    suppressObserverRef.current = false
  }, [suppressObserverRef])

  const { scrollToSectionHeavy } = useHeavySectionScroll({
    containerRef,
    innerRef,
    enabled: true,
    onSnapStart: lockObserver,
    onSnapEnd: unlockObserver,
  })

  useEffect(() => {
    if (!scrollCtx?.syncEnabled) return
    scrollCtx.registerScrollToSection((section) => {
      void scrollToSectionHeavy(section)
    })
    return () => scrollCtx.registerScrollToSection(null)
  }, [scrollCtx, scrollToSectionHeavy])

  useEffect(() => {
    if (navigatingRef.current) {
      navigatingRef.current = false
      return
    }
    const root = containerRef.current
    if (!root) return
    const target = root.querySelector(`[data-scroll-section="${activeSection}"]`)
    if (!target || !(target instanceof HTMLElement)) return
    if (Math.abs(root.scrollTop - target.offsetTop) < 6) return

    lockObserver()
    void scrollToSectionHeavy(activeSection).finally(() => {
      window.setTimeout(unlockObserver, 80)
    })
  }, [activeSection, pathname, lockObserver, unlockObserver, scrollToSectionHeavy])

  return (
    <ScrollFlowProvider slug={slug} containerRef={containerRef}>
      <div
        ref={containerRef}
        className="brand-scroll-flow brand-scroll-flow--heavy"
        style={{
          height: '100vh',
          overflowY: 'auto',
          overflowX: 'hidden',
          overscrollBehavior: 'y contain',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div ref={innerRef} className="brand-scroll-flow-inner">
          {SECTION_ORDER.map((section) => (
            <SectionView key={section} section={section} slug={slug} />
          ))}
        </div>
      </div>
      <SectionDotNav
        active={activeSection}
        onSelect={(section) => {
          if (section === activeSection) return
          navigatingRef.current = true
          onSectionChange(section)
          void scrollToSectionHeavy(section)
        }}
      />
    </ScrollFlowProvider>
  )
}
