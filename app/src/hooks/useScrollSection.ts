import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import type { SectionKey } from '../lib/scrollFlow'

interface UseScrollSectionOptions {
  containerRef: RefObject<HTMLElement | null>
  enabled: boolean
  activeSection: SectionKey
  onSectionChange: (section: SectionKey) => void
}

/**
 * Trackt die sichtbare Section per IntersectionObserver (threshold 0.6).
 */
export function useScrollSection({
  containerRef,
  enabled,
  activeSection,
  onSectionChange,
}: UseScrollSectionOptions) {
  const activeRef = useRef(activeSection)
  const suppressObserverRef = useRef(false)

  activeRef.current = activeSection

  useEffect(() => {
    if (!enabled) return
    const root = containerRef.current
    if (!root) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (suppressObserverRef.current) return
        const hit = entries
          .filter((e) => e.isIntersecting && e.intersectionRatio >= 0.6)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (!hit?.target) return
        const key = hit.target.getAttribute('data-scroll-section') as SectionKey | null
        if (!key || key === activeRef.current) return
        onSectionChange(key)
      },
      { root, threshold: [0.55, 0.6, 0.75] },
    )

    root.querySelectorAll('[data-scroll-section]').forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [containerRef, enabled, onSectionChange])

  return { suppressObserverRef }
}
