import { useEffect, useState } from 'react'
import { useDebouncedCallback } from '../../hooks/useDebouncedCallback'
import type { BusinessModelDoc } from '../../types/db'

interface BusinessModelSectionProps {
  item: BusinessModelDoc | null
  loading: boolean
  error: string | null
  onSave: (patch: Partial<Omit<BusinessModelDoc, 'id' | 'brand_id'>>) => void
}

const FIELD_STYLE = {
  fontFamily: 'var(--font-body)',
  fontSize: 14,
  lineHeight: 1.5,
  padding: '10px 12px',
  background: 'var(--glass-1)',
  border: '1px solid var(--glass-border-1)',
  color: 'var(--text-primary)',
  resize: 'vertical' as const,
}

export function BusinessModelSection({
  item,
  loading,
  error,
  onSave,
}: BusinessModelSectionProps) {
  const [who, setWho] = useState(item?.who ?? '')
  const [what, setWhat] = useState(item?.what ?? '')
  const [how, setHow] = useState(item?.how ?? '')
  const [forWhom, setForWhom] = useState(item?.for_whom ?? '')
  const [revenue, setRevenue] = useState(item?.revenue ?? '')

  useEffect(() => {
    setWho(item?.who ?? '')
    setWhat(item?.what ?? '')
    setHow(item?.how ?? '')
    setForWhom(item?.for_whom ?? '')
    setRevenue(item?.revenue ?? '')
  }, [
    item?.id,
    item?.who,
    item?.what,
    item?.how,
    item?.for_whom,
    item?.revenue,
  ])

  const debouncedWho = useDebouncedCallback((v: string) => onSave({ who: v }))
  const debouncedWhat = useDebouncedCallback((v: string) => onSave({ what: v }))
  const debouncedHow = useDebouncedCallback((v: string) => onSave({ how: v }))
  const debouncedForWhom = useDebouncedCallback((v: string) =>
    onSave({ for_whom: v }),
  )
  const debouncedRevenue = useDebouncedCallback((v: string) =>
    onSave({ revenue: v }),
  )

  if (loading) {
    return (
      <div
        className="animate-pulse"
        style={{
          minHeight: 200,
          borderRadius: 16,
          background: 'var(--glass-1)',
          border: '1px solid var(--glass-border-1)',
        }}
      />
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

  return (
    <section className="glass-2" style={{ borderRadius: 16, padding: 20 }}>
      <Field
        label="Wer"
        value={who}
        onChange={(v) => {
          setWho(v)
          debouncedWho(v)
        }}
        placeholder="Wer seid ihr / wer bist du?"
      />
      <Field
        label="Was"
        value={what}
        onChange={(v) => {
          setWhat(v)
          debouncedWhat(v)
        }}
        placeholder="Was bietet ihr an?"
      />
      <Field
        label="Wie"
        value={how}
        onChange={(v) => {
          setHow(v)
          debouncedHow(v)
        }}
        placeholder="Wie arbeitet ihr — Prozess, Delivery, Alleinstellung."
      />
      <Field
        label="Für wen"
        value={forWhom}
        onChange={(v) => {
          setForWhom(v)
          debouncedForWhom(v)
        }}
        placeholder="Für wen ist das gedacht — Zielgruppe / ICP."
      />
      <Field
        label="Womit"
        value={revenue}
        onChange={(v) => {
          setRevenue(v)
          debouncedRevenue(v)
        }}
        placeholder="Womit verdient ihr — Modelle, Produkte, Services."
      />
    </section>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  return (
    <div className="mb-4 last:mb-0">
      <label
        className="font-mono mb-1 block"
        style={{
          fontSize: 11,
          letterSpacing: '0.06em',
          color: 'var(--text-tertiary)',
        }}
      >
        {label}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        placeholder={placeholder}
        className="w-full rounded-lg outline-none transition-colors"
        style={FIELD_STYLE}
      />
    </div>
  )
}
