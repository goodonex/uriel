import { useCallback, useEffect, useRef, type RefObject } from 'react'
import { SECTION_ORDER, type SectionKey } from '../lib/scrollFlow'

/** Wheel-Delta bis der nächste Section-Snap auslöst (höher = schwerer) */
const SWITCH_THRESHOLD = 280
/** Max. visueller Widerstand in px an der Section-Kante */
const RESISTANCE_MAX_PX = 56
/** Dauer des Section-Wechsels in ms */
const SNAP_DURATION_MS = 1050
/** Nach programmatischem Scroll Observer kurz pausieren */
const SNAP_LOCK_MS = SNAP_DURATION_MS + 120

function easeOutQuart(t: number): number {
  return 1 - (1 - t) ** 4
}

function isNestedScroller(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null
  const el = target.closest('.card-tile-scroll, .module-scroll') as HTMLElement | null
  if (!el || el.scrollHeight <= el.clientHeight + 2) return null
  return el
}

function nestedCanConsumeWheel(el: HTMLElement, deltaY: number): boolean {
  const max = el.scrollHeight - el.clientHeight
  if (max <= 0) return false
  if (deltaY > 0) return el.scrollTop < max - 1
  return el.scrollTop > 1
}

function animateScrollTop(element: HTMLElement, targetTop: number, duration: number): Promise<void> {
  const start = element.scrollTop
  const delta = targetTop - start
  if (Math.abs(delta) < 2) return Promise.resolve()

  const startTime = performance.now()
  return new Promise((resolve) => {
    const tick = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration)
      element.scrollTop = start + delta * easeOutQuart(t)
      if (t < 1) {
        requestAnimationFrame(tick)
      } else {
        element.scrollTop = targetTop
        resolve()
      }
    }
    requestAnimationFrame(tick)
  })
}

function sectionOffsets(root: HTMLElement): Array<{ key: SectionKey; top: number }> {
  return SECTION_ORDER.map((key) => {
    const el = root.querySelector(`[data-scroll-section="${key}"]`)
    return { key, top: el instanceof HTMLElement ? el.offsetTop : 0 }
  }).filter((s) => s.top >= 0)
}

function currentSectionIndex(offsets: Array<{ key: SectionKey; top: number }>, scrollTop: number): number {
  let idx = 0
  for (let i = 0; i < offsets.length; i++) {
    if (scrollTop >= offsets[i].top - 8) idx = i
  }
  return idx
}

export interface UseHeavySectionScrollOptions {
  containerRef: RefObject<HTMLElement | null>
  innerRef?: RefObject<HTMLElement | null>
  enabled: boolean
  onSnapStart?: () => void
  onSnapEnd?: () => void
}

/**
 * Macht Section-Wechsel „schwerer“: Wheel sammelt erst Widerstand,
 * dann langsamer programmatischer Snap statt sofortigem Browser-Snap.
 */
export function useHeavySectionScroll({
  containerRef,
  innerRef,
  enabled,
  onSnapStart,
  onSnapEnd,
}: UseHeavySectionScrollOptions) {
  const accumulatorRef = useRef(0)
  const resistanceRef = useRef(0)
  const snappingRef = useRef(false)
  const cooldownRef = useRef(0)
  const onSnapStartRef = useRef(onSnapStart)
  const onSnapEndRef = useRef(onSnapEnd)
  onSnapStartRef.current = onSnapStart
  onSnapEndRef.current = onSnapEnd

  const scrollToSectionHeavy = useCallback(
    async (section: SectionKey) => {
      const root = containerRef.current
      if (!root || snappingRef.current) return
      const offsets = sectionOffsets(root)
      const idx = offsets.findIndex((o) => o.key === section)
      if (idx < 0) return

      snappingRef.current = true
      accumulatorRef.current = 0
      onSnapStartRef.current?.()
      cooldownRef.current = performance.now() + SNAP_LOCK_MS
      await animateScrollTop(root, offsets[idx].top, SNAP_DURATION_MS)
      snappingRef.current = false
      onSnapEndRef.current?.()
    },
    [containerRef],
  )

  useEffect(() => {
    if (!enabled) return
    const root = containerRef.current
    if (!root) return

    let raf = 0

    const applyResistanceVisual = (px: number) => {
      const inner = innerRef?.current
      if (!inner) return
      inner.style.transform = px === 0 ? '' : `translate3d(0, ${px}px, 0)`
      inner.style.transition = px === 0 ? 'transform 0.38s cubic-bezier(0.16, 1, 0.3, 1)' : 'none'
    }

    const decayResistance = () => {
      resistanceRef.current *= 0.82
      if (Math.abs(resistanceRef.current) < 0.6) {
        resistanceRef.current = 0
        applyResistanceVisual(0)
        return
      }
      const sign = Math.sign(resistanceRef.current)
      const visual = Math.min(RESISTANCE_MAX_PX, Math.abs(resistanceRef.current)) * sign
      applyResistanceVisual(visual)
      raf = requestAnimationFrame(decayResistance)
    }

    const snapToIndex = async (targetIndex: number) => {
      const offsets = sectionOffsets(root)
      const clamped = Math.max(0, Math.min(offsets.length - 1, targetIndex))
      const target = offsets[clamped]
      if (!target) return

      snappingRef.current = true
      accumulatorRef.current = 0
      resistanceRef.current = 0
      applyResistanceVisual(0)
      onSnapStart?.()
      cooldownRef.current = performance.now() + SNAP_LOCK_MS

      await animateScrollTop(root, target.top, SNAP_DURATION_MS)

      snappingRef.current = false
      onSnapEnd?.()
    }

    const onWheel = (e: WheelEvent) => {
      if (snappingRef.current || performance.now() < cooldownRef.current) {
        e.preventDefault()
        return
      }

      const nested = isNestedScroller(e.target)
      if (nested && nestedCanConsumeWheel(nested, e.deltaY)) return

      const offsets = sectionOffsets(root)
      if (offsets.length === 0) return

      const idx = currentSectionIndex(offsets, root.scrollTop)
      const goingDown = e.deltaY > 0
      const goingUp = e.deltaY < 0

      if ((goingDown && idx >= offsets.length - 1) || (goingUp && idx <= 0)) {
        e.preventDefault()
        return
      }

      e.preventDefault()

      const delta = Math.abs(e.deltaY)
      accumulatorRef.current += delta

      const resistPush =
        Math.min(RESISTANCE_MAX_PX, accumulatorRef.current * 0.22) * (goingDown ? 1 : -1)
      resistanceRef.current = resistPush
      applyResistanceVisual(resistPush)

      if (accumulatorRef.current >= SWITCH_THRESHOLD) {
        cancelAnimationFrame(raf)
        void snapToIndex(goingDown ? idx + 1 : idx - 1)
        return
      }

      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(decayResistance)
    }

    root.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      root.removeEventListener('wheel', onWheel)
      cancelAnimationFrame(raf)
      applyResistanceVisual(0)
    }
  }, [containerRef, innerRef, enabled])

  return { scrollToSectionHeavy, isSnapping: () => snappingRef.current }
}
