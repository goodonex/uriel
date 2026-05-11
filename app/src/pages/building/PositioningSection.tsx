import { InlineEditableCard } from '../../components/InlineEditableCard'
import type { Positioning } from '../../types/db'

interface PositioningSectionProps {
  item: Positioning | null
  loading: boolean
  error: string | null
  onSave: (patch: Partial<Omit<Positioning, 'id' | 'brand_id'>>) => void
}

const STATEMENT_TARGET = 280

export function PositioningSection({
  item,
  loading,
  error,
  onSave,
}: PositioningSectionProps) {
  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="animate-pulse"
            style={{
              height: 120,
              borderRadius: 16,
              background: 'var(--glass-1)',
              border: '1px solid var(--glass-border-1)',
            }}
          />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div
        className="font-mono"
        style={{ fontSize: 12, color: 'var(--accent-coral)' }}
      >
        Positioning konnte nicht geladen werden: {error}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <InlineEditableCard
        label="Positioning Statement"
        hint="Für wen · Was · Wie anders"
        value={item?.statement ?? ''}
        onSave={(v) => onSave({ statement: v })}
        placeholder="In einem Satz: Für wen, was bietest du, wie anders."
        maxLength={STATEMENT_TARGET}
        toast="Positioning Statement gespeichert"
        aiField="positioning_statement"
      />
      <InlineEditableCard
        label="Tone of Voice"
        hint="Wie klingt eure Sprache?"
        value={item?.tone_of_voice ?? ''}
        onSave={(v) => onSave({ tone_of_voice: v })}
        placeholder="Warm, direkt, bewusst — nie überheblich."
        toast="Tone of Voice gespeichert"
        aiField="tone_of_voice"
      />
    </div>
  )
}
