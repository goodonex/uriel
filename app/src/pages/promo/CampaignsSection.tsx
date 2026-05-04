import { motion } from 'framer-motion'
import { useState } from 'react'
import { Drawer } from '../../components/Drawer'
import type { Campaign, ContentPiece } from '../../types/db'

interface CampaignsSectionProps {
  campaigns: Campaign[]
  pieces: ContentPiece[]
  loading: boolean
  error: string | null
  onCreate: () => Campaign
  onUpdate: (
    id: string,
    patch: Partial<Omit<Campaign, 'id' | 'brand_id'>>,
  ) => void
  onDelete: (id: string) => void
}

export function CampaignsSection({
  campaigns,
  pieces,
  loading,
  error,
  onCreate,
  onUpdate,
  onDelete,
}: CampaignsSectionProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = campaigns.find((c) => c.id === selectedId) ?? null

  if (loading) {
    return (
      <div
        className="animate-pulse"
        style={{
          minHeight: 120,
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
        Kampagnen konnten nicht geladen werden: {error}
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {campaigns.map((c, idx) => {
          const linked = pieces.filter((p) => p.campaign_id === c.id).length
          return (
            <motion.button
              key={c.id}
              type="button"
              onClick={() => setSelectedId(c.id)}
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
                  color: 'var(--text-tertiary)',
                  marginBottom: 6,
                }}
              >
                Kampagne
              </div>
              <div
                className="font-display"
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                }}
              >
                {c.name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 8 }}>
                {linked} Piece(s) zugeordnet
              </div>
            </motion.button>
          )
        })}

        <motion.button
          type="button"
          onClick={() => {
            const c = onCreate()
            setSelectedId(c.id)
          }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          whileHover={{ y: -1 }}
          className="flex min-h-[100px] flex-col items-center justify-center font-mono"
          style={{
            padding: 16,
            borderRadius: 12,
            border: '1px dashed var(--glass-border-2)',
            color: 'var(--text-tertiary)',
            fontSize: 12,
          }}
        >
          + Neue Kampagne
        </motion.button>
      </div>

      <Drawer
        open={selected !== null}
        onClose={() => setSelectedId(null)}
        title={selected?.name ?? 'Kampagne'}
        width={440}
      >
        {selected ? (
          <CampaignEditorInner
            campaign={selected}
            pieces={pieces}
            onPatch={(patch) => onUpdate(selected.id, patch)}
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

function CampaignEditorInner({
  campaign,
  pieces,
  onPatch,
  onDelete,
}: {
  campaign: Campaign
  pieces: ContentPiece[]
  onPatch: (patch: Partial<Omit<Campaign, 'id' | 'brand_id'>>) => void
  onDelete: () => void
}) {
  const linked = pieces.filter((p) => p.campaign_id === campaign.id)

  const field = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 10,
    background: 'var(--glass-1)',
    border: '1px solid var(--glass-border-1)',
    color: 'var(--text-primary)',
    fontSize: 13,
  } as const

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label
          className="font-mono mb-1 block"
          style={{ fontSize: 11, color: 'var(--text-tertiary)' }}
        >
          Name
        </label>
        <input
          type="text"
          value={campaign.name}
          onChange={(e) => onPatch({ name: e.target.value })}
          style={field}
        />
      </div>
      <div>
        <label
          className="font-mono mb-1 block"
          style={{ fontSize: 11, color: 'var(--text-tertiary)' }}
        >
          Ziel / Hypothese
        </label>
        <textarea
          value={campaign.goal}
          onChange={(e) => onPatch({ goal: e.target.value })}
          rows={3}
          style={{ ...field, resize: 'vertical' }}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label
            className="font-mono mb-1 block"
            style={{ fontSize: 11, color: 'var(--text-tertiary)' }}
          >
            Start
          </label>
          <input
            type="date"
            value={campaign.start_at.slice(0, 10)}
            onChange={(e) => onPatch({ start_at: e.target.value })}
            style={field}
          />
        </div>
        <div>
          <label
            className="font-mono mb-1 block"
            style={{ fontSize: 11, color: 'var(--text-tertiary)' }}
          >
            Ende (opt.)
          </label>
          <input
            type="date"
            value={campaign.end_at ? campaign.end_at.slice(0, 10) : ''}
            onChange={(e) =>
              onPatch({
                end_at: e.target.value === '' ? null : e.target.value,
              })
            }
            style={field}
          />
        </div>
      </div>

      <div
        className="glass-2"
        style={{
          borderRadius: 12,
          padding: 12,
          border: '1px solid var(--glass-border-1)',
        }}
      >
        <span
          className="font-mono mb-2 block"
          style={{ fontSize: 10, color: 'var(--text-tertiary)' }}
        >
          Zugeordnete Pieces
        </span>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
          Zuweisung erfolgt im Content-Piece Editor (Feld „Kampagne“).
        </p>
        {linked.length === 0 ? (
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Noch keine.</span>
        ) : (
          <ul className="flex flex-col gap-1">
            {linked.map((p) => (
              <li
                key={p.id}
                className="font-mono"
                style={{ fontSize: 11, color: 'var(--text-primary)' }}
              >
                · {p.title}
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="button"
        className="font-mono"
        style={{
          alignSelf: 'flex-start',
          fontSize: 11,
          padding: '8px 14px',
          borderRadius: 10,
          border: '1px solid var(--accent-coral)',
          color: 'var(--accent-coral)',
        }}
        onClick={onDelete}
      >
        Kampagne löschen
      </button>
    </div>
  )
}
