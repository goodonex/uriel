import type { Contact, PipelineStage } from '../../types/db'
import { contactCardTitle } from '../../lib/pipelineContactSort'

const STAGE_LABEL: Record<PipelineStage, string> = {
  first_contact: 'Erstkontakt',
  conversation: 'Gespräch',
  proposal: 'Pitch',
  deal: 'Deal',
  paused: 'Pause',
}

function isFollowUpOverdue(contact: Contact): boolean {
  if (!contact.next_follow_up_at) return false
  if (contact.pipeline_stage === 'deal' || contact.pipeline_stage === 'paused') return false
  const ymd = contact.next_follow_up_at.slice(0, 10)
  const t = new Date()
  const today = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
  return ymd <= today
}

function formatFollowUp(iso: string | null): string {
  if (!iso) return '—'
  const d = iso.slice(0, 10).split('-')
  if (d.length !== 3) return iso.slice(0, 10)
  return `${d[2]}.${d[1]}.${d[0]}`
}

export function PipelineListView({
  contacts,
  onOpen,
}: {
  contacts: Contact[]
  onOpen: (id: string) => void
}) {
  if (contacts.length === 0) {
    return (
      <p className="font-mono py-8 text-center" style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
        Keine Leads für die aktuelle Filterung.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {contacts.map((c) => {
        const overdue = isFollowUpOverdue(c)
        const subtitle =
          c.company?.trim() ||
          c.email?.trim() ||
          c.phone?.trim() ||
          '—'
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onOpen(c.id)}
            className="glass-2 font-mono flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left"
            style={{
              border: overdue
                ? '1px solid var(--accent-coral)'
                : '1px solid var(--glass-border-1)',
              cursor: 'pointer',
            }}
          >
            <div className="min-w-0 flex-1">
              <div
                className="font-display truncate"
                style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}
              >
                {contactCardTitle(c)}
              </div>
              <div
                className="truncate"
                style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}
              >
                {subtitle}
              </div>
              <div
                className="mt-1.5 flex flex-wrap gap-2"
                style={{ fontSize: 10, color: 'var(--text-tertiary)' }}
              >
                <span>{STAGE_LABEL[c.pipeline_stage]}</span>
                <span>·</span>
                <span>FU {formatFollowUp(c.next_follow_up_at)}</span>
              </div>
            </div>
            {overdue ? (
              <span
                style={{
                  fontSize: 9,
                  padding: '4px 8px',
                  borderRadius: 999,
                  background: 'var(--accent-coral)',
                  color: '#fff',
                  flexShrink: 0,
                }}
              >
                Überfällig
              </span>
            ) : (
              <span style={{ fontSize: 14, color: 'var(--text-tertiary)', flexShrink: 0 }}>→</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
