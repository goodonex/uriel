import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
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

const SETTLE_MS = 180
const PANEL_SWITCH_BARRIER = 0.55
const WHEEL_BARRIER_PX = 300
const PANEL_EDGE_PX = 8

function readIndexFromScroll(root: HTMLElement, panelCount: number): number {
  const slot = root.clientWidth
  if (slot <= 0) return 0
  const raw = root.scrollLeft / slot
  const floor = Math.floor(raw)
  const frac = raw - floor
  const clampedFloor = Math.max(0, Math.min(panelCount - 1, floor))

  if (frac >= 1 - PANEL_SWITCH_BARRIER) {
    return Math.min(clampedFloor + 1, panelCount - 1)
  }
  if (frac <= PANEL_SWITCH_BARRIER && clampedFloor > 0) {
    return clampedFloor - 1
  }
  return clampedFloor
}

function isIndexAligned(root: HTMLElement, index: number): boolean {
  const slot = root.clientWidth
  if (slot <= 0) return true
  return Math.abs(root.scrollLeft - index * slot) <= 16
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
  const [scrollIndex, setScrollIndex] = useState(0)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const navFromScrollRef = useRef(false)
  const programmaticRef = useRef(false)
  const settleTimerRef = useRef<number | null>(null)
  const wheelAccumRef = useRef(0)

  const routeIndex = controlledIndex ?? internalIndex
  const activeIndex = scrollIndex
  const useDropdown = isMobile && tabs.length > 4

  const setIndex = useCallback(
    (idx: number, source: 'click' | 'scroll' = 'click') => {
      const clamped = Math.max(0, Math.min(children.length - 1, idx))
      setScrollIndex(clamped)
      if (controlledIndex === undefined) setInternalIndex(clamped)
      if (source === 'click') onIndexChange?.(clamped)
    },
    [children.length, controlledIndex, onIndexChange],
  )

  const scrollToIndex = useCallback(
    (idx: number, behavior: ScrollBehavior = 'smooth') => {
      const el = panelRefs.current[idx]
      const root = scrollRef.current
      if (!el || !root) return
      if (isIndexAligned(root, idx)) return
      programmaticRef.current = true
      root.scrollTo({ left: el.offsetLeft, behavior })
    },
    [],
  )

  useEffect(() => {
    setScrollIndex(routeIndex)
  }, [routeIndex])

  useEffect(() => {
    if (navFromScrollRef.current) {
      navFromScrollRef.current = false
      return
    }
    if (controlledIndex === undefined) return
    const root = scrollRef.current
    if (!root) return
    if (isIndexAligned(root, controlledIndex)) return
    scrollToIndex(controlledIndex, 'auto')
  }, [controlledIndex, scrollToIndex])

  useEffect(() => {
    const root = scrollRef.current
    if (!root) return

    const settle = () => {
      programmaticRef.current = false
      const idx = readIndexFromScroll(root, children.length)
      setScrollIndex(idx)
      if (controlledIndex === undefined) setInternalIndex(idx)
      if (idx === routeIndex) return
      navFromScrollRef.current = true
      onIndexChange?.(idx)
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
        setScrollIndex(readIndexFromScroll(root, children.length))
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
  }, [children.length, controlledIndex, onIndexChange, routeIndex])

  useEffect(() => {
    const root = scrollRef.current
    if (!root) return

    const onWheel = (e: WheelEvent) => {
      const dx = Math.abs(e.deltaX)
      const dy = Math.abs(e.deltaY)
      if (dx <= dy * 0.55) return

      e.stopPropagation()

      const slot = root.clientWidth
      if (slot <= 0) return

      const idx = Math.max(0, Math.min(children.length - 1, Math.floor(root.scrollLeft / slot)))
      const offsetInPanel = root.scrollLeft - idx * slot
      const atLeft = offsetInPanel <= PANEL_EDGE_PX
      const atRight = offsetInPanel >= slot - PANEL_EDGE_PX
      const scrollingRight = e.deltaX > 0
      const scrollingLeft = e.deltaX < 0

      const wantsNext = atRight && scrollingRight && idx < children.length - 1
      const wantsPrev = atLeft && scrollingLeft && idx > 0

      if (!wantsNext && !wantsPrev) {
        wheelAccumRef.current = 0
        return
      }

      wheelAccumRef.current += e.deltaX
      if (Math.abs(wheelAccumRef.current) < WHEEL_BARRIER_PX) {
        e.preventDefault()
      } else {
        wheelAccumRef.current = 0
      }
    }

    root.addEventListener('wheel', onWheel, { passive: false })
    return () => root.removeEventListener('wheel', onWheel)
  }, [children.length])

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
                      setIndex(i, 'click')
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
                  setIndex(i, 'click')
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
