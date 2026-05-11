import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useSalesGoals } from '../../hooks/useSalesPro'
import { useToast } from '../Toast'

interface SalesGoalsDrawerProps {
  open: boolean
  onClose: () => void
  brandSlug: string
}

export function SalesGoalsDrawer({ open, onClose, brandSlug }: SalesGoalsDrawerProps) {
  const goals = useSalesGoals(brandSlug, 'week')
  const { show } = useToast()
  const [draft, setDraft] = useState({
    calls: 0,
    mails: 0,
    linkedin: 0,
    qualifications: 0,
    meetings: 0,
    deals: 0,
  })

  useEffect(() => {
    if (!open) return
    setDraft({
      calls: goals.current?.calls_target ?? 0,
      mails: goals.current?.mails_target ?? 0,
      linkedin: goals.current?.linkedin_target ?? 0,
      qualifications: goals.current?.qualifications_target ?? 0,
      meetings: goals.current?.meetings_target ?? 0,
      deals: goals.current?.deals_target ?? 0,
    })
  }, [open, goals.current])

  const handleSave = async () => {
    await goals.upsert({
      calls_target: draft.calls,
      mails_target: draft.mails,
      linkedin_target: draft.linkedin,
      qualifications_target: draft.qualifications,
      meetings_target: draft.meetings,
      deals_target: draft.deals,
    })
    show('Wochen-Ziele gespeichert', 'success')
    onClose()
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[80]"
          style={{ background: 'rgba(8,12,22,0.55)', backdropFilter: 'blur(8px)' }}
        >
          <motion.aside
            initial={{ x: 480 }}
            animate={{ x: 0 }}
            exit={{ x: 480 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="font-body"
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              bottom: 0,
              width: '100%',
              maxWidth: 460,
              background: 'rgba(18,18,22,0.96)',
              borderLeft: '1px solid var(--glass-border-2)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <header
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--glass-border-1)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
              }}
            >
              <div>
                <div
                  className="font-mono"
                  style={{ fontSize: 9, letterSpacing: '0.14em', color: 'var(--text-tertiary)' }}
                >
                  SALES · WOCHEN-ZIELE
                </div>
                <div className="font-display" style={{ fontSize: 16, fontWeight: 600 }}>
                  Diese Woche
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="font-mono"
                style={{
                  fontSize: 11,
                  padding: '5px 10px',
                  borderRadius: 7,
                  border: '1px solid var(--glass-border-2)',
                  background: 'transparent',
                  color: 'var(--text-tertiary)',
                  cursor: 'pointer',
                }}
              >
                Esc
              </button>
            </header>

            <div style={{ padding: 18, flex: 1, overflowY: 'auto' }}>
              <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 18 }}>
                Setze realistische Wochenziele. Im Brand-Dashboard siehst du den Fortschritt live.
              </p>
              <NumField
                label="Anrufe"
                value={draft.calls}
                onChange={(v) => setDraft((d) => ({ ...d, calls: v }))}
              />
              <NumField
                label="E-Mails"
                value={draft.mails}
                onChange={(v) => setDraft((d) => ({ ...d, mails: v }))}
              />
              <NumField
                label="LinkedIn-Nachrichten"
                value={draft.linkedin}
                onChange={(v) => setDraft((d) => ({ ...d, linkedin: v }))}
              />
              <NumField
                label="Qualifizierungen"
                value={draft.qualifications}
                onChange={(v) => setDraft((d) => ({ ...d, qualifications: v }))}
              />
              <NumField
                label="Erstgespräche"
                value={draft.meetings}
                onChange={(v) => setDraft((d) => ({ ...d, meetings: v }))}
              />
              <NumField
                label="Abschlüsse"
                value={draft.deals}
                onChange={(v) => setDraft((d) => ({ ...d, deals: v }))}
              />
            </div>

            <footer
              style={{
                padding: '12px 16px',
                borderTop: '1px solid var(--glass-border-1)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 8,
              }}
            >
              <button
                type="button"
                onClick={() => void handleSave()}
                className="font-mono"
                style={{
                  fontSize: 11,
                  padding: '7px 14px',
                  borderRadius: 8,
                  border: '1px solid var(--mode-sales)',
                  background: 'color-mix(in srgb, var(--mode-sales) 22%, transparent)',
                  color: 'var(--mode-sales)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Speichern
              </button>
            </footer>
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div
        className="font-mono"
        style={{
          fontSize: 10,
          letterSpacing: '0.12em',
          color: 'var(--text-tertiary)',
          marginBottom: 4,
        }}
      >
        {label.toUpperCase()}
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <button
          type="button"
          onClick={() => onChange(Math.max(0, value - 1))}
          className="font-mono"
          style={btnStyle}
        >
          −
        </button>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
          style={{
            flex: 1,
            textAlign: 'center',
            padding: '8px 10px',
            border: '1px solid var(--glass-border-2)',
            background: 'var(--glass-1)',
            color: 'var(--text-primary)',
            fontSize: 16,
            fontWeight: 600,
            borderRadius: 8,
            outline: 'none',
          }}
        />
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          className="font-mono"
          style={btnStyle}
        >
          +
        </button>
      </div>
    </div>
  )
}

const btnStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  fontSize: 18,
  borderRadius: 8,
  border: '1px solid var(--glass-border-2)',
  background: 'var(--glass-1)',
  color: 'var(--text-primary)',
  cursor: 'pointer',
}
