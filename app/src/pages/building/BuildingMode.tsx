import { motion } from 'framer-motion'
import { useParams } from 'react-router-dom'
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

  return (
    <motion.div
      key={slug}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
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
