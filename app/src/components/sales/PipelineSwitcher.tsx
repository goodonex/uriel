import { useState } from 'react'
import { useSalesPipelines } from '../../hooks/useSalesPro'
import { useToast } from '../Toast'

interface PipelineSwitcherProps {
  brandSlug: string
  /** Aktuell ausgewählter Pipeline-Slug; bei Wechsel kommt neuer Slug rein */
  selectedSlug: string | null
  onChange: (slug: string | null) => void
}

export function PipelineSwitcher({ brandSlug, selectedSlug, onChange }: PipelineSwitcherProps) {
  const pipelines = useSalesPipelines(brandSlug)
  const { show } = useToast()
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')

  if (pipelines.loading) {
    return null
  }
  // Bei nur 1 Pipeline: Add-Button trotzdem zeigen, aber kompakt
  const items = pipelines.items
  const isMulti = items.length > 1

  const handleCreate = async () => {
    const name = newName.trim()
    if (!name) return
    const slug = name.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 40)
    await pipelines.create({ name, slug })
    setNewName('')
    setCreating(false)
    show(`Pipeline „${name}" angelegt`, 'success')
    onChange(slug)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      {isMulti
        ? items.map((p) => {
            const on = (selectedSlug ?? items.find((x) => x.is_default)?.slug) === p.slug
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onChange(p.slug)}
                className="font-mono"
                style={{
                  fontSize: 11,
                  padding: '6px 11px',
                  borderRadius: 8,
                  border: on
                    ? '1px solid var(--mode-sales)'
                    : '1px solid var(--glass-border-2)',
                  background: on
                    ? 'color-mix(in srgb, var(--mode-sales) 14%, transparent)'
                    : 'var(--glass-2)',
                  color: on ? 'var(--mode-sales)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                {p.name}
                {p.is_default ? (
                  <span style={{ fontSize: 9, marginLeft: 4, opacity: 0.7 }}>★</span>
                ) : null}
              </button>
            )
          })
        : null}

      {creating ? (
        <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleCreate()
              if (e.key === 'Escape') setCreating(false)
            }}
            placeholder="Pipeline-Name …"
            autoFocus
            style={{
              fontSize: 11,
              padding: '6px 8px',
              width: 130,
              borderRadius: 8,
              border: '1px solid var(--mode-sales)',
              background: 'var(--glass-1)',
              color: 'var(--text-primary)',
              outline: 'none',
            }}
          />
          <button
            type="button"
            onClick={() => void handleCreate()}
            className="font-mono"
            style={{
              fontSize: 11,
              padding: '6px 10px',
              borderRadius: 8,
              border: '1px solid var(--mode-sales)',
              background: 'color-mix(in srgb, var(--mode-sales) 22%, transparent)',
              color: 'var(--mode-sales)',
              cursor: 'pointer',
            }}
          >
            +
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="font-mono"
          title="Neue Pipeline anlegen"
          style={{
            fontSize: 11,
            padding: '6px 9px',
            borderRadius: 8,
            border: '1px dashed var(--glass-border-2)',
            background: 'transparent',
            color: 'var(--text-tertiary)',
            cursor: 'pointer',
          }}
        >
          + Pipeline
        </button>
      )}
    </div>
  )
}
