import { useParams } from 'react-router-dom'
import { IntelligenceFocusTasksBlock } from '../../pages/intelligence/IntelligenceFocusTasksBlock'

export function IntelligenceWinLossModule() {
  const { slug } = useParams<{ slug: string }>()
  if (!slug) return null
  return <IntelligenceFocusTasksBlock slug={slug} />
}
