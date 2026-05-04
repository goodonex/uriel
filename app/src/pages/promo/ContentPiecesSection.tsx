import { motion } from 'framer-motion'
import { useState } from 'react'
import { Drawer } from '../../components/Drawer'
import type { Campaign, ContentPiece, ICP, WordBankEntry } from '../../types/db'
import { ContentPieceEditor } from './ContentPieceEditor'

interface ContentPiecesSectionProps {
  items: ContentPiece[]
  campaigns: Campaign[]
  icps: ICP[]
  wordBank: WordBankEntry[]
  loading: boolean
  error: string | null
  onCreate: () => ContentPiece
  onUpdate: (
    id: string,
    patch: Partial<Omit<ContentPiece, 'id' | 'brand_id'>>,
  ) => void
  onDelete: (id: string) => void
  onAutoTagged?: () => void
}

function formatDay(iso: string): string {
  return iso.slice(0, 10)
}

export function ContentPiecesSection({
  items,
  campaigns,
  icps,
  wordBank,
  loading,
  error,
  onCreate,
  onUpdate,
  onDelete,
  onAutoTagged,
}: ContentPiecesSectionProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = items.find((p) => p.id === selectedId) ?? null

  if (loading) {
    return (
      <div
        className="animate-pulse"
        style={{
          minHeight: 160,
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
        Content-Pieces konnten nicht geladen werden: {error}
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((piece, idx) => (
          <motion.button
            key={piece.id}
            type="button"
            onClick={() => setSelectedId(piece.id)}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: idx * 0.04,
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
                color: 'var(--mode-promo)',
                marginBottom: 6,
              }}
            >
              {piece.tags.channel} · {piece.tags.format}
            </div>
            <div
              className="font-display"
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              {piece.title || 'Ohne Titel'}
            </div>
            <div
              style={{
                fontSize: 11,
                color: 'var(--text-tertiary)',
                marginTop: 8,
              }}
            >
              Geplant: {formatDay(piece.scheduled_at)}
              {piece.performance_manual.updated_at ? (
                <span> · Performance erfasst</span>
              ) : null}
            </div>
          </motion.button>
        ))}

        <motion.button
          type="button"
          onClick={() => {
            const p = onCreate()
            setSelectedId(p.id)
          }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          whileHover={{ y: -1 }}
          className="flex min-h-[120px] flex-col items-center justify-center font-mono"
          style={{
            padding: 16,
            borderRadius: 12,
            border: '1px dashed var(--glass-border-2)',
            color: 'var(--text-tertiary)',
            fontSize: 12,
          }}
        >
          + Neues Piece
        </motion.button>
      </div>

      <Drawer
        open={selected !== null}
        onClose={() => setSelectedId(null)}
        title={selected?.title ?? 'Content-Piece'}
        width={520}
      >
        {selected ? (
          <ContentPieceEditor
            piece={selected}
            campaigns={campaigns}
            icps={icps}
            wordBank={wordBank}
            onPatch={(patch) => onUpdate(selected.id, patch)}
            onAutoTagged={onAutoTagged}
            onDelete={() => {
              onDelete(selected.id)
              setSelectedId(null)
            }}
          />
        ) : null}
      </Drawer>
    </>
  )
}
