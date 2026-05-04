import { motion } from 'framer-motion'
import { useState } from 'react'
import { Drawer } from '../../components/Drawer'
import type { ICP, WordBankEntry } from '../../types/db'
import { ICPEditor } from './ICPEditor'

interface ICPSectionProps {
  icps: ICP[]
  wordBank: WordBankEntry[]
  loading: boolean
  error: string | null
  onCreate: () => ICP
  onUpdate: (id: string, patch: Partial<Omit<ICP, 'id' | 'brand_id'>>) => void
  onDelete: (id: string) => void
}

const PRIORITY_LABELS: Record<1 | 2 | 3, string> = {
  1: 'Primary',
  2: 'Secondary',
  3: 'Tertiary',
}

export function ICPSection({
  icps,
  wordBank,
  loading,
  error,
  onCreate,
  onUpdate,
  onDelete,
}: ICPSectionProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = icps.find((i) => i.id === selectedId) ?? null

  if (loading) {
    return <SkeletonGrid />
  }
  if (error) {
    return (
      <div
        className="font-mono"
        style={{ fontSize: 12, color: 'var(--accent-coral)' }}
      >
        ICPs konnten nicht geladen werden: {error}
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {icps.map((icp, idx) => (
          <motion.button
            key={icp.id}
            type="button"
            onClick={() => setSelectedId(icp.id)}
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
              transition: 'border-color 200ms, background 200ms',
            }}
          >
            <div className="mb-2 flex items-center justify-between">
              <span
                className="font-mono"
                style={{
                  fontSize: 10,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color:
                    icp.priority === 1
                      ? 'var(--accent-blue)'
                      : icp.priority === 2
                        ? 'var(--accent-purple)'
                        : 'var(--text-tertiary)',
                }}
              >
                {PRIORITY_LABELS[icp.priority]}
              </span>
              {icp.word_clusters.length > 0 && (
                <span
                  className="font-mono"
                  style={{ fontSize: 10, color: 'var(--text-tertiary)' }}
                >
                  {icp.word_clusters.length} Cluster
                </span>
              )}
            </div>
            <div
              className="font-display"
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: 4,
              }}
            >
              {icp.name || 'Unbenannt'}
            </div>
            <div
              style={{
                fontSize: 12,
                color: 'var(--text-secondary)',
                marginBottom: 10,
              }}
            >
              {[icp.age_range, icp.location].filter(Boolean).join(' · ') ||
                'Noch keine Angaben'}
            </div>
            {icp.pain_points.length > 0 ? (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {icp.pain_points.slice(0, 2).map((p, i) => (
                  <li
                    key={i}
                    style={{
                      fontSize: 11,
                      color: 'var(--text-tertiary)',
                      lineHeight: 1.5,
                      position: 'relative',
                      paddingLeft: 10,
                    }}
                  >
                    <span style={{ position: 'absolute', left: 0 }}>·</span>
                    {p.length > 70 ? `${p.slice(0, 70)}…` : p}
                  </li>
                ))}
                {icp.pain_points.length > 2 && (
                  <li
                    style={{
                      fontSize: 10,
                      color: 'var(--text-tertiary)',
                      marginTop: 4,
                      paddingLeft: 10,
                    }}
                  >
                    +{icp.pain_points.length - 2} weitere
                  </li>
                )}
              </ul>
            ) : (
              <span
                style={{
                  fontSize: 11,
                  color: 'var(--text-tertiary)',
                  fontStyle: 'italic',
                }}
              >
                Noch keine Schmerzpunkte
              </span>
            )}
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
            delay: icps.length * 0.05,
            duration: 0.4,
            ease: [0.16, 1, 0.3, 1],
          }}
          whileHover={{ y: -1 }}
          className="flex items-center justify-center text-left transition-colors"
          style={{
            minHeight: 140,
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
            + Neuer ICP
          </span>
        </motion.button>
      </div>

      <Drawer
        open={selected !== null}
        onClose={() => setSelectedId(null)}
        title={selected ? `ICP · ${selected.name || 'Unbenannt'}` : 'ICP'}
        width={420}
      >
        {selected && (
          <ICPEditor
            key={selected.id}
            icp={selected}
            wordBank={wordBank}
            onChange={(patch) => onUpdate(selected.id, patch)}
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
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="animate-pulse"
          style={{
            minHeight: 140,
            borderRadius: 12,
            background: 'var(--glass-1)',
            border: '1px solid var(--glass-border-1)',
          }}
        />
      ))}
    </div>
  )
}
