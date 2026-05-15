import { CardTile } from '../../modules/CardTile'
import { IntelligenceMorningBriefModule } from '../../modules/intelligence/IntelligenceMorningBriefModule'
import { IntelligencePipelineForecastModule } from '../../modules/intelligence/IntelligencePipelineForecastModule'
import { IntelligenceWinLossModule } from '../../modules/intelligence/IntelligenceWinLossModule'
import { SECTION_SHELL } from './sectionLayout'

export function IntelligenceSection() {
  return (
    <div data-scroll-section="intelligence" style={SECTION_SHELL}>
      <div
        style={{
          display: 'grid',
          gridTemplateRows: 'minmax(0, 1.1fr) minmax(0, 1fr)',
          gap: 14,
          height: 'calc(100vh - 48px)',
          maxHeight: 'calc(100vh - 48px)',
          pointerEvents: 'none',
        }}
      >
        <CardTile flyFrom="top" delay={0} style={{ minHeight: 0 }}>
          <IntelligenceMorningBriefModule />
        </CardTile>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 14,
            minHeight: 0,
            pointerEvents: 'none',
          }}
        >
          <CardTile flyFrom="left" delay={0.1} style={{ height: '100%' }}>
            <IntelligencePipelineForecastModule />
          </CardTile>
          <CardTile flyFrom="right" delay={0.12} style={{ height: '100%' }}>
            <IntelligenceWinLossModule />
          </CardTile>
        </div>
      </div>
    </div>
  )
}
