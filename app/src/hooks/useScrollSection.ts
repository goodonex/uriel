import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import type { SectionKey } from '../lib/scrollFlow'

interface UseScrollSectionOptions {
  containerRef: RefObject<HTMLElement | null>
  enabled: boolean
  activeSection: SectionKey
  onSectionChange: (section: SectionKey) => void
}

const THRESHOLDS = Array.from({ length: 21 }, (_, i) => i / 20)

/**
 * Trackt die sichtbare Section per IntersectionObserver.
 */
export function useScrollSection({
  containerRef,
  enabled,
  activeSection,
  onSectionChange,
}: UseScrollSectionOptions) {
  const activeRef = useRef(activeSection)
  const suppressObserverRef = useRef(false)
  const ratiosRef = useRef<Map<SectionKey, number>>(new Map())

  activeRef.current = activeSection

  useEffect(() => {
    if (!enabled) return
    const root = containerRef.current
    if (!root) return

    const pickBest = () => {
      if (suppressObserverRef.current) return
      let bestKey: SectionKey | null = null
      let bestRatio = 0
      for (const [key, ratio] of ratiosRef.current) {
        if (ratio > bestRatio) {
          bestRatio = ratio
          bestKey = key
        }
      }
      if (bestKey && bestRatio >= 0.32 && bestKey !== activeRef.current) {
        onSectionChange(bestKey)
      }
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const key = e.target.getAttribute('data-scroll-section') as SectionKey | null
          if (!key) continue
          if (e.isIntersecting) {
            ratiosRef.current.set(key, e.intersectionRatio)
          } else {
            ratiosRef.current.set(key, 0)
          }
        }
        pickBest()
      },
      { root, threshold: THRESHOLDS },
    )

    root.querySelectorAll('[data-scroll-section]').forEach((el) => observer.observe(el))
    return () => {
      observer.disconnect()
      ratiosRef.current.clear()
    }
  }, [containerRef, enabled, onSectionChange])

  return { suppressObserverRef }
}
