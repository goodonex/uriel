import { motion } from 'framer-motion'
import { useNavigate, useParams } from 'react-router-dom'
import type { ModeKey } from '../types/db'

interface ModeDef {
  key: ModeKey
  name: string
  desc: string
  cssVar: string
  icon: React.ReactNode
}

const MODES: ModeDef[] = [
  {
    key: 'building',
    name: 'Building',
    desc: 'Foundation, Assets, SOPs. Was deine Brand ist und wie sie läuft.',
    cssVar: '--mode-building',
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="#4f7fff" strokeWidth="1.5">
        <rect x="2" y="2" width="12" height="12" rx="3" />
        <path d="M5 8h6M5 5.5h4M5 10.5h3" />
      </svg>
    ),
  },
  {
    key: 'promo',
    name: 'Promo',
    desc: 'Content, Kampagnen, Performance. Getagt und messbar von Tag 1.',
    cssVar: '--mode-promo',
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="#8b5cf6" strokeWidth="1.5">
        <path d="M3 12 L7 6 L10 9 L13 4" />
        <circle cx="13" cy="4" r="1.5" fill="#8b5cf6" stroke="none" />
      </svg>
    ),
  },
  {
    key: 'sales',
    name: 'Sales',
    desc: 'Leichtes CRM. Pipeline, Kontakte, Follow-ups — verbunden mit Promo.',
    cssVar: '--mode-sales',
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="#2dd4bf" strokeWidth="1.5">
        <circle cx="8" cy="6" r="3" />
        <path d="M3 14c0-2.76 2.24-5 5-5s5 2.24 5 5" />
      </svg>
    ),
  },
  {
    key: 'intelligence',
    name: 'Intelligence',
    desc: 'Lernschicht. Muster erkennen, Foundation optimieren, ICP anpassen.',
    cssVar: '--mode-intelligence',
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="#f59e0b" strokeWidth="1.5">
        <path d="M8 2 L10 6 L14 6.5 L11 9.5 L11.5 14 L8 12 L4.5 14 L5 9.5 L2 6.5 L6 6 Z" />
      </svg>
    ),
  },
]

export function ModeNav() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()

  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-4">
      {MODES.map((mode, idx) => (
        <motion.button
          key={mode.key}
          type="button"
          onClick={() => slug && navigate(`/brand/${slug}/${mode.key}`)}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: idx * 0.06,
            duration: 0.5,
            ease: [0.16, 1, 0.3, 1],
          }}
          whileHover={{ y: -1 }}
          className="group glass-2 relative overflow-hidden text-left"
          style={{
            borderRadius: 16,
            padding: '20px 18px',
          }}
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{
              background: `radial-gradient(ellipse at top left, color-mix(in srgb, var(${mode.cssVar}) 20%, transparent), transparent 70%)`,
            }}
          />
          <div
            className="mb-3.5 flex items-center justify-center"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: `color-mix(in srgb, var(${mode.cssVar}) 15%, transparent)`,
            }}
          >
            <span style={{ width: 16, height: 16 }}>{mode.icon}</span>
          </div>
          <div
            className="font-display"
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: 6,
            }}
          >
            {mode.name}
          </div>
          <div
            style={{
              fontSize: 11,
              lineHeight: 1.5,
              color: 'var(--text-secondary)',
            }}
          >
            {mode.desc}
          </div>
        </motion.button>
      ))}
    </div>
  )
}
