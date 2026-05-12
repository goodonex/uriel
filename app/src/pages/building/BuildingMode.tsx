import { motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { BrandTemplatePicker } from '../../components/BrandTemplatePicker'
import { CollapsibleSection } from '../../components/CollapsibleSection'
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

  const bm = businessModel.item
  const bmStatus: 'empty' | 'partial' | 'done' = useMemo(() => {
    if (!bm) return 'empty'
    const filled = [bm.who, bm.what, bm.how, bm.for_whom, bm.revenue].filter(
      (s) => (s ?? '').trim().length > 0,
    ).length
    if (filled === 0) return 'empty'
    if (filled < 5) return 'partial'
    return 'done'
  }, [bm])
  const positioningStatus: 'empty' | 'partial' | 'done' = useMemo(() => {
    const s = positioning.item?.statement?.trim()
    const t = positioning.item?.tone_of_voice?.trim()
    if (!s && !t) return 'empty'
    if (s && t) return 'done'
    return 'partial'
  }, [positioning.item])
  const icpStatus: 'empty' | 'partial' | 'done' =
    icps.items.length === 0 ? 'empty' : icps.items.length < 2 ? 'partial' : 'done'
  const wbStatus: 'empty' | 'partial' | 'done' =
    wordBank.items.length === 0
      ? 'empty'
      : wordBank.items.length < 4
        ? 'partial'
        : 'done'
  const firstEmptyKey = useMemo(() => {
    if (bmStatus !== 'done') return 'bm'
    if (icpStatus !== 'done') return 'icp'
    if (positioningStatus !== 'done') return 'pos'
    if (wbStatus !== 'done') return 'wb'
    return null
  }, [bmStatus, icpStatus, positioningStatus, wbStatus])

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

      <CollapsibleSection
        title="Business Model — Wer · Was · Wie · Für wen · Womit"
        status={bmStatus}
        defaultOpen={firstEmptyKey === 'bm'}
      >
        <BusinessModelSection
          item={businessModel.item}
          loading={businessModel.loading}
          error={businessModel.error}
          onSave={businessModel.save}
        />
      </CollapsibleSection>

      <CollapsibleSection
        title="ICPs — Zielgruppen"
        meta={icps.items.length > 0 ? `${icps.items.length} angelegt` : undefined}
        status={icpStatus}
        defaultOpen={firstEmptyKey === 'icp'}
      >
        <ICPSection
          icps={icps.items}
          wordBank={wordBank.items}
          loading={icps.loading}
          error={icps.error}
          onCreate={() => icps.create()}
          onUpdate={icps.update}
          onDelete={icps.remove}
        />
      </CollapsibleSection>

      <CollapsibleSection
        title="Positioning & Tone"
        status={positioningStatus}
        defaultOpen={firstEmptyKey === 'pos'}
      >
        <PositioningSection
          item={positioning.item}
          loading={positioning.loading}
          error={positioning.error}
          onSave={positioning.save}
        />
      </CollapsibleSection>

      <CollapsibleSection
        title="Word Bank — Ja / Nein"
        meta={wordBank.items.length > 0 ? `${wordBank.items.length} Wörter` : undefined}
        status={wbStatus}
        defaultOpen={firstEmptyKey === 'wb'}
      >
        <WordBankSection
          items={wordBank.items}
          loading={wordBank.loading}
          error={wordBank.error}
          onCreate={wordBank.create}
          onRemove={wordBank.remove}
        />
      </CollapsibleSection>

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

        <CollapsibleSection
          title="Assets"
          meta={assets.items.length > 0 ? `${assets.items.length}` : undefined}
          defaultOpen={false}
        >
          <AssetsSection
            items={assets.items}
            loading={assets.loading}
            error={assets.error}
            onCreate={() => assets.create()}
            onUpdate={assets.update}
            onRemove={assets.remove}
          />
        </CollapsibleSection>

        <CollapsibleSection
          title="SOPs — Prozesse & Vorlagen"
          meta={sops.items.length > 0 ? `${sops.items.length}` : undefined}
          defaultOpen={false}
        >
          <SOPSection
            items={sops.items}
            loading={sops.loading}
            error={sops.error}
            onCreate={() => sops.create()}
            onUpdate={sops.update}
            onDelete={sops.remove}
          />
        </CollapsibleSection>
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
