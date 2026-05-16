import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { pathForSection, type SectionKey } from '../lib/scrollFlow'

interface ScrollFlowContextValue {
  slug: string
  scrollToSection: (section: SectionKey, behavior?: ScrollBehavior) => void
  navigateToSection: (section: SectionKey) => void
  /** Kurz true nach Scroll — für Dot-Navigation Polish */
  scrollBusy: boolean
}

const ScrollFlowContext = createContext<ScrollFlowContextValue | null>(null)
const ScrollSurfaceContext = createContext<HTMLElement | null>(null)

export function ScrollFlowProvider({
  slug,
  containerRef,
  children,
}: {
  slug: string
  containerRef: RefObject<HTMLElement | null>
  children: ReactNode
}) {
  const navigate = useNavigate()
  const [scrollBusy, setScrollBusy] = useState(false)
  const [scrollSurface, setScrollSurface] = useState<HTMLElement | null>(null)
  const idleTimerRef = useRef<number | null>(null)

  useLayoutEffect(() => {
    setScrollSurface(containerRef.current)
  })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onScroll = () => {
      setScrollBusy(true)
      if (idleTimerRef.current !== null) window.clearTimeout(idleTimerRef.current)
      idleTimerRef.current = window.setTimeout(() => {
        idleTimerRef.current = null
        setScrollBusy(false)
      }, 500)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
      if (idleTimerRef.current !== null) window.clearTimeout(idleTimerRef.current)
    }
  }, [containerRef, scrollSurface])

  const scrollToSection = useCallback(
    (section: SectionKey, behavior: ScrollBehavior = 'smooth') => {
      const root = containerRef.current
      if (!root) return
      const node = root.querySelector(`[data-scroll-section="${section}"]`)
      node?.scrollIntoView({ behavior, block: 'start' })
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
    () => ({ slug, scrollToSection, navigateToSection, scrollBusy }),
    [slug, scrollToSection, navigateToSection, scrollBusy],
  )

  return (
    <ScrollFlowContext.Provider value={value}>
      <ScrollSurfaceContext.Provider value={scrollSurface}>{children}</ScrollSurfaceContext.Provider>
    </ScrollFlowContext.Provider>
  )
}

export function useScrollFlow(): ScrollFlowContextValue {
  const ctx = useContext(ScrollFlowContext)
  if (!ctx) {
    throw new Error('useScrollFlow must be used within ScrollFlowProvider')
  }
  return ctx
}

/** IO-Root für CardTile — Brand-Scroll-Container, nicht Viewport */
export function useOptionalScrollFlowSurface(): HTMLElement | null {
  return useContext(ScrollSurfaceContext)
}
