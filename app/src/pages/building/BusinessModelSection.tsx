import { InlineEditableCard } from '../../components/InlineEditableCard'
import type { FoundationField } from '../../lib/foundationAi'
import type { BusinessModelDoc } from '../../types/db'

interface BusinessModelSectionProps {
  item: BusinessModelDoc | null
  loading: boolean
  error: string | null
  onSave: (patch: Partial<Omit<BusinessModelDoc, 'id' | 'brand_id'>>) => void
}

type FieldKey = 'who' | 'what' | 'how' | 'for_whom' | 'revenue'
interface FieldDef {
  key: FieldKey
  label: string
  hint: string
  placeholder: string
  aiField: FoundationField
}

/** Linke Spalte: Subjekt-Achse — Wer bist du, für wen ist es. */
const LEFT_COLUMN: FieldDef[] = [
  {
    key: 'who',
    label: 'Wer',
    hint: 'Wer seid ihr / wer bist du?',
    placeholder: 'Setup, Team-Größe, Rolle im Markt …',
    aiField: 'business_model_who',
  },
  {
    key: 'for_whom',
    label: 'Für wen',
    hint: 'Zielgruppe · ICP-Beschreibung',
    placeholder: 'Für wen ist das gedacht?',
    aiField: 'business_model_for_whom',
  },
]

/** Rechte Spalte: Produkt-Achse — Was bietest du, wie lieferst du es. */
const RIGHT_COLUMN: FieldDef[] = [
  {
    key: 'what',
    label: 'Was',
    hint: 'Produkte · Pakete · Services',
    placeholder: 'Welche Angebote bietet ihr?',
    aiField: 'business_model_what',
  },
  {
    key: 'how',
    label: 'Wie',
    hint: 'Prozess · Delivery · Alleinstellung',
    placeholder: 'Wie arbeitet ihr — was macht ihr anders?',
    aiField: 'business_model_how',
  },
]

const REVENUE: FieldDef = {
  key: 'revenue',
  label: 'Womit',
  hint: 'Preise · Modelle · Margen · Akquise',
  placeholder: 'Womit verdient ihr — Pakete, Retainer, Akquise?',
  aiField: 'business_model_revenue',
}

export function BusinessModelSection({
  item,
  loading,
  error,
  onSave,
}: BusinessModelSectionProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="animate-pulse"
            style={{
              height: 110,
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
        Business Model konnte nicht geladen werden: {error}
      </div>
    )
  }

  const renderField = (f: FieldDef) => (
    <InlineEditableCard
      key={f.key}
      label={f.label}
      hint={f.hint}
      value={item?.[f.key] ?? ''}
      placeholder={f.placeholder}
      onSave={(v) => onSave({ [f.key]: v })}
      toast={`${f.label} gespeichert`}
      aiField={f.aiField}
    />
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="flex flex-col gap-3">{LEFT_COLUMN.map(renderField)}</div>
        <div className="flex flex-col gap-3">{RIGHT_COLUMN.map(renderField)}</div>
      </div>
      {renderField(REVENUE)}
    </div>
  )
}
