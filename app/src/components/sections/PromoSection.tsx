import {
  PromoCalendarSplit,
  PromoCampaignsSplit,
  PromoPiecesSplit,
} from '../../pages/promo/PromoSplitViews'
import { CardTile } from '../../modules/CardTile'
import {
  SCROLL_PIPELINE_WIDTH,
  SCROLL_SIDE_CARD_WIDTH,
  SECTION_SHELL,
  SECTION_VIEWPORT,
} from './sectionLayout'

export function PromoSection() {
  const mainWidth = `min(${SCROLL_PIPELINE_WIDTH}, calc(100% - ${SCROLL_SIDE_CARD_WIDTH + 24}px))`

  return (
    <div data-scroll-section="promo" style={SECTION_SHELL}>
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
          }}
        >
          <PromoCalendarSplit scrollTile />
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
          <PromoPiecesSplit compact />
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
          <PromoCampaignsSplit compact />
        </CardTile>
      </div>
    </div>
  )
}
