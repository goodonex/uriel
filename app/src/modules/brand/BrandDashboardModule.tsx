import { useParams } from 'react-router-dom'
import { BrandSystemDashboard } from '../../components/BrandSystemDashboard'

export function BrandDashboardModule() {
  const { slug = '' } = useParams<{ slug: string }>()
  return <BrandSystemDashboard slug={slug} embedded />
}
