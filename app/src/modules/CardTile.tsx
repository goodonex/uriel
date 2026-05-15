import { motion, useInView } from 'framer-motion'
import { useRef, type CSSProperties, type ReactNode } from 'react'

export interface CardTileProps {
  children: ReactNode
  flyFrom?: 'left' | 'right' | 'bottom' | 'top'
  delay?: number
  width?: string | number
  style?: CSSProperties
  className?: string
}

const FLY = {
  left: { opacity: 0, x: -48 },
  right: { opacity: 0, x: 48 },
  bottom: { opacity: 0, y: 32 },
  top: { opacity: 0, y: -32 },
} as const

export function CardTile({
  children,
  flyFrom = 'left',
  delay = 0,
  width,
  style,
  className,
}: CardTileProps) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { amount: 0.3, once: false })

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={FLY[flyFrom]}
      animate={inView ? { opacity: 1, x: 0, y: 0 } : FLY[flyFrom]}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay }}
      style={{
        width,
        minWidth: 0,
        minHeight: 0,
        maxHeight: '100%',
        overflowY: 'auto',
        overflowX: 'hidden',
        background: 'rgba(8, 8, 16, 0.55)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid var(--glass-border-1)',
        borderRadius: 16,
        pointerEvents: 'auto',
        ...style,
      }}
    >
      {children}
    </motion.div>
  )
}
