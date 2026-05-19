import { useCallback, useEffect, useMemo, useState } from 'react'
import { useContacts } from '../../hooks/useContacts'
import { usePostCallFlow } from '../../hooks/usePostCallFlow'
import { useCallLogs } from '../../hooks/useSalesPro'
import { generateId } from '../../lib/storage'
import type {
  ContactActivityEntry,
  FollowUpType,
  PipelineStage,
  SalesCallOutcome,
} from '../../types/db'

export type PostCallResult =
  | 'not_reached'
  | 'no_interest'
  | 'conversation'
  | 'meeting'
  | 'offer_requested'

const RESULTS: Array<{ key: PostCallResult; label: string }> = [
  { key: 'not_reached', label: 'Nicht erreicht' },
  { key: 'no_interest', label: 'Erreicht — kein Interesse' },
  { key: 'conversation', label: 'Erreicht — Gespräch geführt' },
  { key: 'meeting', label: 'Termin vereinbart' },
  { key: 'offer_requested', label: 'Angebot angefragt' },
]

const FU_TYPES: Array<{ key: FollowUpType; label: string }> = [
  { key: 'call', label: 'Anruf' },
  { key: 'meeting', label: 'Termin' },
  { key: 'email', label: 'E-Mail' },
  { key: 'other', label: 'Sonstiges' },
]

function mapOutcome(result: PostCallResult): SalesCallOutcome {
  if (result === 'not_reached') return 'no_pickup'
  return 'connected'
}

function defaultStage(result: PostCallResult): PipelineStage | null {
  if (result === 'meeting') return 'conversation'
  if (result === 'offer_requested') return 'proposal'
  return null
}

function ymdTomorrow(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function defaultTime(): string {
  return '10:00'
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 9,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'var(--text-tertiary)',
  marginBottom: 6,
}

const inputStyle: React.CSSProperties = {
  fontSize: 12,
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid var(--glass-border-2)',
  background: 'var(--glass-1)',
  color: 'var(--text-primary)',
}

const btnPrimary: React.CSSProperties = {
  fontSize: 12,
  padding: '10px 16px',
  borderRadius: 10,
  border: '1px solid var(--mode-sales)',
  background: 'color-mix(in srgb, var(--mode-sales) 18%, transparent)',
  color: 'var(--mode-sales)',
  cursor: 'pointer',
  fontWeight: 600,
}

const btnGhost: React.CSSProperties = {
  fontSize: 12,
  padding: '10px 16px',
  borderRadius: 10,
  border: '1px solid var(--glass-border-2)',
  background: 'transparent',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
}

export function PostCallModal({ brandSlug }: { brandSlug: string }) {
  const { session, closePostCall, advanceQueue } = usePostCallFlow()
  const contacts = useContacts(brandSlug)
  const calls = useCallLogs(brandSlug)

  const contact = useMemo(
    () => (session ? contacts.items.find((c) => c.id === session.contactId) ?? null : null),
    [contacts.items, session],
  )

  const [result, setResult] = useState<PostCallResult>('conversation')
  const [fuDate, setFuDate] = useState(ymdTomorrow())
  const [fuTime, setFuTime] = useState(defaultTime())
  const [fuType, setFuType] = useState<FollowUpType>('call')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!session) return
    setResult('conversation')
    setFuDate(ymdTomorrow())
    setFuTime(defaultTime())
    setFuType('call')
    setNote('')
  }, [session?.contactId, session])

  useEffect(() => {
    if (result === 'meeting') {
      setFuType('meeting')
      const d = new Date()
      d.setDate(d.getDate() + 3)
      setFuDate(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      )
    }
  }, [result])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && session) closePostCall()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [session, closePostCall])

  const persist = useCallback(
    async (andContinue: boolean) => {
      if (!session || !contact) return
      setSaving(true)
      try {
        const outcome = mapOutcome(result)
        const noteText = note.trim()
        await calls.log({
          contact_id: contact.id,
          outcome,
          notes: noteText,
        })

        const patch: Partial<typeof contact> = {
          last_contact_at: new Date().toISOString(),
        }

        const stage = defaultStage(result)
        if (stage) patch.pipeline_stage = stage

        if (fuDate.trim()) {
          const iso = new Date(`${fuDate}T${fuTime || '12:00'}:00`).toISOString()
          patch.next_follow_up_at = iso
          patch.follow_up_type = fuType
        }

        const activityEntries: ContactActivityEntry[] = [...(contact.activity_log ?? [])]
        const summary = RESULTS.find((r) => r.key === result)?.label ?? 'Anruf'
        let activityText = `☎ ${summary}`
        if (noteText) activityText += ` · ${noteText}`
        activityEntries.unshift({
          id: generateId(),
          text: activityText,
          at: new Date().toISOString(),
        })
        patch.activity_log = activityEntries

        contacts.update(contact.id, patch)

        if (andContinue && session.queue?.length) {
          const next = advanceQueue()
          if (!next) closePostCall()
        } else {
          closePostCall()
        }
      } finally {
        setSaving(false)
      }
    },
    [
      session,
      contact,
      result,
      note,
      fuDate,
      fuTime,
      fuType,
      calls,
      contacts,
      advanceQueue,
      closePostCall,
    ],
  )

  if (!session || !contact) return null

  const hasQueue = Boolean(session.queue?.length)

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 90,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        pointerEvents: 'auto',
      }}
      onClick={() => closePostCall()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="glass-2 font-mono"
        style={{
          width: 'min(420px, 100%)',
          borderRadius: 16,
          border: '1px solid var(--glass-border-2)',
          padding: 20,
          boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          className="font-display"
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: 16,
          }}
        >
          Anruf dokumentiert ✓
        </h2>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Ergebnis</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {RESULTS.map((r) => (
              <label
                key={r.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="radio"
                  name="post-call-result"
                  checked={result === r.key}
                  onChange={() => setResult(r.key)}
                />
                {r.label}
              </label>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Nächster Schritt</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <input type="date" value={fuDate} onChange={(e) => setFuDate(e.target.value)} style={inputStyle} />
            <input type="time" value={fuTime} onChange={(e) => setFuTime(e.target.value)} style={inputStyle} />
            <select value={fuType} onChange={(e) => setFuType(e.target.value as FollowUpType)} style={inputStyle}>
              {FU_TYPES.map((t) => (
                <option key={t.key || 'empty'} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Notiz (optional)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Kurznotiz …"
            style={{ ...inputStyle, width: '100%', resize: 'vertical' }}
          />
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button
            type="button"
            disabled={saving}
            onClick={() => void persist(true)}
            style={btnPrimary}
          >
            {saving ? 'Speichert …' : hasQueue ? 'Speichern & weiter' : 'Speichern'}
          </button>
          <button type="button" disabled={saving} onClick={() => void persist(false)} style={btnGhost}>
            Schließen
          </button>
        </div>
      </div>
    </div>
  )
}