import { useParams } from 'react-router-dom'
import { SectionLabel } from '../../components/SectionLabel'
import { IntelligenceReports } from '../../pages/intelligence/IntelligenceReports'

export function IntelligencePipelineForecastModule() {
  const { slug } = useParams<{ slug: string }>()
  if (!slug) return null
  return (
    <>
      <SectionLabel accent="var(--mode-intelligence)" tight>
        Live-Reports
      </SectionLabel>
      <IntelligenceReports slug={slug} />
    </>
  )
}
