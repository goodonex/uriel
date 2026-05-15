import { motion, useInView, useReducedMotion } from 'framer-motion'
import { useRef, type CSSProperties, type ReactNode } from 'react'

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
    hidden: { opacity: 0, x: -120, scale: 0.92 },
    visible: { opacity: 1, x: 0, scale: 1 },
  },
  right: {
    hidden: { opacity: 0, x: 120, scale: 0.92 },
    visible: { opacity: 1, x: 0, scale: 1 },
  },
  bottom: {
    hidden: { opacity: 0, y: 80, scale: 0.94 },
    visible: { opacity: 1, y: 0, scale: 1 },
  },
  top: {
    hidden: { opacity: 0, y: -80, scale: 0.94 },
    visible: { opacity: 1, y: 0, scale: 1 },
  },
} as const

/** Aus View: entgegengesetzt zur Einflugsrichtung */
const EXIT_OFFSET = {
  left: { x: 120, y: 0, scale: 0.92 },
  right: { x: -120, y: 0, scale: 0.92 },
  bottom: { x: 0, y: -80, scale: 0.94 },
  top: { x: 0, y: 80, scale: 0.94 },
} as const

const ENTRY_SPRING = {
  type: 'spring' as const,
  stiffness: 260,
  damping: 22,
  mass: 0.8,
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
  const ref = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()
  const inView = useInView(ref, { amount: 0.15, once: false })
  const fly = FLY_VARIANTS[flyFrom]
  const exit = EXIT_OFFSET[flyFrom]

  const chromeStyle: CSSProperties = {
    width,
    minWidth: 0,
    minHeight: 0,
    maxHeight: '100%',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    background: bare
      ? 'transparent'
      : nested
        ? 'rgba(8, 8, 16, 0.32)'
        : 'rgba(8, 8, 16, 0.42)',
    backdropFilter: bare ? 'none' : nested ? 'blur(12px)' : 'blur(18px)',
    WebkitBackdropFilter: bare ? 'none' : nested ? 'blur(12px)' : 'blur(18px)',
    border: bare ? 'none' : '1px solid color-mix(in srgb, var(--glass-border-1) 85%, transparent)',
    borderRadius: bare ? 0 : 16,
    boxShadow: bare
      ? 'none'
      : nested
        ? '0 10px 36px rgba(0,0,0,0.32), 0 2px 0 rgba(255,255,255,0.03) inset'
        : '0 16px 48px rgba(0,0,0,0.38), 0 1px 0 rgba(255,255,255,0.05) inset',
    pointerEvents: 'auto',
    ...style,
  }

  if (reduceMotion) {
    return (
      <div ref={ref} className={className} style={chromeStyle}>
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

  const animate = inView
    ? {
        opacity: 1,
        x: 0,
        y: 0,
        scale: 1,
      }
    : {
        opacity: 0,
        x: exit.x,
        y: exit.y,
        scale: exit.scale,
      }

  const cubicOut: [number, number, number, number] = [0.16, 1, 0.3, 1]

  const transition = inView
    ? {
        opacity: { duration: 0.45, delay, ease: cubicOut },
        x: { ...ENTRY_SPRING, delay },
        y: { ...ENTRY_SPRING, delay },
        scale: { ...ENTRY_SPRING, delay },
      }
    : {
        opacity: { duration: 0.2, ease: 'easeIn' as const },
        x: { duration: 0.2, ease: 'easeIn' as const },
        y: { duration: 0.2, ease: 'easeIn' as const },
        scale: { duration: 0.2, ease: 'easeIn' as const },
      }

  const initial = {
    opacity: fly.hidden.opacity,
    x: 'x' in fly.hidden ? fly.hidden.x : 0,
    y: 'y' in fly.hidden ? fly.hidden.y : 0,
    scale: fly.hidden.scale ?? 0.92,
  }

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={initial}
      animate={animate}
      transition={transition}
      whileHover={{
        y: -3,
        scale: 1.008,
        boxShadow:
          '0 32px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.07) inset',
        transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
      }}
      style={chromeStyle}
    >
      <motion.div
        className="card-tile-scroll module-scroll"
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: bare ? 0 : nested ? '10px 12px' : '12px 14px',
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
