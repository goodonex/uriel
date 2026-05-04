import { motion } from 'framer-motion'
import { Link, useParams } from 'react-router-dom'
import type { ModeKey } from '../types/db'

interface ModePlaceholderProps {
  mode: ModeKey
  title: string
  phase: string
  description: string
}

const MODE_VAR: Record<ModeKey, string> = {
  building: '--mode-building',
  promo: '--mode-promo',
  sales: '--mode-sales',
  intelligence: '--mode-intelligence',
  discovery: '--accent-coral',
  deliver: '--accent-teal',
}

export function ModePlaceholder({
  mode,
  title,
  phase,
  description,
}: ModePlaceholderProps) {
  const { slug } = useParams<{ slug: string }>()

  return (
    <div style={{ background: 'transparent' }}>
      <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="glass-2"
      style={{
        borderRadius: 16,
        padding: 32,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at top right, color-mix(in srgb, var(${MODE_VAR[mode]}) 14%, transparent), transparent 70%)`,
          opacity: 0.6,
        }}
      />
      <div className="relative">
        <div
          className="font-mono"
          style={{
            fontSize: 10,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: `var(${MODE_VAR[mode]})`,
            marginBottom: 12,
          }}
        >
          {phase}
        </div>
        <h2
          className="font-display"
          style={{
            fontSize: 26,
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: 10,
          }}
        >
          {title}
        </h2>
        <p
          style={{
            fontSize: 13,
            lineHeight: 1.6,
            color: 'var(--text-secondary)',
            maxWidth: 520,
          }}
        >
          {description}
        </p>
        <Link
          to={`/brand/${slug}`}
          className="mt-6 inline-block font-mono"
          style={{
            fontSize: 11,
            padding: '6px 14px',
            borderRadius: 999,
            background: 'var(--glass-3)',
            border: '1px solid var(--glass-border-2)',
            color: 'var(--text-secondary)',
          }}
        >
          ← Modus-Übersicht
        </Link>
      </div>
      </motion.section>
    </div>
  )
}
