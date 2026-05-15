import { PromoCalendarModule } from '../../modules/promo/PromoCalendarModule'
import { PromoCampaignsModule } from '../../modules/promo/PromoCampaignsModule'
import { PromoPiecesModule } from '../../modules/promo/PromoPiecesModule'
import { CardTile } from '../../modules/CardTile'
import { SECTION_GRID, SECTION_SHELL } from './sectionLayout'

export function PromoSection() {
  return (
    <div data-scroll-section="promo" style={SECTION_SHELL}>
      <div style={SECTION_GRID}>
        <div style={{ gridColumn: '1', gridRow: '1 / span 2', minHeight: 0 }}>
          <CardTile flyFrom="left" delay={0} style={{ height: '100%', maxHeight: 'calc(100vh - 56px)' }}>
            <PromoCalendarModule />
          </CardTile>
        </div>
        <div style={{ gridColumn: '2', gridRow: '1' }}>
          <CardTile flyFrom="right" delay={0.1} style={{ height: '100%' }}>
            <PromoPiecesModule />
          </CardTile>
        </div>
        <div style={{ gridColumn: '2', gridRow: '2' }}>
          <CardTile flyFrom="right" delay={0.18} style={{ height: '100%' }}>
            <PromoCampaignsModule />
          </CardTile>
        </div>
      </div>
    </div>
  )
}
