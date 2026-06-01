import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useLocation } from 'react-router-dom'
import type { SectionKey } from '../lib/scrollFlow'
import { sectionFromPathname } from '../lib/scrollFlow'
import type { BrandNavSection } from '../lib/brandNav'
import { readSectionScrollEnabled, writeSectionScrollEnabled } from '../lib/sectionScrollPref'

interface ScrollSectionContextValue {
  /** Desktop Scroll-Flow aktiv (Viewport) */
  syncEnabled: boolean
  /** Nutzer: vertikales Section-Scrollen / Snap */
  sectionScrollEnabled: boolean
  setSectionScrollEnabled: (enabled: boolean) => void
  /** Snap + URL-Sync aus Scroll */
  effectiveSectionScroll: boolean
  activeSection: SectionKey
  setActiveSection: (section: SectionKey) => void
  registerScrollToSection: (fn: ((section: SectionKey) => void) | null) => void
  scrollToSection: (section: SectionKey) => void
}

const ScrollSectionContext = createContext<ScrollSectionContextValue | null>(null)

export function ScrollSectionProvider({
  children,
  enabled,
}: {
  children: ReactNode
  enabled: boolean
}) {
  const { pathname } = useLocation()
  const pathSection = sectionFromPathname(pathname)
  const [activeSection, setActiveSection] = useState<SectionKey>(pathSection)
  const [sectionScrollEnabled, setSectionScrollEnabledState] = useState(readSectionScrollEnabled)
  const scrollToRef = useRef<((section: SectionKey) => void) | null>(null)

  const setSectionScrollEnabled = useCallback((next: boolean) => {
    setSectionScrollEnabledState(next)
    writeSectionScrollEnabled(next)
  }, [])

  const effectiveSectionScroll = enabled && sectionScrollEnabled

  useEffect(() => {
    setActiveSection(pathSection)
  }, [pathSection])

  const registerScrollToSection = useCallback((fn: ((section: SectionKey) => void) | null) => {
    scrollToRef.current = fn
  }, [])

  const scrollToSection = useCallback(
    (section: SectionKey) => {
      if (enabled && scrollToRef.current) {
        scrollToRef.current(section)
      }
    },
    [enabled],
  )

  const value = useMemo(
    () => ({
      syncEnabled: enabled,
      sectionScrollEnabled,
      setSectionScrollEnabled,
      effectiveSectionScroll,
      activeSection,
      setActiveSection,
      registerScrollToSection,
      scrollToSection,
    }),
    [
      enabled,
      sectionScrollEnabled,
      setSectionScrollEnabled,
      effectiveSectionScroll,
      activeSection,
      registerScrollToSection,
      scrollToSection,
    ],
  )

  return <ScrollSectionContext.Provider value={value}>{children}</ScrollSectionContext.Provider>
}

export function useScrollSectionContext(): ScrollSectionContextValue | null {
  return useContext(ScrollSectionContext)
}

export function navSectionToScrollKey(section: BrandNavSection): SectionKey {
  switch (section) {
    case 'dashboard':
      return 'dashboard'
    case 'foundation':
      return 'foundation'
    case 'promo':
      return 'promo'
    case 'sales':
    case 'sales_lists':
      return 'sales'
    case 'deliver':
      return 'deliver'
    case 'intelligence':
      return 'intelligence'
    default:
      return 'dashboard'
  }
}

export function scrollKeyToNavSection(key: SectionKey): BrandNavSection {
  switch (key) {
    case 'dashboard':
      return 'dashboard'
    case 'foundation':
      return 'foundation'
    case 'promo':
      return 'promo'
    case 'sales':
      return 'sales'
    case 'deliver':
      return 'deliver'
    case 'intelligence':
      return 'intelligence'
    default:
      return 'dashboard'
  }
}
