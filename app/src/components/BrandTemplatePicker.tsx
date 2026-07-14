import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { useBusinessModel } from '../hooks/useBusinessModel'
import { useICPs } from '../hooks/useICPs'
import { usePositioning } from '../hooks/usePositioning'
import { useWordBank } from '../hooks/useWordBank'
import { BRAND_TEMPLATES, type BrandTemplate } from '../lib/brandTemplates'
import { useToast } from './Toast'

interface BrandTemplatePickerProps {
  slug: string
  open: boolean
  onClose: () => void
}

export function BrandTemplatePicker({ slug, open, onClose }: BrandTemplatePickerProps) {
  const icps = useICPs(slug)
  const wordBank = useWordBank(slug)
  const positioning = usePositioning(slug)
  const businessModel = useBusinessModel(slug)
  const { show } = useToast()
  const [applying, setApplying] = useState<string | null>(null)

  const applyTemplate = async (template: BrandTemplate) => {
    setApplying(template.id)
    try {
      for (const icp of template.icps) {
        icps.create({
          name: icp.name,
          age_range: icp.age_range,
          location: icp.location,
          pain_points: icp.pain_points,
          priority: icp.priority,
          notes: icp.notes,
          word_clusters: [],
        })
      }

      const existingWords = new Set(
        wordBank.items.map((w) => `${w.word.toLowerCase()}|${w.type}`),
      )
      for (const w of template.word_bank) {
        const key = `${w.word.toLowerCase()}|${w.type}`
        if (existingWords.has(key)) continue
        wordBank.create({ word: w.word, type: w.type, cluster: w.cluster })
      }

      const hasPositioning =
        positioning.item?.statement?.trim() || positioning.item?.tone_of_voice?.trim()
      if (!hasPositioning) {
        positioning.save(template.positioning)
      }

      const bm = businessModel.item
      const bmEmpty =
        !bm ||
        (!bm.who?.trim() &&
          !bm.what?.trim() &&
          !bm.how?.trim() &&
          !bm.for_whom?.trim() &&
          !bm.revenue?.trim())
      if (bmEmpty) {
        businessModel.save(template.business_model)
      }

      show(`Template „${template.name}" angewendet`, 'success')
      onClose()
    } catch (err) {
      show(`Fehler: ${(err as Error).message}`, 'error')
    } finally {
      setApplying(null)
    }
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !applying) onClose()
          }}
          className="fixed inset-0 z-[70] flex items-center justify-center"
          style={{
            background: 'var(--overlay-backdrop)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            padding: 24,
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.99 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="font-body flex w-full max-w-2xl flex-col"
            style={{
              maxHeight: '80vh',
              borderRadius: 18,
              background: 'color-mix(in srgb, var(--bg-base) 96%, transparent)',
              border: '1px solid var(--glass-border-2)',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <div
              className="flex items-baseline justify-between"
              style={{
                padding: '18px 22px',
                borderBottom: '1px solid var(--glass-border-1)',
              }}
            >
              <div>
                <div
                  className="font-mono"
                  style={{
                    fontSize: 9,
                    letterSpacing: '0.14em',
                    color: 'var(--text-tertiary)',
                  }}
                >
                  BRAND-TEMPLATE
                </div>
                <h3
                  className="font-display"
                  style={{ fontSize: 18, fontWeight: 600, marginTop: 4 }}
                >
                  Foundation aus Vorlage
                </h3>
              </div>
              <button
                type="button"
                onClick={() => !applying && onClose()}
                className="font-mono"
                style={{
                  fontSize: 11,
                  padding: '6px 10px',
                  borderRadius: 7,
                  border: '1px solid var(--glass-border-2)',
                  background: 'transparent',
                  color: 'var(--text-tertiary)',
                  cursor: applying ? 'wait' : 'pointer',
                }}
              >
                ×
              </button>
            </div>

            <div
              className="font-body min-h-0 flex-1 overflow-y-auto"
              style={{ padding: 18, fontSize: 13 }}
            >
              <p
                className="mb-4"
                style={{ color: 'var(--text-secondary)', lineHeight: 1.55 }}
              >
                Die Vorlage füllt Positioning, Business Model und ICPs nur dort, wo noch
                nichts steht. Word-Bank-Einträge werden additiv ergänzt. Du kannst alles
                anschließend frei überschreiben.
              </p>

              <div className="space-y-3">
                {BRAND_TEMPLATES.map((tpl) => {
                  const isApplying = applying === tpl.id
                  return (
                    <div
                      key={tpl.id}
                      className="rounded-xl"
                      style={{
                        border: '1px solid var(--glass-border-1)',
                        background: 'var(--glass-1)',
                        padding: 16,
                      }}
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <div>
                          <div
                            className="font-mono"
                            style={{
                              fontSize: 9,
                              letterSpacing: '0.12em',
                              color: 'var(--mode-building)',
                            }}
                          >
                            {tpl.industry.toUpperCase()}
                          </div>
                          <h4
                            className="font-display mt-1"
                            style={{ fontSize: 16, fontWeight: 600 }}
                          >
                            {tpl.name}
                          </h4>
                        </div>
                        <button
                          type="button"
                          onClick={() => void applyTemplate(tpl)}
                          disabled={!!applying}
                          className="font-mono"
                          style={{
                            fontSize: 11,
                            padding: '8px 14px',
                            borderRadius: 9,
                            border: '1px solid var(--mode-building)',
                            background:
                              'color-mix(in srgb, var(--mode-building) 14%, transparent)',
                            color: 'var(--mode-building)',
                            cursor: applying ? 'wait' : 'pointer',
                            opacity: applying && !isApplying ? 0.4 : 1,
                          }}
                        >
                          {isApplying ? 'Wird angewendet …' : 'Anwenden'}
                        </button>
                      </div>
                      <p
                        className="mt-2"
                        style={{
                          fontSize: 12,
                          color: 'var(--text-secondary)',
                          lineHeight: 1.5,
                        }}
                      >
                        {tpl.description}
                      </p>
                      <div
                        className="font-mono mt-3 flex flex-wrap gap-1.5"
                        style={{
                          fontSize: 9,
                          color: 'var(--text-tertiary)',
                          letterSpacing: '0.04em',
                        }}
                      >
                        <span style={chipStyle}>{tpl.icps.length} ICPs</span>
                        <span style={chipStyle}>{tpl.word_bank.length} Wörter</span>
                        <span style={chipStyle}>Positioning + Tone</span>
                        <span style={chipStyle}>Business Model</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

const chipStyle: React.CSSProperties = {
  padding: '3px 8px',
  borderRadius: 999,
  background: 'var(--glass-2)',
  border: '1px solid var(--glass-border-1)',
}
