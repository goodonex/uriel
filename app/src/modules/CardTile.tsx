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

const FLY_OFFSET = {
  left: { x: -48, y: 8 },
  right: { x: 48, y: 8 },
  bottom: { x: 0, y: 36 },
  top: { x: 0, y: -36 },
} as const

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
  const inView = useInView(ref, { amount: 0.18, once: false, margin: '-8% 0px -8% 0px' })
  const off = FLY_OFFSET[flyFrom]

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

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{
        opacity: 0,
        x: off.x,
        y: off.y,
        scale: 0.94,
        filter: 'blur(8px)',
      }}
      animate={
        inView
          ? {
              opacity: 1,
              x: 0,
              y: float ? [0, -7, 0] : 0,
              scale: 1,
              filter: 'blur(0px)',
            }
          : {
              opacity: 0,
              x: off.x * 0.65,
              y: off.y * 0.65,
              scale: 0.96,
              filter: 'blur(6px)',
            }
      }
      transition={{
        opacity: { duration: 0.42, delay, ease: [0.16, 1, 0.3, 1] },
        x: { type: 'spring', stiffness: 280, damping: 28, delay },
        scale: { type: 'spring', stiffness: 300, damping: 26, delay },
        filter: { duration: 0.38, delay },
        y: float
          ? {
              repeat: Infinity,
              duration: 5.2,
              ease: 'easeInOut',
              delay: delay + 0.45,
            }
          : { type: 'spring', stiffness: 280, damping: 28, delay },
      }}
      style={chromeStyle}
    >
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
    </motion.div>
  )
}
