import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { useDebouncedCallback } from '../../hooks/useDebouncedCallback'
import type { ICP, ICPPriority, WordBankEntry } from '../../types/db'

interface ICPEditorProps {
  icp: ICP
  wordBank: WordBankEntry[]
  onChange: (patch: Partial<Omit<ICP, 'id' | 'brand_id'>>) => void
  onDelete: () => void
}

const PRIORITIES: Array<{ value: ICPPriority; label: string }> = [
  { value: 1, label: 'Primary' },
  { value: 2, label: 'Secondary' },
  { value: 3, label: 'Tertiary' },
]

export function ICPEditor({ icp, wordBank, onChange, onDelete }: ICPEditorProps) {
  const [name, setName] = useState(icp.name)
  const [ageRange, setAgeRange] = useState(icp.age_range)
  const [location, setLocation] = useState(icp.location)
  const [painInput, setPainInput] = useState('')
  const [notes, setNotes] = useState(icp.notes)

  useEffect(() => {
    setName(icp.name)
    setAgeRange(icp.age_range)
    setLocation(icp.location)
    setNotes(icp.notes)
    setPainInput('')
  }, [icp.id])

  const debouncedName = useDebouncedCallback((v: string) => onChange({ name: v }))
  const debouncedAge = useDebouncedCallback((v: string) => onChange({ age_range: v }))
  const debouncedLocation = useDebouncedCallback((v: string) =>
    onChange({ location: v }),
  )
  const debouncedNotes = useDebouncedCallback((v: string) => onChange({ notes: v }))

  const clusters = useMemo(() => {
    const set = new Set<string>()
    wordBank.forEach((w) => set.add(w.cluster))
    icp.word_clusters.forEach((c) => set.add(c))
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [wordBank, icp.word_clusters])

  function addPainPoint(raw: string) {
    const value = raw.trim()
    if (!value) return
    onChange({ pain_points: [...icp.pain_points, value] })
    setPainInput('')
  }

  function removePainPoint(index: number) {
    const next = icp.pain_points.filter((_, i) => i !== index)
    onChange({ pain_points: next })
  }

  function toggleCluster(cluster: string) {
    const active = icp.word_clusters.includes(cluster)
    const next = active
      ? icp.word_clusters.filter((c) => c !== cluster)
      : [...icp.word_clusters, cluster]
    onChange({ word_clusters: next })
  }

  function handlePainKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      addPainPoint(painInput)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Field label="Name">
        <TextInput
          value={name}
          onChange={(v) => {
            setName(v)
            debouncedName(v)
          }}
          placeholder="Urban Professional"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Alter">
          <TextInput
            value={ageRange}
            onChange={(v) => {
              setAgeRange(v)
              debouncedAge(v)
            }}
            placeholder="28–42"
          />
        </Field>
        <Field label="Ort">
          <TextInput
            value={location}
            onChange={(v) => {
              setLocation(v)
              debouncedLocation(v)
            }}
            placeholder="Hamburg, Berlin, München"
          />
        </Field>
      </div>

      <Field label="Priorität">
        <div className="flex gap-1.5">
          {PRIORITIES.map((p) => {
            const active = icp.priority === p.value
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => onChange({ priority: p.value })}
                className="rounded-full transition-all duration-200"
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  padding: '5px 12px',
                  background: active ? 'var(--glass-4)' : 'var(--glass-1)',
                  border: `1px solid ${
                    active ? 'var(--glass-border-3)' : 'var(--glass-border-2)'
                  }`,
                  color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                }}
              >
                {p.label}
              </button>
            )
          })}
        </div>
      </Field>

      <Field label="Schmerzpunkte">
        <div className="flex flex-col gap-2">
          {icp.pain_points.length === 0 && (
            <span
              style={{
                fontSize: 12,
                color: 'var(--text-tertiary)',
                fontStyle: 'italic',
              }}
            >
              Noch nichts eingetragen
            </span>
          )}
          {icp.pain_points.map((p, idx) => (
            <div
              key={`${idx}-${p}`}
              className="flex items-start justify-between gap-2 rounded-lg"
              style={{
                padding: '8px 10px',
                background: 'var(--glass-1)',
                border: '1px solid var(--glass-border-1)',
              }}
            >
              <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                {p}
              </span>
              <button
                type="button"
                onClick={() => removePainPoint(idx)}
                aria-label="Entfernen"
                style={{
                  fontSize: 14,
                  color: 'var(--text-tertiary)',
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>
          ))}
          <input
            type="text"
            value={painInput}
            onChange={(e) => setPainInput(e.target.value)}
            onKeyDown={handlePainKey}
            onBlur={() => addPainPoint(painInput)}
            placeholder="+ Punkt hinzufügen (Enter)"
            className="rounded-lg outline-none transition-colors"
            style={{
              fontSize: 13,
              padding: '8px 10px',
              background: 'var(--glass-1)',
              border: '1px dashed var(--glass-border-2)',
              color: 'var(--text-primary)',
            }}
          />
        </div>
      </Field>

      <Field label="Word Bank Cluster">
        {clusters.length === 0 ? (
          <span
            style={{
              fontSize: 12,
              color: 'var(--text-tertiary)',
              fontStyle: 'italic',
            }}
          >
            Noch keine Cluster — erst in der Word Bank anlegen
          </span>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {clusters.map((c) => {
              const active = icp.word_clusters.includes(c)
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleCluster(c)}
                  className="rounded-full transition-all duration-200"
                  style={{
                    fontSize: 11,
                    padding: '3px 10px',
                    background: active ? 'var(--glass-4)' : 'var(--glass-2)',
                    border: `1px solid ${
                      active ? 'var(--glass-border-3)' : 'var(--glass-border-2)'
                    }`,
                    color: active
                      ? 'var(--text-primary)'
                      : 'var(--text-secondary)',
                  }}
                >
                  {c}
                </button>
              )
            })}
          </div>
        )}
      </Field>

      <Field label="Notes">
        <textarea
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value)
            debouncedNotes(e.target.value)
          }}
          rows={4}
          placeholder="Kontext, Beobachtungen, Hypothesen…"
          className="w-full rounded-lg outline-none transition-colors"
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 13,
            lineHeight: 1.5,
            padding: '10px 12px',
            background: 'var(--glass-1)',
            border: '1px solid var(--glass-border-1)',
            color: 'var(--text-primary)',
            resize: 'vertical',
          }}
        />
      </Field>

      <div
        style={{
          height: 1,
          background: 'var(--glass-border-1)',
          margin: '8px 0 4px',
        }}
      />
      <button
        type="button"
        onClick={() => {
          if (window.confirm(`ICP "${icp.name}" wirklich löschen?`)) onDelete()
        }}
        className="font-mono self-start rounded-lg transition-colors"
        style={{
          fontSize: 11,
          padding: '6px 12px',
          border: '1px solid var(--glass-border-2)',
          color: 'var(--accent-coral)',
          background: 'transparent',
        }}
      >
        ICP löschen
      </button>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        className="font-mono"
        style={{
          fontSize: 11,
          color: 'var(--text-tertiary)',
          marginBottom: 6,
          letterSpacing: '0.06em',
        }}
      >
        {label}
      </div>
      {children}
    </div>
  )
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg outline-none transition-colors"
      style={{
        fontFamily: 'var(--font-body)',
        fontSize: 13,
        padding: '8px 10px',
        background: 'var(--glass-1)',
        border: '1px solid var(--glass-border-1)',
        color: 'var(--text-primary)',
      }}
    />
  )
}
