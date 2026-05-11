import { motion } from 'framer-motion'
import { useParams } from 'react-router-dom'
import { ModeContextStrip } from '../../components/ModeContextStrip'
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
import { useBrandId } from '../../hooks/useBrandId'
import { useToast } from '../../components/Toast'

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
  const brandId = useBrandId(slug)
  const { show } = useToast()

  const onboardingUrl =
    typeof window !== 'undefined' && brandId
      ? `${window.location.origin}/onboarding/${brandId}`
      : ''

  return (
    <motion.div
      key={slug}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      style={{ background: 'transparent' }}
    >
      {slug ? <ModeContextStrip slug={slug} /> : null}
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
          <ContextExportButton
            brand={brand}
            positioning={positioning.item}
            icps={icps.items}
            wordBank={wordBank.items}
          />
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

      {brandId ? (
        <div
          className="glass-2 mb-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3"
          style={{
            border: '1px solid var(--glass-border-1)',
            backdropFilter: 'var(--blur-sm)',
            WebkitBackdropFilter: 'var(--blur-sm)',
          }}
        >
          <div className="min-w-0 flex-1">
            <div className="font-mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
              Kunden-Fragebogen
            </div>
            <div className="mt-1 font-mono truncate" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              {onboardingUrl}
            </div>
            <p className="mt-2" style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
              Schick diesen Link an deinen Kunden. Die Antworten landen direkt in der Foundation
              (Positioning &amp; ICPs).
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="font-mono"
              onClick={() => {
                if (!onboardingUrl || !navigator.clipboard) {
                  show('Link konnte nicht kopiert werden.', 'error')
                  return
                }
                void navigator.clipboard.writeText(onboardingUrl).then(
                  () => show('Fragebogen-Link kopiert.', 'success'),
                  () => show('Kopieren fehlgeschlagen.', 'error'),
                )
              }}
              style={{
                fontSize: 11,
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px solid var(--accent-teal)',
                background: 'color-mix(in srgb, var(--accent-teal) 12%, transparent)',
                color: 'var(--accent-teal)',
              }}
            >
              Link kopieren
            </button>
          </div>
        </div>
      ) : null}

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

      <SectionLabel>Word Bank — Ja / Nein</SectionLabel>
      <WordBankSection
        items={wordBank.items}
        loading={wordBank.loading}
        error={wordBank.error}
        onCreate={wordBank.create}
        onRemove={wordBank.remove}
      />

      <SectionLabel>Positioning &amp; Tone</SectionLabel>
      <PositioningSection
        item={positioning.item}
        loading={positioning.loading}
        error={positioning.error}
        onSave={positioning.save}
      />

      <SectionLabel>Business Model</SectionLabel>
      <BusinessModelSection
        item={businessModel.item}
        loading={businessModel.loading}
        error={businessModel.error}
        onSave={businessModel.save}
      />

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
    </motion.div>
  )
}
