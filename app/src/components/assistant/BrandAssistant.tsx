import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useBrands } from '../../hooks/useBrands'
import { useBrandAssistant } from '../../hooks/useBrandAssistant'
import { BrandAssistantPanel } from './BrandAssistantPanel'

export function BrandAssistant() {
  const { slug = '' } = useParams<{ slug: string }>()
  const { brands } = useBrands()
  const brand = brands.find((b) => b.slug === slug)
  const assistant = useBrandAssistant(slug)
  const [open, setOpen] = useState(false)

  if (!slug || !brand) return null

  const accent = brand.color || 'var(--accent-teal)'

  return (
    <>
      <AnimatePresence>
        {open ? (
          <BrandAssistantPanel
            brandName={brand.name}
            brandAccent={accent}
            assistant={assistant}
            onMinimize={() => setOpen(false)}
          />
        ) : null}
      </AnimatePresence>

      {!open ? (
        <motion.button
          type="button"
          aria-label="Brand-Assistent öffnen"
          onClick={() => setOpen(true)}
          animate={{
            boxShadow: [
              `0 0 0 0 color-mix(in srgb, ${accent} 0%, transparent)`,
              `0 0 0 10px color-mix(in srgb, ${accent} 18%, transparent)`,
              `0 0 0 0 color-mix(in srgb, ${accent} 0%, transparent)`,
            ],
          }}
          transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 8999,
            width: 56,
            height: 56,
            borderRadius: '50%',
            border: `1px solid color-mix(in srgb, ${accent} 55%, var(--glass-border-2))`,
            background: `color-mix(in srgb, ${accent} 35%, var(--bg-surface))`,
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            color: '#0a0a12',
            fontSize: 22,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'grid',
            placeItems: 'center',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          ✦
        </motion.button>
      ) : null}
    </>
  )
}
