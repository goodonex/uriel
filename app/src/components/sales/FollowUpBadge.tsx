import type { Contact, FollowUpType } from '../../types/db'

const TYPE_LABEL: Record<FollowUpType, string> = {
  '': 'Follow-up',
  call: 'Anruf',
  meeting: 'Meeting',
  email: 'E-Mail',
  other: 'Sonstiges',
}

function fmtFollowUp(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString('de-DE', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso.slice(0, 16)
  }
}

function followUpTone(iso: string | null): 'ok' | 'due' | 'overdue' {
  if (!iso) return 'ok'
  const due = iso.slice(0, 10)
  const t = new Date()
  const today = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
  if (due < today) return 'overdue'
  if (due === today) return 'due'
  return 'ok'
}

const TONE_COLOR = {
  ok: '#4ade80',
  due: 'var(--accent-amber)',
  overdue: 'var(--accent-coral)',
} as const

export function FollowUpBadge({
  contact,
  onClick,
}: {
  contact: Contact
  onClick?: () => void
}) {
  if (!contact.next_follow_up_at) return null
  const tone = followUpTone(contact.next_follow_up_at)
  const typeLabel = TYPE_LABEL[contact.follow_up_type ?? ''] ?? 'Follow-up'
  return (
    <button
      type="button"
      onClick={onClick}
      className="font-mono text-left"
      style={{
        fontSize: 12,
        fontWeight: 600,
        padding: '8px 12px',
        borderRadius: 10,
        border: `1px solid color-mix(in srgb, ${TONE_COLOR[tone]} 50%, transparent)`,
        background: `color-mix(in srgb, ${TONE_COLOR[tone]} 14%, var(--glass-1))`,
        color: TONE_COLOR[tone],
        cursor: onClick ? 'pointer' : 'default',
        width: 'fit-content',
      }}
    >
      Nächster FU: {fmtFollowUp(contact.next_follow_up_at)} — {typeLabel}
    </button>
  )
}
