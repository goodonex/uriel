import { InlineEditableCard } from '../../components/InlineEditableCard'
import type { DiscoveryFoundationDoc } from '../../types/db'

interface NicheSectionProps {
  item: DiscoveryFoundationDoc | null
  loading: boolean
  error: string | null
  onSave: (patch: Partial<Omit<DiscoveryFoundationDoc, 'id' | 'brand_id'>>) => void
}

export function NicheSection({ item, loading, error, onSave }: NicheSectionProps) {
  if (loading) return <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>Lade…</div>
  if (error) return <div style={{ fontSize: 13, color: 'var(--accent-coral)' }}>{error}</div>
  return (
    <InlineEditableCard
      label="Nische & Schwerpunkt"
      value={item?.niche ?? ''}
      placeholder={'Kernfokus, Abgrenzung, strategischer Schwerpunkt…'}
      onSave={(value) => onSave({ niche: value })}
    />
  )
}
