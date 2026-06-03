import { useCallback, useEffect, useRef, type RefObject } from 'react'
import { SECTION_ORDER, type SectionKey } from '../lib/scrollFlow'

const SETTLE_MS = 200
/** Anteil des Viewports, der überwunden werden muss, bevor die nächste Section gilt (Hysterese). */
const SECTION_SWITCH_BARRIER = 0.55
/** Wheel-Delta (px), das an Section-Grenzen gesammelt werden muss, bevor gewechselt wird. */
const WHEEL_BARRIER_PX = 340
const SECTION_EDGE_PX = 8

/** Aktive Section aus Scroll-Position (gleich hohe 100vh-Slots, mit Hysterese). */
export function readSectionFromScroll(root: HTMLElement): SectionKey {
  const slot = root.clientHeight
  if (slot <= 0) return 'dashboard'
  const raw = root.scrollTop / slot
  const floor = Math.floor(raw)
  const frac = raw - floor
  const clampedFloor = Math.max(0, Math.min(SECTION_ORDER.length - 1, floor))

  // Nur am unteren Rand der Section zur nächsten wechseln.
  // frac≈0 ist Section-Start — hier NICHT eine Section zurückspringen (sonst Sales→Promo).
  if (frac >= 1 - SECTION_SWITCH_BARRIER) {
    return SECTION_ORDER[Math.min(clampedFloor + 1, SECTION_ORDER.length - 1)]
  }
  return SECTION_ORDER[clampedFloor]
}

function findScrollableAncestor(from: EventTarget | null, root: HTMLElement): HTMLElement | null {
  let el = from instanceof HTMLElement ? from : null
  while (el && el !== root) {
    if (el.scrollHeight > el.clientHeight + 2) {
      const oy = getComputedStyle(el).overflowY
      if (oy === 'auto' || oy === 'scroll' || oy === 'overlay') return el
    }
    el = el.parentElement
  }
  return null
}

function innerScrollConsumesWheel(el: HTMLElement, deltaY: number): boolean {
  if (deltaY > 0) return el.scrollTop + el.clientHeight < el.scrollHeight - 2
  return el.scrollTop > 2
}

export function isSectionAligned(root: HTMLElement, section: SectionKey): boolean {
  const idx = SECTION_ORDER.indexOf(section)
  if (idx < 0) return false
  return Math.abs(root.scrollTop - idx * root.clientHeight) <= 20
}

interface UseSectionScrollSnapOptions {
  containerRef: RefObject<HTMLElement | null>
  pathSection: SectionKey
  scrollLocked?: boolean
  /** false = freies Scrollen, kein Section-Snap / kein Wheel-Wechsel */
  snapEnabled?: boolean
  onActiveSection: (section: SectionKey) => void
  onNavigateSection: (section: SectionKey) => void
}

function clampToSection(root: HTMLElement, section: SectionKey) {
  const idx = SECTION_ORDER.indexOf(section)
  if (idx < 0) return
  const targetTop = idx * root.clientHeight
  if (Math.abs(root.scrollTop - targetTop) > 1) {
    root.scrollTop = targetTop
  }
}

/**
 * Native scroll-snap + URL-Sync nur nach Scroll-Ende.
 * scrollLocked: Detail-Ansichten (Kontakt/Projekt) — kein Rausscrollen in andere Sections.
 */
export function useSectionScrollSnap({
  containerRef,
  pathSection,
  scrollLocked = false,
  snapEnabled = true,
  onActiveSection,
  onNavigateSection,
}: UseSectionScrollSnapOptions) {
  const navFromScrollRef = useRef(false)
  const programmaticRef = useRef(false)
  const settleTimerRef = useRef<number | null>(null)
  const wheelAccumRef = useRef(0)
  const pathSectionRef = useRef(pathSection)
  const scrollLockedRef = useRef(scrollLocked)
  const snapEnabledRef = useRef(snapEnabled)
  pathSectionRef.current = pathSection
  scrollLockedRef.current = scrollLocked
  snapEnabledRef.current = snapEnabled

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

    const sectionLocked = () => scrollLockedRef.current || !snapEnabledRef.current

    const settle = () => {
      programmaticRef.current = false

      if (sectionLocked()) {
        clampToSection(root, pathSectionRef.current)
        onActiveSection(pathSectionRef.current)
        return
      }

      const pathSection = pathSectionRef.current
      const section = isSectionAligned(root, pathSection)
        ? pathSection
        : readSectionFromScroll(root)
      onActiveSection(section)

      if (section === pathSection) return

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
      if (sectionLocked()) {
        clampToSection(root, pathSectionRef.current)
        onActiveSection(pathSectionRef.current)
        return
      }

      if (!programmaticRef.current) {
        const pathSection = pathSectionRef.current
        const section = isSectionAligned(root, pathSection)
          ? pathSection
          : readSectionFromScroll(root)
        onActiveSection(section)
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

    const onWheel = (e: WheelEvent) => {
      if (programmaticRef.current) return

      const inner = findScrollableAncestor(e.target, root)
      if (inner && innerScrollConsumesWheel(inner, e.deltaY)) {
        wheelAccumRef.current = 0
        return
      }

      const slot = root.clientHeight
      if (slot <= 0) return

      const lockedSection = pathSectionRef.current
      const lockedIdx = SECTION_ORDER.indexOf(lockedSection)

      if (sectionLocked() && lockedIdx >= 0) {
        const sectionTop = lockedIdx * slot
        const sectionBottom = sectionTop + slot
        const scrollTop = root.scrollTop
        const atTop = scrollTop <= sectionTop + SECTION_EDGE_PX
        const atBottom = scrollTop + root.clientHeight >= sectionBottom - SECTION_EDGE_PX

        if ((atTop && e.deltaY < 0) || (atBottom && e.deltaY > 0)) {
          e.preventDefault()
        }
        return
      }

      if (!snapEnabledRef.current) return

      const idx = Math.max(0, Math.min(SECTION_ORDER.length - 1, Math.floor(root.scrollTop / slot)))
      const offsetInSection = root.scrollTop - idx * slot
      const atTop = offsetInSection <= SECTION_EDGE_PX
      const atBottom = offsetInSection >= slot - SECTION_EDGE_PX
      const scrollingDown = e.deltaY > 0
      const scrollingUp = e.deltaY < 0

      const wantsNext = atBottom && scrollingDown && idx < SECTION_ORDER.length - 1
      const wantsPrev = atTop && scrollingUp && idx > 0

      if (!wantsNext && !wantsPrev) {
        wheelAccumRef.current = 0
        return
      }

      wheelAccumRef.current += e.deltaY
      if (Math.abs(wheelAccumRef.current) < WHEEL_BARRIER_PX) {
        e.preventDefault()
        return
      }
      wheelAccumRef.current = 0
    }

    root.addEventListener('scroll', onScroll, { passive: true })
    root.addEventListener('scrollend', onScrollEnd)
    root.addEventListener('wheel', onWheel, { passive: false })

    return () => {
      root.removeEventListener('scroll', onScroll)
      root.removeEventListener('scrollend', onScrollEnd)
      root.removeEventListener('wheel', onWheel)
      if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current)
    }
  }, [containerRef, scrollLocked, snapEnabled, onActiveSection, onNavigateSection])

  return { scrollToSection, navFromScrollRef, programmaticRef }
}
