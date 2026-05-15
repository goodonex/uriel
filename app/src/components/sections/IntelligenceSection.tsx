import { CardTile } from '../../modules/CardTile'
import { IntelligenceMorningBriefModule } from '../../modules/intelligence/IntelligenceMorningBriefModule'
import { IntelligencePipelineForecastModule } from '../../modules/intelligence/IntelligencePipelineForecastModule'
import { IntelligenceWinLossModule } from '../../modules/intelligence/IntelligenceWinLossModule'
import { SECTION_SHELL, SECTION_VIEWPORT } from './sectionLayout'

export function IntelligenceSection() {
  return (
    <div data-scroll-section="intelligence" style={SECTION_SHELL}>
      <div style={SECTION_VIEWPORT}>
        <CardTile
          flyFrom="top"
          delay={0}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 'calc(52% - 7px)',
          }}
        >
          <IntelligenceMorningBriefModule />
        </CardTile>

        <CardTile
          flyFrom="left"
          delay={0.1}
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: 'calc(50% - 7px)',
            height: 'calc(48% - 7px)',
          }}
        >
          <IntelligencePipelineForecastModule />
        </CardTile>

        <CardTile
          flyFrom="right"
          delay={0.12}
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: 'calc(50% - 7px)',
            height: 'calc(48% - 7px)',
          }}
        >
          <IntelligenceWinLossModule />
        </CardTile>
      </div>
    </div>
  )
}
