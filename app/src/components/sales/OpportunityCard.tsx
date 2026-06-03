import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getProjectAreaChips } from '../../lib/projectAreas'
import type { DeliverProject, Opportunity, OpportunityProduct, OpportunityStage } from '../../types/db'

const PRODUCT_META: Record<
  OpportunityProduct,
  { label: string; color: string; bg: string }
> = {
  herrmann: {
    label: 'Herrmann & Co',
    color: 'var(--mode-sales)',
    bg: 'color-mix(in srgb, var(--mode-sales) 12%, transparent)',
  },
  wertavio: {
    label: 'Wertavio',
    color: 'var(--accent-blue)',
    bg: 'color-mix(in srgb, var(--accent-blue) 12%, transparent)',
  },
  culturefit: {
    label: 'CultureFit',
    color: '#DC4628',
    bg: 'color-mix(in srgb, #DC4628 14%, transparent)',
  },
}

const MAIN_STAGES: OpportunityStage[] = ['erstkontakt', 'gespraech', 'pitch', 'deal']
const STAGE_LABEL: Record<OpportunityStage, string> = {
  erstkontakt: 'Erstkontakt',
  gespraech: 'Gespräch',
  pitch: 'Pitch',
  deal: 'Deal',
  pause: 'Pause',
  verloren: 'Verloren',
}

export function OpportunityCard({
  brandSlug,
  opportunity,
  project,
  onUpdateStage,
  onUpdateNotes,
  onStartProject,
}: {
  brandSlug: string
  opportunity: Opportunity
  project: DeliverProject | null
  onUpdateStage: (id: string, stage: OpportunityStage) => void
  onUpdateNotes: (id: string, notes: string) => void
  onStartProject: () => void
}) {
  const navigate = useNavigate()
  const productMeta = PRODUCT_META[opportunity.product]
  const areaChips = useMemo(() => getProjectAreaChips(project), [project])
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesDraft, setNotesDraft] = useState(opportunity.notes ?? '')

  useEffect(() => {
    if (!editingNotes) setNotesDraft(opportunity.notes ?? '')
  }, [editingNotes, opportunity.notes])

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        border: '1px solid var(--glass-border-1)',
        background: 'var(--glass-1)',
        borderRadius: 14,
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span
          className="font-mono"
          style={{
            fontSize: 10,
            letterSpacing: '0.08em',
            color: productMeta.color,
            border: `1px solid ${productMeta.color}`,
            background: productMeta.bg,
            borderRadius: 999,
            padding: '4px 8px',
          }}
        >
          {productMeta.label}
        </span>
        {(opportunity.stage === 'pause' || opportunity.stage === 'verloren') ? (
          <span className="font-mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
            {STAGE_LABEL[opportunity.stage]}
          </span>
        ) : null}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {MAIN_STAGES.map((stage) => {
          const on = opportunity.stage === stage
          return (
            <button
              key={stage}
              type="button"
              className="font-mono"
              onClick={(e) => {
                e.stopPropagation()
                onUpdateStage(opportunity.id, stage)
              }}
              style={{
                fontSize: 10,
                padding: '5px 9px',
                borderRadius: 999,
                border: on ? `1px solid ${productMeta.color}` : '1px solid var(--glass-border-2)',
                background: on ? productMeta.bg : 'var(--glass-2)',
                color: on ? productMeta.color : 'var(--text-tertiary)',
                cursor: 'pointer',
              }}
            >
              {STAGE_LABEL[stage]}
            </button>
          )
        })}
      </div>

      {opportunity.stage === 'deal' ? (
        project ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              type="button"
              className="font-mono"
              onClick={() => navigate(`/brand/${brandSlug}/deliver/${project.id}`)}
              style={{
                fontSize: 11,
                padding: '8px 10px',
                borderRadius: 8,
                border: '1px solid var(--accent-teal)',
                color: 'var(--accent-teal)',
                background: 'transparent',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              → Zum Projekt {project.name}
            </button>
            {areaChips.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {areaChips.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    className="font-mono"
                    onClick={() =>
                      navigate(`/brand/${brandSlug}/deliver/${project.id}?area=${chip.key}`)
                    }
                    style={{
                      fontSize: 10,
                      padding: '4px 8px',
                      borderRadius: 999,
                      border: '1px solid var(--glass-border-2)',
                      color: 'var(--text-secondary)',
                      background: 'var(--glass-2)',
                      cursor: 'pointer',
                    }}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <button
            type="button"
            className="font-mono"
            onClick={onStartProject}
            style={{
              fontSize: 11,
              padding: '8px 10px',
              borderRadius: 8,
              border: '1px solid var(--accent-teal)',
              color: 'var(--accent-teal)',
              background: 'transparent',
              cursor: 'pointer',
              alignSelf: 'flex-start',
            }}
          >
            Projekt starten
          </button>
        )
      ) : null}

      <div>
        <div className="font-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)', marginBottom: 4 }}>
          Notiz
        </div>
        {editingNotes ? (
          <input
            autoFocus
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            onBlur={() => {
              setEditingNotes(false)
              onUpdateNotes(opportunity.id, notesDraft.trim())
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setEditingNotes(false)
                onUpdateNotes(opportunity.id, notesDraft.trim())
              }
            }}
            className="font-mono"
            style={noteInput}
          />
        ) : (
          <button
            type="button"
            className="font-mono"
            onClick={() => setEditingNotes(true)}
            style={{ ...noteInput, textAlign: 'left', cursor: 'text' }}
          >
            {opportunity.notes?.trim() || 'Notiz hinzufügen …'}
          </button>
        )}
      </div>
    </div>
  )
}

const noteInput: React.CSSProperties = {
  width: '100%',
  minHeight: 30,
  borderRadius: 8,
  border: '1px solid var(--glass-border-2)',
  background: 'var(--glass-2)',
  color: 'var(--text-primary)',
  fontSize: 11,
  padding: '7px 9px',
}
