import { useMemo, useState, type KeyboardEvent } from 'react'
import type { WordBankEntry, WordBankType } from '../../types/db'

interface WordBankSectionProps {
  items: WordBankEntry[]
  loading: boolean
  error: string | null
  onCreate: (partial: Pick<WordBankEntry, 'word' | 'type' | 'cluster'>) => WordBankEntry
  onRemove: (id: string) => void
}

export function WordBankSection({
  items,
  loading,
  error,
  onCreate,
  onRemove,
}: WordBankSectionProps) {
  if (loading) return <Skeleton />
  if (error) {
    return (
      <div
        className="font-mono"
        style={{ fontSize: 12, color: 'var(--accent-coral)' }}
      >
        Word Bank konnte nicht geladen werden: {error}
      </div>
    )
  }

  const yesItems = items.filter((i) => i.type === 'yes')
  const noItems = items.filter((i) => i.type === 'no')

  return (
    <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
      <Column
        tone="yes"
        title="Ja-Wörter"
        marker="✓"
        accent="var(--accent-teal)"
        items={yesItems}
        existingClusters={uniqueClusters(items)}
        onCreate={(partial) => onCreate({ ...partial, type: 'yes' })}
        onRemove={onRemove}
      />
      <Column
        tone="no"
        title="Nein-Wörter"
        marker="✗"
        accent="var(--accent-coral)"
        items={noItems}
        existingClusters={uniqueClusters(items)}
        onCreate={(partial) => onCreate({ ...partial, type: 'no' })}
        onRemove={onRemove}
      />
    </div>
  )
}

function uniqueClusters(items: WordBankEntry[]): string[] {
  const set = new Set<string>()
  items.forEach((i) => set.add(i.cluster))
  return Array.from(set).sort((a, b) => a.localeCompare(b))
}

interface ColumnProps {
  tone: WordBankType
  title: string
  marker: string
  accent: string
  items: WordBankEntry[]
  existingClusters: string[]
  onCreate: (partial: Pick<WordBankEntry, 'word' | 'cluster'>) => WordBankEntry
  onRemove: (id: string) => void
}

function Column({
  tone,
  title,
  marker,
  accent,
  items,
  existingClusters,
  onCreate,
  onRemove,
}: ColumnProps) {
  const [wordInput, setWordInput] = useState('')
  const [clusterInput, setClusterInput] = useState('')

  const grouped = useMemo(() => {
    const map = new Map<string, WordBankEntry[]>()
    items.forEach((i) => {
      const list = map.get(i.cluster) ?? []
      list.push(i)
      map.set(i.cluster, list)
    })
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [items])

  function submit() {
    const w = wordInput.trim()
    if (!w) return
    const c = clusterInput.trim() || 'Allgemein'
    onCreate({ word: w, cluster: c })
    setWordInput('')
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      submit()
    }
  }

  return (
    <section
      className="glass-2"
      style={{ borderRadius: 16, padding: 20 }}
    >
      <div className="mb-4 flex items-center gap-2">
        <span
          style={{
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: `color-mix(in srgb, ${accent} 20%, transparent)`,
            color: accent,
            fontSize: 11,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 600,
          }}
        >
          {marker}
        </span>
        <span
          className="font-display"
          style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}
        >
          {title}
        </span>
      </div>

      {grouped.length === 0 && (
        <div
          style={{
            fontSize: 12,
            color: 'var(--text-tertiary)',
            fontStyle: 'italic',
            marginBottom: 14,
          }}
        >
          {tone === 'yes'
            ? 'Noch keine Ja-Wörter.'
            : 'Noch keine Nein-Wörter.'}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {grouped.map(([cluster, entries]) => (
          <div key={cluster}>
            <div
              className="font-mono"
              style={{
                fontSize: 10,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--text-tertiary)',
                marginBottom: 6,
              }}
            >
              {cluster}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {entries.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => onRemove(e.id)}
                  title="Klicken zum Entfernen"
                  className="group rounded-full transition-colors"
                  style={{
                    fontSize: 11,
                    padding: '3px 10px',
                    background: 'var(--glass-2)',
                    border: '1px solid var(--glass-border-2)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <span className="group-hover:hidden">{e.word}</span>
                  <span
                    className="hidden group-hover:inline"
                    style={{ color: accent }}
                  >
                    {e.word} ×
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div
        className="mt-5 flex flex-col gap-2"
        style={{
          paddingTop: 14,
          borderTop: '1px solid var(--glass-border-1)',
        }}
      >
        <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
          <input
            type="text"
            value={wordInput}
            onChange={(e) => setWordInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Wort"
            className="rounded-lg outline-none"
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 12,
              padding: '7px 10px',
              background: 'var(--glass-1)',
              border: '1px solid var(--glass-border-1)',
              color: 'var(--text-primary)',
            }}
          />
          <input
            type="text"
            list={`clusters-${tone}`}
            value={clusterInput}
            onChange={(e) => setClusterInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Cluster"
            className="rounded-lg outline-none"
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 12,
              padding: '7px 10px',
              background: 'var(--glass-1)',
              border: '1px solid var(--glass-border-1)',
              color: 'var(--text-primary)',
            }}
          />
          <datalist id={`clusters-${tone}`}>
            {existingClusters.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <button
            type="button"
            onClick={submit}
            className="font-mono rounded-lg transition-colors"
            style={{
              fontSize: 11,
              padding: '7px 12px',
              background: 'var(--glass-3)',
              border: '1px solid var(--glass-border-2)',
              color: 'var(--text-primary)',
            }}
          >
            +
          </button>
        </div>
        <span
          className="font-mono"
          style={{ fontSize: 10, color: 'var(--text-tertiary)' }}
        >
          Enter zum Hinzufügen · Klick auf Chip entfernt es
        </span>
      </div>
    </section>
  )
}

function Skeleton() {
  return (
    <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
      {[0, 1].map((i) => (
        <div
          key={i}
          className="animate-pulse"
          style={{
            minHeight: 200,
            borderRadius: 16,
            background: 'var(--glass-1)',
            border: '1px solid var(--glass-border-1)',
          }}
        />
      ))}
    </div>
  )
}
