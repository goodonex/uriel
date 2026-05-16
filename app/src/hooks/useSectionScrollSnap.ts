import { useCallback, useEffect, useRef, type RefObject } from 'react'
import { SECTION_ORDER, type SectionKey } from '../lib/scrollFlow'

const SETTLE_MS = 140

/** Aktive Section aus Scroll-Position (gleich hohe 100vh-Slots). */
export function readSectionFromScroll(root: HTMLElement): SectionKey {
  const slot = root.clientHeight
  if (slot <= 0) return 'dashboard'
  const idx = Math.round(root.scrollTop / slot)
  const clamped = Math.max(0, Math.min(SECTION_ORDER.length - 1, idx))
  return SECTION_ORDER[clamped]
}

export function isSectionAligned(root: HTMLElement, section: SectionKey): boolean {
  const idx = SECTION_ORDER.indexOf(section)
  if (idx < 0) return false
  return Math.abs(root.scrollTop - idx * root.clientHeight) <= 20
}

interface UseSectionScrollSnapOptions {
  containerRef: RefObject<HTMLElement | null>
  pathSection: SectionKey
  onActiveSection: (section: SectionKey) => void
  onNavigateSection: (section: SectionKey) => void
}

/**
 * Native scroll-snap + URL-Sync nur nach Scroll-Ende.
 * Kein Wheel-Hijacking — verhindert Feedback-Loops mit navigate().
 */
export function useSectionScrollSnap({
  containerRef,
  pathSection,
  onActiveSection,
  onNavigateSection,
}: UseSectionScrollSnapOptions) {
  const navFromScrollRef = useRef(false)
  const programmaticRef = useRef(false)
  const settleTimerRef = useRef<number | null>(null)
  const pathSectionRef = useRef(pathSection)
  pathSectionRef.current = pathSection

  const scrollToSection = useCallback(
    (section: SectionKey, behavior: ScrollBehavior = 'smooth') => {
      const root = containerRef.current
      if (!root) return
      const el = root.querySelector(`[data-scroll-section="${section}"]`)
      if (!(el instanceof HTMLElement)) return
      if (isSectionAligned(root, section)) return

      programmaticRef.current = true
      el.scrollIntoView({ behavior, block: 'start' })
    },
    [containerRef],
  )

  useEffect(() => {
    const root = containerRef.current
    if (!root) return

    const settle = () => {
      programmaticRef.current = false
      const section = readSectionFromScroll(root)
      onActiveSection(section)

      if (section === pathSectionRef.current) return

      navFromScrollRef.current = true
      onNavigateSection(section)
    }

    const scheduleSettle = () => {
      if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current)
      settleTimerRef.current = window.setTimeout(() => {
        settleTimerRef.current = null
        settle()
      }, SETTLE_MS)
    }

    const onScroll = () => {
      if (!programmaticRef.current) {
        onActiveSection(readSectionFromScroll(root))
      }
      scheduleSettle()
    }

    const onScrollEnd = () => {
      if (settleTimerRef.current !== null) {
        window.clearTimeout(settleTimerRef.current)
        settleTimerRef.current = null
      }
      settle()
    }

    root.addEventListener('scroll', onScroll, { passive: true })
    root.addEventListener('scrollend', onScrollEnd)

    return () => {
      root.removeEventListener('scroll', onScroll)
      root.removeEventListener('scrollend', onScrollEnd)
      if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current)
    }
  }, [containerRef, onActiveSection, onNavigateSection])

  return { scrollToSection, navFromScrollRef, programmaticRef }
}
