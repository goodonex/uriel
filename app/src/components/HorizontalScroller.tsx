import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type WheelEvent as ReactWheelEvent,
} from 'react'
import { useViewport } from '../hooks/useViewport'

export interface HorizontalScrollerTab {
  id: string
  label: string
}

export interface HorizontalScrollerProps {
  children: ReactNode[]
  tabs: HorizontalScrollerTab[]
  activeIndex?: number
  onIndexChange?: (index: number) => void
}

export function HorizontalScroller({
  children,
  tabs,
  activeIndex: controlledIndex,
  onIndexChange,
}: HorizontalScrollerProps) {
  const { isMobile } = useViewport()
  const scrollRef = useRef<HTMLDivElement>(null)
  const panelRefs = useRef<(HTMLDivElement | null)[]>([])
  const [internalIndex, setInternalIndex] = useState(0)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const suppressObserverRef = useRef(false)

  const activeIndex = controlledIndex ?? internalIndex
  const useDropdown = isMobile && tabs.length > 4

  const setIndex = useCallback(
    (idx: number) => {
      const clamped = Math.max(0, Math.min(children.length - 1, idx))
      if (controlledIndex === undefined) setInternalIndex(clamped)
      onIndexChange?.(clamped)
    },
    [children.length, controlledIndex, onIndexChange],
  )

  const scrollToIndex = useCallback(
    (idx: number, behavior: ScrollBehavior = 'smooth') => {
      const el = panelRefs.current[idx]
      const root = scrollRef.current
      if (!el || !root) return
      suppressObserverRef.current = true
      root.scrollTo({ left: el.offsetLeft, behavior })
      window.setTimeout(() => {
        suppressObserverRef.current = false
      }, behavior === 'smooth' ? 420 : 60)
    },
    [],
  )

  useEffect(() => {
    if (controlledIndex === undefined) return
    scrollToIndex(controlledIndex)
  }, [controlledIndex, scrollToIndex])

  useEffect(() => {
    const root = scrollRef.current
    if (!root) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (suppressObserverRef.current) return
        let bestIdx = -1
        let bestRatio = 0
        for (const e of entries) {
          if (!e.isIntersecting) continue
          const idx = panelRefs.current.findIndex((node) => node === e.target)
          if (idx >= 0 && e.intersectionRatio > bestRatio) {
            bestRatio = e.intersectionRatio
            bestIdx = idx
          }
        }
        if (bestIdx >= 0 && bestRatio >= 0.45) setIndex(bestIdx)
      },
      { root, threshold: [0.45, 0.55, 0.7, 0.85] },
    )

    panelRefs.current.forEach((node) => {
      if (node) observer.observe(node)
    })
    return () => observer.disconnect()
  }, [children.length, setIndex])

  const onWheel = (e: ReactWheelEvent<HTMLDivElement>) => {
    const root = scrollRef.current
    if (!root) return
    const dx = Math.abs(e.deltaX)
    const dy = Math.abs(e.deltaY)
    if (dx > dy * 0.6) {
      e.stopPropagation()
    }
  }

  return (
    <div
      className="horizontal-scroller-root"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        pointerEvents: 'auto',
      }}
    >
      <div
        style={{
          flexShrink: 0,
          marginBottom: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        {useDropdown ? (
          <div style={{ position: 'relative', minWidth: 160 }}>
            <button
              type="button"
              className="font-mono"
              onClick={() => setDropdownOpen((o) => !o)}
              style={{
                width: '100%',
                textAlign: 'left',
                fontSize: 11,
                padding: '8px 12px',
                borderRadius: 10,
                border: '1px solid var(--glass-border-2)',
                background: 'var(--glass-2)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
              }}
            >
              {tabs[activeIndex]?.label ?? 'Panel'}
            </button>
            {dropdownOpen ? (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: 4,
                  zIndex: 20,
                  borderRadius: 10,
                  border: '1px solid var(--glass-border-2)',
                  background: 'rgba(8,8,16,0.95)',
                  backdropFilter: 'blur(12px)',
                  overflow: 'hidden',
                }}
              >
                {tabs.map((tab, i) => (
                  <button
                    key={tab.id}
                    type="button"
                    className="font-mono block w-full text-left"
                    onClick={() => {
                      setDropdownOpen(false)
                      setIndex(i)
                      scrollToIndex(i)
                    }}
                    style={{
                      fontSize: 11,
                      padding: '8px 12px',
                      border: 'none',
                      background: i === activeIndex ? 'var(--glass-3)' : 'transparent',
                      color: i === activeIndex ? 'var(--brand-accent)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          tabs.map((tab, i) => {
            const on = i === activeIndex
            return (
              <button
                key={tab.id}
                type="button"
                className="font-mono shrink-0"
                onClick={() => {
                  setIndex(i)
                  scrollToIndex(i)
                }}
                style={{
                  fontSize: 10,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  padding: '6px 12px',
                  borderRadius: 999,
                  border: on
                    ? '1px solid color-mix(in srgb, var(--brand-accent) 55%, transparent)'
                    : '1px solid var(--glass-border-2)',
                  background: on
                    ? 'color-mix(in srgb, var(--brand-accent) 18%, transparent)'
                    : 'var(--glass-1)',
                  color: on ? 'var(--brand-accent)' : 'var(--text-tertiary)',
                  cursor: 'pointer',
                }}
              >
                {tab.label}
              </button>
            )
          })
        )}
      </div>

      <div
        ref={scrollRef}
        className="horizontal-scroller-track module-scroll"
        onWheel={onWheel}
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          overflowX: 'scroll',
          overflowY: 'hidden',
          scrollSnapType: 'x mandatory',
          scrollBehavior: 'smooth',
          overscrollBehaviorX: 'contain',
          touchAction: 'pan-x',
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {children.map((child, i) => (
          <div
            key={tabs[i]?.id ?? i}
            ref={(el) => {
              panelRefs.current[i] = el
            }}
            className="horizontal-scroller-panel module-scroll"
            style={{
              flex: '0 0 100%',
              minWidth: '100%',
              height: '100%',
              scrollSnapAlign: 'start',
              scrollSnapStop: 'always',
              overflowY: 'auto',
              overflowX: 'hidden',
              paddingRight: 4,
            }}
          >
            {child}
          </div>
        ))}
      </div>
    </div>
  )
}
