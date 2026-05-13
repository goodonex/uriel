import { InlineEditableCard } from '../../components/InlineEditableCard'
import type { DiscoveryFoundationDoc } from '../../types/db'

interface CompetitorsSectionProps {
  item: DiscoveryFoundationDoc | null
  loading: boolean
  error: string | null
  onSave: (patch: Partial<Omit<DiscoveryFoundationDoc, 'id' | 'brand_id'>>) => void
}

export function CompetitorsSection({
  item,
  loading,
  error,
  onSave,
}: CompetitorsSectionProps) {
  if (loading) return <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Lade…</div>
  if (error) return <div style={{ fontSize: 13, color: 'var(--accent-coral)' }}>{error}</div>
  return (
    <InlineEditableCard
      label="Wettbewerber"
      value={item?.competitors ?? ''}
      placeholder={'Wettbewerber, Angebote, Positionierung, Messaging, Lücken…'}
      onSave={(value) => onSave({ competitors: value })}
    />
  )
}
