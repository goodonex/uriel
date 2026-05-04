import { motion } from 'framer-motion'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Drawer } from '../../components/Drawer'
import { SectionLabel } from '../../components/SectionLabel'
import { useCampaigns } from '../../hooks/useCampaigns'
import { useContacts } from '../../hooks/useContacts'
import { useContentPieces } from '../../hooks/useContentPieces'
import type { Campaign, Contact, ContentPiece, PipelineStage } from '../../types/db'

const STAGES: PipelineStage[] = [
  'first_contact',
  'conversation',
  'proposal',
  'deal',
  'paused',
]

const STAGE_LABEL: Record<PipelineStage, string> = {
  first_contact: 'Erstkontakt',
  conversation: 'Gespräch',
  proposal: 'Angebot',
  deal: 'Deal',
  paused: 'Pause',
}

export function SalesMode() {
  const { slug } = useParams<{ slug: string }>()
  const contacts = useContacts(slug)
  const pieces = useContentPieces(slug)
  const campaigns = useCampaigns(slug)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = contacts.items.find((c) => c.id === selectedId) ?? null

  return (
    <motion.div
      key={slug}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      style={{ background: 'transparent' }}
    >
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div
            className="font-mono"
            style={{
              fontSize: 10,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--mode-sales)',
              marginBottom: 6,
            }}
          >
            Sales Mode
          </div>
          <h2
            className="font-display"
            style={{
              fontSize: 22,
              fontWeight: 600,
              color: 'var(--text-primary)',
              letterSpacing: '-0.3px',
            }}
          >
            Pipeline &amp; Kontakte
          </h2>
        </div>
        {!contacts.loading && !contacts.error ? (
          <button
            type="button"
            className="font-mono"
            style={{
              fontSize: 12,
              padding: '10px 16px',
              borderRadius: 12,
              border: '1px solid var(--glass-border-2)',
              background: 'var(--glass-3)',
              color: 'var(--mode-sales)',
            }}
            onClick={() => {
              const c = contacts.create()
              setSelectedId(c.id)
            }}
          >
            + Kontakt
          </button>
        ) : null}
      </div>

      <SectionLabel accent="var(--mode-sales)" tight>
        Pipeline
      </SectionLabel>

      {contacts.loading ? (
        <div
          className="animate-pulse"
          style={{
            minHeight: 220,
            borderRadius: 16,
            background: 'var(--glass-1)',
            border: '1px solid var(--glass-border-1)',
          }}
        />
      ) : null}

      {contacts.error ? (
        <div
          className="font-mono"
          style={{ fontSize: 12, color: 'var(--accent-coral)' }}
        >
          Kontakte konnten nicht geladen werden: {contacts.error}
        </div>
      ) : null}

      {!contacts.loading && !contacts.error ? (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {STAGES.map((stage) => {
            const list = contacts.items.filter((c) => c.pipeline_stage === stage)
            return (
              <div
                key={stage}
                className="glass-2 shrink-0"
                style={{
                  width: 200,
                  borderRadius: 14,
                  padding: 10,
                  border: '1px solid var(--glass-border-1)',
                  backdropFilter: 'var(--blur-md)',
                  WebkitBackdropFilter: 'var(--blur-md)',
                }}
              >
                <div
                  className="font-mono mb-2"
                  style={{
                    fontSize: 10,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'var(--text-tertiary)',
                  }}
                >
                  {STAGE_LABEL[stage]}
                </div>
                <div className="flex flex-col gap-2">
                  {list.map((c) => (
                    <motion.button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedId(c.id)}
                      whileHover={{ y: -1 }}
                      className="text-left"
                      style={{
                        padding: 10,
                        borderRadius: 10,
                        background: 'var(--glass-1)',
                        border: '1px solid var(--glass-border-2)',
                      }}
                    >
                      <div
                        className="font-display"
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                        }}
                      >
                        {c.name}
                      </div>
                      {c.next_follow_up_at ? (
                        <div
                          className="font-mono mt-1"
                          style={{ fontSize: 9, color: 'var(--text-tertiary)' }}
                        >
                          Next: {c.next_follow_up_at.slice(0, 10)}
                        </div>
                      ) : null}
                    </motion.button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ) : null}

      <Drawer
        open={selected !== null}
        onClose={() => setSelectedId(null)}
        title={selected?.name ?? 'Kontakt'}
        width={460}
      >
        {selected ? (
          <ContactEditor
            contact={selected}
            pieces={pieces.items}
            campaigns={campaigns.items}
            onPatch={(patch) => contacts.update(selected.id, patch)}
            onDelete={() => {
              contacts.remove(selected.id)
              setSelectedId(null)
            }}
          />
        ) : null}
      </Drawer>
    </motion.div>
  )
}

function ContactEditor({
  contact,
  pieces,
  campaigns,
  onPatch,
  onDelete,
}: {
  contact: Contact
  pieces: ContentPiece[]
  campaigns: Campaign[]
  onPatch: (patch: Partial<Omit<Contact, 'id' | 'brand_id'>>) => void
  onDelete: () => void
}) {
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
          value={contact.name}
          onChange={(e) => onPatch({ name: e.target.value })}
          style={field}
        />
      </div>
      <div>
        <label
          className="font-mono mb-1 block"
          style={{ fontSize: 11, color: 'var(--text-tertiary)' }}
        >
          E-Mail
        </label>
        <input
          type="email"
          value={contact.email}
          onChange={(e) => onPatch({ email: e.target.value })}
          style={field}
        />
      </div>

      <div>
        <label
          className="font-mono mb-1 block"
          style={{ fontSize: 11, color: 'var(--text-tertiary)' }}
        >
          Pipeline
        </label>
        <select
          value={contact.pipeline_stage}
          onChange={(e) =>
            onPatch({ pipeline_stage: e.target.value as PipelineStage })
          }
          style={field}
        >
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {STAGE_LABEL[s]}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label
            className="font-mono mb-1 block"
            style={{ fontSize: 11, color: 'var(--text-tertiary)' }}
          >
            Letzter Kontakt
          </label>
          <input
            type="date"
            value={
              contact.last_contact_at
                ? contact.last_contact_at.slice(0, 10)
                : ''
            }
            onChange={(e) =>
              onPatch({
                last_contact_at:
                  e.target.value === ''
                    ? null
                    : new Date(e.target.value).toISOString(),
              })
            }
            style={field}
          />
        </div>
        <div>
          <label
            className="font-mono mb-1 block"
            style={{ fontSize: 11, color: 'var(--text-tertiary)' }}
          >
            Nächster Follow-up
          </label>
          <input
            type="date"
            value={
              contact.next_follow_up_at
                ? contact.next_follow_up_at.slice(0, 10)
                : ''
            }
            onChange={(e) =>
              onPatch({
                next_follow_up_at:
                  e.target.value === ''
                    ? null
                    : new Date(e.target.value).toISOString(),
              })
            }
            style={field}
          />
        </div>
      </div>

      <div>
        <label
          className="font-mono mb-1 block"
          style={{ fontSize: 11, color: 'var(--text-tertiary)' }}
        >
          Quelle — Content-Piece
        </label>
        <select
          value={contact.source_content_piece_id ?? ''}
          onChange={(e) =>
            onPatch({
              source_content_piece_id:
                e.target.value === '' ? null : e.target.value,
            })
          }
          style={field}
        >
          <option value="">— keine —</option>
          {pieces.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          className="font-mono mb-1 block"
          style={{ fontSize: 11, color: 'var(--text-tertiary)' }}
        >
          Quelle — Kampagne
        </label>
        <select
          value={contact.source_campaign_id ?? ''}
          onChange={(e) =>
            onPatch({
              source_campaign_id:
                e.target.value === '' ? null : e.target.value,
            })
          }
          style={field}
        >
          <option value="">— keine —</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          className="font-mono mb-1 block"
          style={{ fontSize: 11, color: 'var(--text-tertiary)' }}
        >
          Notizen
        </label>
        <textarea
          value={contact.notes}
          onChange={(e) => onPatch({ notes: e.target.value })}
          rows={4}
          style={{ ...field, resize: 'vertical' }}
        />
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
        Kontakt löschen
      </button>
    </div>
  )
}
