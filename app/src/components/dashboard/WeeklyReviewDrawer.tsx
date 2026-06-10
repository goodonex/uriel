import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useWeeklyReview } from '../../hooks/useWeeklyReview'
import { useToast } from '../Toast'

interface WeeklyReviewDrawerProps {
  open: boolean
  onClose: () => void
  brandSlug: string
}

function fmtEuro(n: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n)
}

export function WeeklyReviewDrawer({ open, onClose, brandSlug }: WeeklyReviewDrawerProps) {
  const review = useWeeklyReview(brandSlug)
  const { show } = useToast()
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (open) {
      setNotes(review.current?.notes ?? '')
    }
  }, [open, review.current?.notes])

  const handleComplete = async () => {
    await review.complete(notes)
    show('Wochen-Review gespeichert', 'success')
    onClose()
  }

  const s = review.autoSnapshot

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
              maxWidth: 520,
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
                  WOCHEN-REVIEW · 15 MIN
                </div>
                <div className="font-display" style={{ fontSize: 16, fontWeight: 600 }}>
                  Freitags-Check
                </div>
              </div>
              <button type="button" onClick={onClose} className="font-mono" style={escBtn}>
                Esc
              </button>
            </header>

            <div style={{ padding: 18, flex: 1, overflowY: 'auto' }}>
              {review.loading ? (
                <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Lade…</p>
              ) : (
                <>
                  <ReviewBlock title="Neue Kunden + Produkt">
                    {s.newCustomers.length === 0 ? (
                      <span>Keine Abschlüsse diese Woche</span>
                    ) : (
                      <ul style={{ margin: 0, paddingLeft: 18 }}>
                        {s.newCustomers.map((c, i) => (
                          <li key={`${c.name}-${i}`}>
                            {c.name} · {c.product}
                          </li>
                        ))}
                      </ul>
                    )}
                  </ReviewBlock>

                  <ReviewBlock title="Neuer Umsatz">
                    {fmtEuro(s.projectRevenue)} Projekt · {fmtEuro(s.newMrr)} MRR neu
                  </ReviewBlock>

                  <ReviewBlock title="Conversion">
                    {s.conversations} Gespräche → {s.pitches} Pitches → {s.deals} Abschlüsse
                  </ReviewBlock>

                  <ReviewBlock title="Content">
                    YouTube: {s.youtubePublished ? 'Video raus' : 'noch nicht'} · LinkedIn:{' '}
                    {s.linkedinPosts} Posts
                  </ReviewBlock>

                  <ReviewBlock title="Lead-Qualität / Churn-Vorwarnung">
                    {s.badLeads} schlechte Leads · {s.churnWarnings} Churn-Signale
                    {s.churnWarnings > 0 ? (
                      <div style={{ color: 'var(--accent-coral)', marginTop: 4 }}>
                        Retainer-Kunden prüfen
                      </div>
                    ) : null}
                  </ReviewBlock>

                  <div style={{ marginTop: 18 }}>
                    <div
                      className="font-mono"
                      style={{
                        fontSize: 10,
                        letterSpacing: '0.12em',
                        color: 'var(--text-tertiary)',
                        marginBottom: 6,
                      }}
                    >
                      NOTIZEN
                    </div>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={4}
                      placeholder="Was nimmst du mit? Was änderst du nächste Woche?"
                      style={{
                        width: '100%',
                        padding: 10,
                        borderRadius: 8,
                        border: '1px solid var(--glass-border-2)',
                        background: 'var(--glass-1)',
                        color: 'var(--text-primary)',
                        fontSize: 13,
                        resize: 'vertical',
                        outline: 'none',
                      }}
                    />
                  </div>
                </>
              )}
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
              <button type="button" onClick={() => void handleComplete()} className="font-mono" style={saveBtn}>
                Review abschließen
              </button>
            </footer>
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

function ReviewBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        marginBottom: 14,
        padding: 12,
        borderRadius: 10,
        border: '1px solid var(--glass-border-1)',
        background: 'var(--glass-1)',
        fontSize: 12,
        color: 'var(--text-secondary)',
      }}
    >
      <div
        className="font-mono"
        style={{ fontSize: 9, letterSpacing: '0.12em', color: 'var(--text-tertiary)', marginBottom: 6 }}
      >
        {title.toUpperCase()}
      </div>
      {children}
    </div>
  )
}

const escBtn: React.CSSProperties = {
  fontSize: 11,
  padding: '5px 10px',
  borderRadius: 7,
  border: '1px solid var(--glass-border-2)',
  background: 'transparent',
  color: 'var(--text-tertiary)',
  cursor: 'pointer',
}

const saveBtn: React.CSSProperties = {
  fontSize: 11,
  padding: '7px 14px',
  borderRadius: 8,
  border: '1px solid var(--mode-sales)',
  background: 'color-mix(in srgb, var(--mode-sales) 22%, transparent)',
  color: 'var(--mode-sales)',
  fontWeight: 600,
  cursor: 'pointer',
}
