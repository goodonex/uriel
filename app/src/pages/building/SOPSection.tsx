import { motion } from 'framer-motion'
import { useState } from 'react'
import { Drawer } from '../../components/Drawer'
import type { SOP } from '../../types/db'
import { SOPEditor } from './SOPEditor'

interface SOPSectionProps {
  items: SOP[]
  loading: boolean
  error: string | null
  onCreate: () => SOP
  onUpdate: (id: string, patch: Partial<Omit<SOP, 'id' | 'brand_id'>>) => void
  onDelete: (id: string) => void
}

export function SOPSection({
  items,
  loading,
  error,
  onCreate,
  onUpdate,
  onDelete,
}: SOPSectionProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = items.find((s) => s.id === selectedId) ?? null

  if (loading) return <SkeletonGrid />
  if (error) {
    return (
      <div
        className="font-mono"
        style={{ fontSize: 12, color: 'var(--accent-coral)' }}
      >
        SOPs konnten nicht geladen werden: {error}
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((sop, idx) => (
          <motion.button
            key={sop.id}
            type="button"
            onClick={() => setSelectedId(sop.id)}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: idx * 0.05,
              duration: 0.4,
              ease: [0.16, 1, 0.3, 1],
            }}
            whileHover={{ y: -1 }}
            className="text-left"
            style={{
              padding: 16,
              borderRadius: 12,
              background: 'var(--glass-2)',
              border: '1px solid var(--glass-border-1)',
              backdropFilter: 'var(--blur-md)',
              WebkitBackdropFilter: 'var(--blur-md)',
            }}
          >
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
              {sop.category}
            </div>
            <div
              className="font-display"
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              {sop.title || 'Unbenannt'}
            </div>
            <div
              style={{
                fontSize: 11,
                color: 'var(--text-tertiary)',
                marginTop: 8,
              }}
            >
              Klicken zum Bearbeiten
            </div>
          </motion.button>
        ))}

        <motion.button
          type="button"
          onClick={() => {
            const created = onCreate()
            setSelectedId(created.id)
          }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: items.length * 0.05,
            duration: 0.4,
            ease: [0.16, 1, 0.3, 1],
          }}
          whileHover={{ y: -1 }}
          className="flex min-h-[120px] items-center justify-center"
          style={{
            padding: 16,
            borderRadius: 12,
            background: 'var(--glass-1)',
            border: '1px dashed var(--glass-border-2)',
            color: 'var(--text-tertiary)',
          }}
        >
          <span
            className="font-mono"
            style={{
              fontSize: 11,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            + Neue SOP
          </span>
        </motion.button>
      </div>

      <Drawer
        open={selected !== null}
        onClose={() => setSelectedId(null)}
        title={selected ? selected.title || 'SOP' : 'SOP'}
        width={440}
      >
        {selected && (
          <SOPEditor
            key={selected.id}
            sop={selected}
            onChangeTitle={(t) => onUpdate(selected.id, { title: t })}
            onChangeContent={(c) => onUpdate(selected.id, { content: c })}
            onDelete={() => {
              onDelete(selected.id)
              setSelectedId(null)
            }}
          />
        )}
      </Drawer>
    </>
  )
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1].map((i) => (
        <div
          key={i}
          className="animate-pulse"
          style={{
            minHeight: 120,
            borderRadius: 12,
            background: 'var(--glass-1)',
            border: '1px solid var(--glass-border-1)',
          }}
        />
      ))}
    </div>
  )
}
