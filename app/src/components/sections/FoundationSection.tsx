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
import {
  SCROLL_PIPELINE_WIDTH,
  SCROLL_SIDE_CARD_WIDTH,
  SECTION_SHELL,
  SECTION_VIEWPORT,
} from './sectionLayout'

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

  const mainWidth = `min(${SCROLL_PIPELINE_WIDTH}, calc(100% - ${SCROLL_SIDE_CARD_WIDTH + 24}px))`

  return (
    <div data-scroll-section="foundation" style={SECTION_SHELL}>
      <div style={SECTION_VIEWPORT}>
        <CardTile
          flyFrom="left"
          delay={0}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: mainWidth,
            bottom: 0,
            maxHeight: '100%',
          }}
        >
          <BuildingMode layout="scroll" />
        </CardTile>

        <CardTile
          flyFrom="right"
          delay={0.1}
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: SCROLL_SIDE_CARD_WIDTH,
            maxHeight: 'calc(50% - 6px)',
          }}
        >
          <div
            className="font-mono"
            style={{
              fontSize: 10,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--text-tertiary)',
              marginBottom: 10,
            }}
          >
            Building Health
          </div>
          <BuildingHealthCard {...healthProps} variant="tile" />
        </CardTile>

        <CardTile
          flyFrom="right"
          delay={0.18}
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: SCROLL_SIDE_CARD_WIDTH,
            maxHeight: 'calc(50% - 6px)',
          }}
        >
          <div
            className="font-mono"
            style={{
              fontSize: 10,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--text-tertiary)',
              marginBottom: 10,
            }}
          >
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
  )
}
