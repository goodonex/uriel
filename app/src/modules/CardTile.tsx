import { motion, useInView } from 'framer-motion'
import { useRef, type CSSProperties, type ReactNode } from 'react'

export interface CardTileProps {
  children: ReactNode
  flyFrom?: 'left' | 'right' | 'bottom' | 'top'
  delay?: number
  width?: string | number
  style?: CSSProperties
  className?: string
  /** Weniger Chrome wenn Kind-Komponente bereits eigenes Glass hat */
  nested?: boolean
}

const FLY = {
  left: { opacity: 0, x: -32 },
  right: { opacity: 0, x: 32 },
  bottom: { opacity: 0, y: 24 },
  top: { opacity: 0, y: -24 },
} as const

export function CardTile({
  children,
  flyFrom = 'left',
  delay = 0,
  width,
  style,
  className,
  nested = false,
}: CardTileProps) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { amount: 0.25, once: true })

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={FLY[flyFrom]}
      animate={inView ? { opacity: 1, x: 0, y: 0 } : undefined}
      transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1], delay }}
      style={{
        width,
        minWidth: 0,
        minHeight: 0,
        maxHeight: '100%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: nested ? 'rgba(8, 8, 16, 0.32)' : 'rgba(8, 8, 16, 0.45)',
        backdropFilter: nested ? 'blur(12px)' : 'blur(18px)',
        WebkitBackdropFilter: nested ? 'blur(12px)' : 'blur(18px)',
        border: '1px solid var(--glass-border-1)',
        borderRadius: 16,
        boxShadow: nested
          ? '0 8px 32px rgba(0,0,0,0.28)'
          : '0 12px 40px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04)',
        pointerEvents: 'auto',
        ...style,
      }}
    >
      <div
        className="card-tile-scroll module-scroll"
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: nested ? '10px 12px' : '12px 14px',
        }}
      >
        {children}
      </div>
    </motion.div>
  )
}
