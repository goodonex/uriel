import { InlineEditableCard } from '../../components/InlineEditableCard'
import type { DiscoveryFoundationDoc } from '../../types/db'

interface MarketSectionProps {
  item: DiscoveryFoundationDoc | null
  loading: boolean
  error: string | null
  onSave: (patch: Partial<Omit<DiscoveryFoundationDoc, 'id' | 'brand_id'>>) => void
}

export function MarketSection({ item, loading, error, onSave }: MarketSectionProps) {
  if (loading) return <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Lade…</div>
  if (error) return <div style={{ fontSize: 13, color: 'var(--accent-coral)' }}>{error}</div>
  return (
    <InlineEditableCard
      label="Markt & Kontext"
      value={item?.market ?? ''}
      placeholder={
        'Zielgruppe, Standorte, Schmerz, Ziel, Zahlungsbereitschaft, Kauftrigger…'
      }
      onSave={(value) => onSave({ market: value })}
    />
  )
}
