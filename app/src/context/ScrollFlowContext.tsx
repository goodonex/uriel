import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { pathForSection, type SectionKey } from '../lib/scrollFlow'

interface ScrollFlowContextValue {
  slug: string
  scrollToSection: (section: SectionKey, behavior?: ScrollBehavior) => void
  navigateToSection: (section: SectionKey) => void
}

const ScrollFlowContext = createContext<ScrollFlowContextValue | null>(null)

export function ScrollFlowProvider({
  slug,
  containerRef,
  children,
}: {
  slug: string
  containerRef: React.RefObject<HTMLElement | null>
  children: ReactNode
}) {
  const navigate = useNavigate()

  const scrollToSection = useCallback(
    (section: SectionKey, behavior: ScrollBehavior = 'smooth') => {
      const root = containerRef.current
      if (!root) return
      const el = root.querySelector(`[data-scroll-section="${section}"]`)
      el?.scrollIntoView({ behavior, block: 'start' })
    },
    [containerRef],
  )

  const navigateToSection = useCallback(
    (section: SectionKey) => {
      navigate(pathForSection(slug, section))
    },
    [navigate, slug],
  )

  const value = useMemo(
    () => ({ slug, scrollToSection, navigateToSection }),
    [slug, scrollToSection, navigateToSection],
  )

  return <ScrollFlowContext.Provider value={value}>{children}</ScrollFlowContext.Provider>
}

export function useScrollFlow(): ScrollFlowContextValue {
  const ctx = useContext(ScrollFlowContext)
  if (!ctx) {
    throw new Error('useScrollFlow must be used within ScrollFlowProvider')
  }
  return ctx
}
