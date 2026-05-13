import { useParams } from 'react-router-dom'
import { MorningBriefSection } from '../../pages/intelligence/MorningBriefSection'

export function IntelligenceMorningBriefModule() {
  const { slug } = useParams<{ slug: string }>()
  if (!slug) return null
  return <MorningBriefSection slug={slug} />
}
