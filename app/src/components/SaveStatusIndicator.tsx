import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useSaveStatus } from '../lib/saveStatusContext'

function formatRelative(ts: number, nowMs: number): string {
  const diff = Math.max(0, nowMs - ts)
  const sec = Math.round(diff / 1000)
  if (sec < 5) return 'gerade eben'
  if (sec < 60) return `vor ${sec}s`
  const min = Math.round(sec / 60)
  if (min < 60) return `vor ${min}m`
  const hours = Math.round(min / 60)
  if (hours < 24) return `vor ${hours}h`
  const days = Math.round(hours / 24)
  return `vor ${days}d`
}

export function SaveStatusIndicator() {
  const { state, lastSavedAt, errorMessage } = useSaveStatus()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (state === 'idle' && !lastSavedAt) return
    const id = window.setInterval(() => setNow(Date.now()), 30000)
    return () => window.clearInterval(id)
  }, [state, lastSavedAt])

  let visible = state !== 'idle'
  let label = ''
  let dotColor = 'rgba(255,255,255,0.6)'
  let textColor = 'rgba(255,255,255,0.78)'
  let borderColor = 'rgba(255,255,255,0.10)'
  let bg = 'rgba(20, 22, 26, 0.78)'
  let spinning = false

  if (state === 'saving') {
    label = 'Speichert …'
    dotColor = 'var(--brand-accent, var(--accent-teal, #5EE7C8))'
    spinning = true
  } else if (state === 'saved') {
    label = lastSavedAt ? `Gespeichert · ${formatRelative(lastSavedAt, now)}` : 'Gespeichert'
    dotColor = 'var(--brand-accent, var(--accent-teal, #5EE7C8))'
    textColor = 'rgba(255,255,255,0.85)'
    borderColor = 'color-mix(in srgb, var(--brand-accent, var(--accent-teal)) 35%, transparent)'
    bg = 'rgba(15, 22, 24, 0.86)'
  } else if (state === 'error') {
    label = errorMessage ?? 'Fehler beim Speichern'
    dotColor = 'var(--accent-coral, #FF6E6E)'
    textColor = 'rgba(255, 200, 200, 0.95)'
    borderColor = 'rgba(255, 110, 110, 0.35)'
    bg = 'rgba(40, 15, 15, 0.82)'
    visible = true
  }

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          key="save-status"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.2 }}
          style={{
            position: 'fixed',
            right: 18,
            bottom: 18,
            zIndex: 900,
            pointerEvents: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            borderRadius: 999,
            background: bg,
            border: `1px solid ${borderColor}`,
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            color: textColor,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: 11,
            letterSpacing: 0.2,
            boxShadow: '0 12px 32px rgba(0,0,0,0.32)',
          }}
        >
          <motion.span
            animate={spinning ? { rotate: 360 } : { rotate: 0 }}
            transition={
              spinning
                ? { repeat: Infinity, duration: 1.4, ease: 'linear' }
                : { duration: 0.2 }
            }
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: dotColor,
              boxShadow: `0 0 12px ${dotColor}`,
              display: 'inline-block',
            }}
          />
          <span>{label}</span>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
