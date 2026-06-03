import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ScrollFlowProvider } from '../context/ScrollFlowContext'
import { useScrollSectionContext } from '../context/ScrollSectionContext'
import {
  isSectionAligned,
  useSectionScrollSnap,
} from '../hooks/useSectionScrollSnap'
import {
  isSectionScrollLocked,
  pathForSection,
  sectionFromPathname,
  SECTION_ORDER,
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
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const pathSection = sectionFromPathname(pathname)
  const scrollLocked = isSectionScrollLocked(pathname)
  const scrollCtx = useScrollSectionContext()
  const snapEnabled = scrollCtx?.effectiveSectionScroll ?? false
  const initialSyncDoneRef = useRef(false)

  const navigateSection = useCallback(
    (section: SectionKey) => {
      navigate(pathForSection(slug, section), { replace: true })
    },
    [navigate, slug],
  )

  const { scrollToSection, navFromScrollRef } = useSectionScrollSnap({
    containerRef,
    pathSection,
    scrollLocked,
    snapEnabled,
    onActiveSection: (section) => scrollCtx?.setActiveSection(section),
    onNavigateSection: navigateSection,
  })

  useEffect(() => {
    if (!scrollCtx?.syncEnabled) return
    scrollCtx.registerScrollToSection((section) => {
      scrollToSection(section, 'smooth')
    })
    return () => scrollCtx.registerScrollToSection(null)
  }, [scrollCtx, scrollToSection])

  useLayoutEffect(() => {
    if (!scrollLocked) return
    const root = containerRef.current
    if (!root) return
    scrollToSection(pathSection, 'auto')
  }, [scrollLocked, pathSection, scrollToSection])

  useLayoutEffect(() => {
    if (navFromScrollRef.current) {
      navFromScrollRef.current = false
      return
    }

    const root = containerRef.current
    if (!root) return

    if (isSectionAligned(root, pathSection)) {
      initialSyncDoneRef.current = true
      return
    }

    const behavior: ScrollBehavior = initialSyncDoneRef.current ? 'smooth' : 'auto'
    scrollToSection(pathSection, behavior)
    initialSyncDoneRef.current = true
  }, [pathSection, scrollToSection])

  const jumpToSection = useCallback(
    (section: SectionKey) => {
      scrollToSection(section, 'smooth')
    },
    [scrollToSection],
  )

  return (
    <ScrollFlowProvider slug={slug} containerRef={containerRef}>
      <div
        ref={containerRef}
        className={`brand-scroll-flow${snapEnabled && !scrollLocked ? ' brand-scroll-flow--snap' : ''}${!snapEnabled || scrollLocked ? ' brand-scroll-flow--locked' : ''}`}
        style={{
          height: '100vh',
          overflowY: 'auto',
          overflowX: 'clip',
          overscrollBehavior: 'y contain',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div className="brand-scroll-flow-inner">
          {SECTION_ORDER.map((section) => (
            <SectionView key={section} section={section} slug={slug} />
          ))}
        </div>
      </div>
      {snapEnabled ? <SectionDotNav onSelect={jumpToSection} /> : null}
    </ScrollFlowProvider>
  )
}
