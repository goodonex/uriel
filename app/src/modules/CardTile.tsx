import { motion, useReducedMotion } from 'framer-motion'
import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { useOptionalScrollFlowSurface } from '../context/ScrollFlowContext'

export interface CardTileProps {
  children: ReactNode
  flyFrom?: 'left' | 'right' | 'bottom' | 'top'
  delay?: number
  width?: string | number
  style?: CSSProperties
  className?: string
  nested?: boolean
  bare?: boolean
  /** Schwebende Idle-Animation (Standard: an, außer bare) */
  float?: boolean
}

/** Für motion-* auf klickbaren Flächen innerhalb von Cards */
export const CARD_TILE_TAP = {
  whileTap: { scale: 0.97 },
  transition: { duration: 0.1 },
} as const

const FLY_VARIANTS = {
  left: {
    hidden: { opacity: 0, x: -180, scale: 0.88 },
    visible: { opacity: 1, x: 0, scale: 1 },
  },
  right: {
    hidden: { opacity: 0, x: 180, scale: 0.88 },
    visible: { opacity: 1, x: 0, scale: 1 },
  },
  bottom: {
    hidden: { opacity: 0, y: 120, scale: 0.9 },
    visible: { opacity: 1, y: 0, scale: 1 },
  },
  top: {
    hidden: { opacity: 0, y: -120, scale: 0.9 },
    visible: { opacity: 1, y: 0, scale: 1 },
  },
} as const

/** Aus View: entgegengesetzt zur Einflugsrichtung */
const EXIT_OFFSET = {
  left: { x: 180, y: 0, scale: 0.88 },
  right: { x: -180, y: 0, scale: 0.88 },
  bottom: { x: 0, y: -120, scale: 0.9 },
  top: { x: 0, y: 120, scale: 0.9 },
} as const

const ENTRY_SPRING = {
  type: 'spring' as const,
  stiffness: 220,
  damping: 20,
  mass: 1.0,
}

const IO_THRESHOLDS = Array.from({ length: 41 }, (_, i) => i / 40)

/**
 * Native IO mit Scroll-Root — Framer useInView ist hier fehleranfällig (Root/Deps).
 */
function useInBrandScrollSurface(
  observed: HTMLElement | null,
  scrollRoot: HTMLElement | null,
  minVisibleRatio: number,
): boolean {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!observed) return

    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[0]
        if (!e) return
        setVisible(e.isIntersecting && e.intersectionRatio >= minVisibleRatio)
      },
      {
        root: scrollRoot,
        threshold: IO_THRESHOLDS,
        rootMargin: '0px 0px -50px 0px',
      },
    )

    io.observe(observed)
    return () => io.disconnect()
  }, [observed, scrollRoot, minVisibleRatio])

  return visible
}

export function CardTile({
  children,
  flyFrom = 'left',
  delay = 0,
  width,
  style,
  className,
  nested = false,
  bare = false,
  float = !bare,
}: CardTileProps) {
  const reduceMotion = useReducedMotion()
  const scrollSurface = useOptionalScrollFlowSurface()
  const [observeEl, setObserveEl] = useState<HTMLDivElement | null>(null)

  const bindRootRef = useCallback((node: HTMLDivElement | null) => {
    setObserveEl(node)
  }, [])

  const inView = useInBrandScrollSurface(observeEl, scrollSurface, 0.1)

  const fly = FLY_VARIANTS[flyFrom]
  const exit = EXIT_OFFSET[flyFrom]

  const cubicOut: [number, number, number, number] = [0.16, 1, 0.3, 1]

  const outerLayoutStyle: CSSProperties = {
    width,
    minWidth: 0,
    minHeight: 0,
    maxHeight: '100%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'visible',
    pointerEvents: 'auto',
    ...style,
  }

  const glassChrome: CSSProperties = {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    background: nested ? 'rgba(8, 8, 16, 0.32)' : 'rgba(8, 8, 16, 0.42)',
    backdropFilter: nested ? 'blur(12px)' : 'blur(18px)',
    WebkitBackdropFilter: nested ? 'blur(12px)' : 'blur(18px)',
    border: '1px solid color-mix(in srgb, var(--glass-border-1) 85%, transparent)',
    borderRadius: 16,
    boxShadow: nested
      ? '0 10px 36px rgba(0,0,0,0.32), 0 2px 0 rgba(255,255,255,0.03) inset'
      : '0 16px 48px rgba(0,0,0,0.38), 0 1px 0 rgba(255,255,255,0.05) inset',
  }

  const bareChrome: CSSProperties = {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    background: 'transparent',
    backdropFilter: 'none',
    WebkitBackdropFilter: 'none',
    border: 'none',
    borderRadius: 0,
    boxShadow: 'none',
  }

  const hoverLift = {
    y: -3,
    scale: 1.008,
    boxShadow:
      '0 32px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.07) inset',
    transition: {
      duration: 0.2,
      ease: cubicOut,
    },
  } as const

  if (reduceMotion) {
    const chromeStyle: CSSProperties = {
      ...outerLayoutStyle,
      ...bareChrome,
      ...(bare ? {} : glassChrome),
    }
    return (
      <div ref={bindRootRef} className={className} style={chromeStyle}>
        <div
          className="card-tile-scroll module-scroll"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: bare ? 0 : nested ? '10px 12px' : '12px 14px',
          }}
        >
          {children}
        </div>
      </div>
    )
  }

  /** Äußere Ebene: nur Translation + Opacity — IO und Hover kollidieren nicht mit einem gemeinsamen scale */
  const outerHidden = {
    opacity: fly.hidden.opacity,
    x: 'x' in fly.hidden ? fly.hidden.x : 0,
    y: 'y' in fly.hidden ? fly.hidden.y : 0,
  }

  const outerAnimate = inView
    ? { opacity: 1, x: 0, y: 0 }
    : { opacity: 0, x: exit.x, y: exit.y }

  const outerTransition = inView
    ? {
        opacity: { duration: 0.45, delay, ease: cubicOut },
        x: { ...ENTRY_SPRING, delay },
        y: { ...ENTRY_SPRING, delay },
      }
    : {
        opacity: { duration: 0.2, ease: 'easeIn' as const },
        x: { duration: 0.2, ease: 'easeIn' as const },
        y: { duration: 0.2, ease: 'easeIn' as const },
      }

  const scaleHidden = fly.hidden.scale ?? 0.92
  const scaleExit = exit.scale

  const scaleAnimate = inView ? { scale: 1 } : { scale: scaleExit }

  const scaleTransition = inView
    ? { scale: { ...ENTRY_SPRING, delay } }
    : { scale: { duration: 0.2, ease: 'easeIn' as const } }

  if (bare) {
    const chromeStyle: CSSProperties = {
      ...outerLayoutStyle,
      ...bareChrome,
    }

    return (
      <motion.div
        ref={bindRootRef}
        className={className}
        initial={{ ...outerHidden, scale: scaleHidden }}
        animate={{ ...outerAnimate, ...scaleAnimate }}
        transition={{ ...outerTransition, ...scaleTransition }}
        style={chromeStyle}
      >
        <motion.div
          className="card-tile-scroll module-scroll"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: 0,
          }}
          animate={float && inView ? { y: [0, -7, 0] } : { y: 0 }}
          transition={
            float && inView
              ? {
                  repeat: Infinity,
                  duration: 5.2,
                  ease: 'easeInOut',
                  delay: delay + 0.45,
                }
              : { duration: 0.25 }
          }
        >
          {children}
        </motion.div>
      </motion.div>
    )
  }

  return (
    <motion.div
      ref={bindRootRef}
      className={className}
      initial={outerHidden}
      animate={outerAnimate}
      transition={outerTransition}
      style={outerLayoutStyle}
    >
      <motion.div
        initial={{ scale: scaleHidden }}
        animate={scaleAnimate}
        transition={scaleTransition}
        whileHover={hoverLift}
        style={glassChrome}
      >
        <motion.div
          className="card-tile-scroll module-scroll"
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: nested ? '10px 12px' : '12px 14px',
          }}
          animate={float && inView ? { y: [0, -7, 0] } : { y: 0 }}
          transition={
            float && inView
              ? {
                  repeat: Infinity,
                  duration: 5.2,
                  ease: 'easeInOut',
                  delay: delay + 0.45,
                }
              : { duration: 0.25 }
          }
        >
          {children}
        </motion.div>
      </motion.div>
    </motion.div>
  )
}
