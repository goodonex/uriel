import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useBrands } from '../../hooks/useBrands'
import { CardTile } from '../../modules/CardTile'
import { useAssets } from '../../hooks/useAssets'
import { useBusinessModel } from '../../hooks/useBusinessModel'
import { useICPs } from '../../hooks/useICPs'
import { usePositioning } from '../../hooks/usePositioning'
import { useWordBank } from '../../hooks/useWordBank'
import { BuildingMode } from '../../pages/building/BuildingMode'
import { BuildingHealthCard } from '../../pages/building/BuildingHealthCard'
import { ContextExportButton } from '../../pages/building/ContextExportButton'
import { BrandTemplatePicker } from '../BrandTemplatePicker'
import { SECTION_GRID, SECTION_SHELL } from './sectionLayout'

export function FoundationSection() {
  const { slug = '' } = useParams<{ slug: string }>()
  const icps = useICPs(slug)
  const wordBank = useWordBank(slug)
  const positioning = usePositioning(slug)
  const businessModel = useBusinessModel(slug)
  const assets = useAssets(slug)
  const { brands } = useBrands()
  const brand = useMemo(() => brands.find((b) => b.slug === slug) ?? null, [brands, slug])
  const [templateOpen, setTemplateOpen] = useState(false)

  const healthProps = useMemo(
    () => ({
      slug,
      positioning: positioning.item,
      icps: icps.items,
      wordBank: wordBank.items,
      businessModel: businessModel.item,
      assets: assets.items,
    }),
    [slug, positioning.item, icps.items, wordBank.items, businessModel.item, assets.items],
  )

  return (
    <div data-scroll-section="foundation" style={SECTION_SHELL}>
      <div style={SECTION_GRID}>
        <div style={{ gridColumn: '1', gridRow: '1 / span 2', minHeight: 0 }}>
          <CardTile flyFrom="left" delay={0} style={{ height: '100%', maxHeight: 'calc(100vh - 56px)' }}>
            <BuildingMode />
          </CardTile>
        </div>
        <div style={{ gridColumn: '2', gridRow: '1' }}>
          <CardTile flyFrom="right" delay={0.1} style={{ height: '100%' }}>
            <BuildingHealthCard {...healthProps} />
          </CardTile>
        </div>
        <div style={{ gridColumn: '2', gridRow: '2' }}>
          <CardTile flyFrom="right" delay={0.18} style={{ height: '100%' }}>
            <div className="font-mono" style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 10 }}>
              Quick Actions
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              <ContextExportButton
                brand={brand}
                positioning={positioning.item}
                icps={icps.items}
                wordBank={wordBank.items}
              />
              <button
                type="button"
                className="font-mono"
                onClick={() => setTemplateOpen(true)}
                style={{
                  borderRadius: 10,
                  border: '1px solid var(--glass-border-2)',
                  background: 'var(--glass-1)',
                  padding: '8px 10px',
                  fontSize: 10,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                Template wählen
              </button>
            </div>
            <BrandTemplatePicker slug={slug} open={templateOpen} onClose={() => setTemplateOpen(false)} />
          </CardTile>
        </div>
      </div>
    </div>
  )
}
