import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  accent?: string
  compact?: boolean
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  accent = 'var(--text-accent)',
  compact,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-2xl text-center"
      style={{
        background: 'var(--glass-1)',
        border: '1px dashed var(--glass-border-2)',
        padding: compact ? '24px 18px' : '40px 28px',
      }}
    >
      {icon ? (
        <div
          className="mx-auto mb-3 flex items-center justify-center"
          style={{
            width: compact ? 36 : 44,
            height: compact ? 36 : 44,
            borderRadius: 999,
            background: `color-mix(in srgb, ${accent} 14%, transparent)`,
            color: accent,
            fontSize: compact ? 16 : 20,
          }}
        >
          {icon}
        </div>
      ) : null}
      <div
        className="font-display"
        style={{
          fontSize: compact ? 14 : 16,
          fontWeight: 600,
          color: 'var(--text-primary)',
        }}
      >
        {title}
      </div>
      {description ? (
        <div
          className="font-body mx-auto mt-1.5"
          style={{
            fontSize: compact ? 12 : 13,
            color: 'var(--text-tertiary)',
            maxWidth: 360,
            lineHeight: 1.5,
          }}
        >
          {description}
        </div>
      ) : null}
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="font-mono mt-4"
          style={{
            fontSize: 11,
            letterSpacing: '0.04em',
            padding: '9px 16px',
            borderRadius: 10,
            border: `1px solid ${accent}`,
            background: `color-mix(in srgb, ${accent} 14%, transparent)`,
            color: accent,
            cursor: 'pointer',
          }}
        >
          {actionLabel}
        </button>
      ) : null}
    </motion.div>
  )
}

interface SkeletonProps {
  height?: number
  width?: string | number
  rounded?: number
  className?: string
}

export function Skeleton({
  height = 14,
  width = '100%',
  rounded = 6,
  className,
}: SkeletonProps) {
  return (
    <div
      className={`animate-pulse ${className ?? ''}`}
      style={{
        width,
        height,
        borderRadius: rounded,
        background: 'var(--glass-2)',
        border: '1px solid var(--glass-border-1)',
      }}
    />
  )
}

interface SkeletonCardProps {
  height?: number
}

export function SkeletonCard({ height = 110 }: SkeletonCardProps) {
  return (
    <div
      className="animate-pulse"
      style={{
        height,
        borderRadius: 16,
        background: 'var(--glass-1)',
        border: '1px solid var(--glass-border-1)',
      }}
    />
  )
}
