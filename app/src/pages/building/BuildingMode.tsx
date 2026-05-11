import { motion } from 'framer-motion'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { BrandTemplatePicker } from '../../components/BrandTemplatePicker'
import { SectionLabel } from '../../components/SectionLabel'
import { useBusinessModel } from '../../hooks/useBusinessModel'
import { useAssets } from '../../hooks/useAssets'
import { useBrands } from '../../hooks/useBrands'
import { useICPs } from '../../hooks/useICPs'
import { usePositioning } from '../../hooks/usePositioning'
import { useSOPs } from '../../hooks/useSOPs'
import { useWordBank } from '../../hooks/useWordBank'
import { AssetsSection } from './AssetsSection'
import { BusinessModelSection } from './BusinessModelSection'
import { ContextExportButton } from './ContextExportButton'
import { ICPSection } from './ICPSection'
import { PositioningSection } from './PositioningSection'
import { SOPSection } from './SOPSection'
import { WordBankSection } from './WordBankSection'
import { BuildingHealthCard } from './BuildingHealthCard'
import { BrandFoundationProvider } from '../../lib/brandFoundationContext'

export function BuildingMode() {
  const { slug } = useParams<{ slug: string }>()
  const { brands } = useBrands()
  const brand = brands.find((b) => b.slug === slug) ?? null

  const icps = useICPs(slug)
  const wordBank = useWordBank(slug)
  const positioning = usePositioning(slug)
  const businessModel = useBusinessModel(slug)
  const assets = useAssets(slug)
  const sops = useSOPs(slug)
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false)

  return (
    <BrandFoundationProvider
      brandName={brand?.name ?? slug ?? ''}
      positioning={positioning.item}
      icps={icps.items}
      wordBank={wordBank.items}
      businessModel={businessModel.item}
    >
    <motion.div
      key={slug}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      style={{ background: 'transparent' }}
    >
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
          <div>
            <div
              className="font-mono"
              style={{
                fontSize: 10,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--mode-building)',
                marginBottom: 6,
              }}
            >
              Building Mode
            </div>
            <h2
              className="font-display"
              style={{
                fontSize: 22,
                fontWeight: 600,
                color: 'var(--text-primary)',
                letterSpacing: '-0.3px',
              }}
            >
              Foundation
            </h2>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setTemplatePickerOpen(true)}
              className="font-mono inline-flex items-center gap-1.5 rounded-lg"
              style={{
                fontSize: 11,
                letterSpacing: '0.04em',
                padding: '7px 12px',
                border: '1px solid var(--mode-building)',
                background: 'color-mix(in srgb, var(--mode-building) 14%, transparent)',
                color: 'var(--mode-building)',
                cursor: 'pointer',
              }}
            >
              <svg width={12} height={12} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path d="M3 4 L13 4 L13 13 L3 13 Z" />
                <path d="M3 7 L13 7" />
                <path d="M6 4 L6 7 M10 4 L10 7" />
              </svg>
              Template
            </button>
            <ContextExportButton
              brand={brand}
              positioning={positioning.item}
              icps={icps.items}
              wordBank={wordBank.items}
            />
          </div>
        </div>
        {slug ? (
          <BuildingHealthCard
            slug={slug}
            positioning={positioning.item}
            icps={icps.items}
            wordBank={wordBank.items}
            businessModel={businessModel.item}
            assets={assets.items}
          />
        ) : null}
      </div>

      <SectionLabel>Business Model — Wer · Was · Wie · Für wen · Womit</SectionLabel>
      <BusinessModelSection
        item={businessModel.item}
        loading={businessModel.loading}
        error={businessModel.error}
        onSave={businessModel.save}
      />

      <SectionLabel>ICPs — Zielgruppen</SectionLabel>
      <ICPSection
        icps={icps.items}
        wordBank={wordBank.items}
        loading={icps.loading}
        error={icps.error}
        onCreate={() => icps.create()}
        onUpdate={icps.update}
        onDelete={icps.remove}
      />

      <SectionLabel>Positioning &amp; Tone</SectionLabel>
      <PositioningSection
        item={positioning.item}
        loading={positioning.loading}
        error={positioning.error}
        onSave={positioning.save}
      />

      <SectionLabel>Word Bank — Ja / Nein</SectionLabel>
      <WordBankSection
        items={wordBank.items}
        loading={wordBank.loading}
        error={wordBank.error}
        onCreate={wordBank.create}
        onRemove={wordBank.remove}
      />

      <div
        style={{
          marginTop: 36,
          paddingTop: 22,
          borderTop: '1px dashed var(--glass-border-2)',
        }}
      >
        <div
          className="font-mono mb-4 flex items-center gap-3"
          style={{
            fontSize: 10,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--text-tertiary)',
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              background: 'var(--mode-building)',
              boxShadow: '0 0 8px var(--mode-building)',
            }}
          />
          Library — Assets &amp; Prozesse
        </div>

        <SectionLabel>Assets</SectionLabel>
        <AssetsSection
          items={assets.items}
          loading={assets.loading}
          error={assets.error}
          onCreate={() => assets.create()}
          onUpdate={assets.update}
          onRemove={assets.remove}
        />

        <SectionLabel>SOPs — Prozesse &amp; Vorlagen</SectionLabel>
        <SOPSection
          items={sops.items}
          loading={sops.loading}
          error={sops.error}
          onCreate={() => sops.create()}
          onUpdate={sops.update}
          onDelete={sops.remove}
        />
      </div>

      {slug ? (
        <BrandTemplatePicker
          slug={slug}
          open={templatePickerOpen}
          onClose={() => setTemplatePickerOpen(false)}
        />
      ) : null}
    </motion.div>
    </BrandFoundationProvider>
  )
}
