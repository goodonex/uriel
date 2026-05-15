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
  const pathSection = sectionFromPathname(pathname)
  const navigatingRef = useRef(false)
  const scrollCtx = useScrollSectionContext()

  const activeSection = scrollCtx?.activeSection ?? pathSection

  const settleSection = useCallback(
    (section: SectionKey) => {
      scrollCtx?.setActiveSection(section)
      if (section !== pathSection) {
        navigatingRef.current = true
        navigate(pathForSection(slug, section), { replace: true })
      }
    },
    [navigate, pathSection, scrollCtx, slug],
  )

  const onSectionChange = useCallback(
    (section: SectionKey) => {
      if (section === activeSection) return
      settleSection(section)
    },
    [activeSection, settleSection],
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
    onSectionSettled: settleSection,
  })

  useEffect(() => {
    if (!scrollCtx?.syncEnabled) return
    scrollCtx.registerScrollToSection((section) => {
      void scrollToSectionHeavy(section)
    })
    return () => scrollCtx.registerScrollToSection(null)
  }, [scrollCtx, scrollToSectionHeavy])

  useEffect(() => {
    scrollCtx?.setActiveSection(pathSection)
  }, [pathSection, scrollCtx])

  useEffect(() => {
    if (navigatingRef.current) {
      navigatingRef.current = false
      return
    }
    const root = containerRef.current
    if (!root) return
    const target = root.querySelector(`[data-scroll-section="${pathSection}"]`)
    if (!target || !(target instanceof HTMLElement)) return
    if (Math.abs(root.scrollTop - target.offsetTop) < 6) return

    lockObserver()
    void scrollToSectionHeavy(pathSection).finally(() => {
      window.setTimeout(unlockObserver, 80)
    })
  }, [pathSection, lockObserver, unlockObserver, scrollToSectionHeavy])

  const jumpToSection = useCallback(
    (section: SectionKey) => {
      if (section === activeSection) return
      navigatingRef.current = true
      settleSection(section)
      void scrollToSectionHeavy(section)
    },
    [activeSection, scrollToSectionHeavy, settleSection],
  )

  return (
    <ScrollFlowProvider slug={slug} containerRef={containerRef}>
      <div
        ref={containerRef}
        className="brand-scroll-flow brand-scroll-flow--heavy"
        style={{
          height: '100vh',
          overflowY: 'auto',
          overflowX: 'clip',
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
      <SectionDotNav onSelect={jumpToSection} />
    </ScrollFlowProvider>
  )
}
