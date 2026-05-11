/**
 * ContactSequencesPanel — Anzeigen + Verwalten der Mail-Flow-Enrollments
 * eines einzelnen Kontakts.
 */
import { useState, type CSSProperties } from 'react'
import { useEmailSequences, useEnrollments } from '../../hooks/useEmailSequences'
import { useToast } from '../Toast'

interface ContactSequencesPanelProps {
  brandSlug: string
  contactId: string
}

export function ContactSequencesPanel({ brandSlug, contactId }: ContactSequencesPanelProps) {
  const seqs = useEmailSequences(brandSlug)
  const enrollments = useEnrollments(brandSlug, { contactId })
  const { show } = useToast()
  const [selected, setSelected] = useState<string>('')

  const onEnroll = async () => {
    if (!selected) {
      show('Flow auswählen', 'info')
      return
    }
    const seq = seqs.items.find((s) => s.id === selected)
    if (!seq) return
    if (!seq.active) {
      const ok = window.confirm(
        `Flow „${seq.name}" ist inaktiv — trotzdem einbuchen? (Mails gehen erst nach Aktivierung raus)`,
      )
      if (!ok) return
    }
    const res = await enrollments.enroll(seq.id, contactId)
    show(res ? 'In Flow eingebucht' : 'Fehler beim Einbuchen', res ? 'success' : 'info')
    setSelected('')
  }

  return (
    <section
      style={{
        background: 'var(--glass-1)',
        border: '1px solid var(--glass-border-1)',
        borderRadius: 12,
        padding: 14,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 10,
          gap: 8,
        }}
      >
        <div
          className="font-mono"
          style={{
            fontSize: 9,
            letterSpacing: '0.14em',
            color: 'var(--text-tertiary)',
          }}
        >
          MAIL-FLOWS
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="font-mono"
            style={selectStyle}
          >
            <option value="">— Flow wählen —</option>
            {seqs.items.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.active ? '' : ' (inaktiv)'}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={onEnroll}
            disabled={!selected}
            className="font-mono"
            style={{
              fontSize: 10,
              padding: '6px 10px',
              borderRadius: 7,
              border: '1px solid var(--mode-promo)',
              background: 'color-mix(in srgb, var(--mode-promo) 18%, transparent)',
              color: 'var(--mode-promo)',
              cursor: selected ? 'pointer' : 'not-allowed',
              opacity: selected ? 1 : 0.5,
              fontWeight: 600,
            }}
          >
            + Einbuchen
          </button>
        </div>
      </div>

      {enrollments.items.length === 0 ? (
        <div
          style={{
            padding: 12,
            border: '1px dashed var(--glass-border-2)',
            borderRadius: 9,
            fontSize: 11,
            color: 'var(--text-tertiary)',
            textAlign: 'center',
          }}
        >
          Kontakt ist in keinem Flow.
        </div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {enrollments.items.map((e) => {
            const seq = seqs.items.find((s) => s.id === e.sequence_id)
            const isActive = e.status === 'active'
            return (
              <li
                key={e.id}
                style={{
                  padding: '8px 10px',
                  background: 'var(--glass-2)',
                  border: '1px solid var(--glass-border-2)',
                  borderRadius: 9,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--text-primary)',
                      fontWeight: 500,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {seq?.name ?? 'Flow gelöscht'}
                  </div>
                  <div
                    className="font-mono"
                    style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}
                  >
                    {e.status.toUpperCase()} · Schritt: {e.current_node_id} · Nächster Lauf:{' '}
                    {new Date(e.next_run_at).toLocaleString('de-DE', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    type="button"
                    onClick={() =>
                      enrollments.setStatus(e.id, isActive ? 'paused' : 'active')
                    }
                    className="font-mono"
                    style={smallBtn(isActive ? 'var(--text-tertiary)' : 'var(--accent-teal)')}
                  >
                    {isActive ? 'Pause' : 'Start'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!window.confirm('Aus Flow entfernen?')) return
                      void enrollments.remove(e.id)
                    }}
                    className="font-mono"
                    style={smallBtn('var(--accent-coral)')}
                  >
                    ×
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

const selectStyle: CSSProperties = {
  fontSize: 11,
  padding: '6px 9px',
  borderRadius: 7,
  border: '1px solid var(--glass-border-2)',
  background: 'var(--glass-2)',
  color: 'var(--text-primary)',
  outline: 'none',
  maxWidth: 200,
}

function smallBtn(color: string): CSSProperties {
  return {
    fontSize: 10,
    padding: '4px 8px',
    borderRadius: 6,
    border: `1px solid ${color}`,
    background: `color-mix(in srgb, ${color} 14%, transparent)`,
    color,
    cursor: 'pointer',
  }
}
