/**
 * Save-Feedback — bewusst leise.
 *   saving  → minimaler pulsierender Dot
 *   saved   → kurzer grüner Glow-Puls, fadet weg (~1.2s)
 *   error   → Coral-Dot + Text (einziger Fall mit Text)
 */
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useSaveStatus } from '../lib/saveStatusContext'

export function SaveStatusIndicator() {
  const { state, lastSavedAt, errorMessage } = useSaveStatus()
  const [showSaved, setShowSaved] = useState(false)

  useEffect(() => {
    if (state === 'saved') {
      setShowSaved(true)
      const handle = window.setTimeout(() => setShowSaved(false), 1200)
      return () => window.clearTimeout(handle)
    }
    return undefined
  }, [state, lastSavedAt])

  return (
    <div
      style={{
        position: 'fixed',
        right: 18,
        bottom: 18,
        zIndex: 900,
        pointerEvents: 'none',
      }}
    >
      <AnimatePresence mode="wait">
        {state === 'error' ? (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.18 }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '7px 12px',
              borderRadius: 999,
              background: 'rgba(40, 15, 15, 0.82)',
              border: '1px solid rgba(255, 110, 110, 0.35)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              color: 'rgba(255, 200, 200, 0.95)',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: 11,
              letterSpacing: 0.2,
              boxShadow: '0 12px 32px rgba(0,0,0,0.32)',
            }}
          >
            <Dot color="var(--accent-coral, #FF6E6E)" />
            <span>{errorMessage ?? 'Fehler beim Speichern'}</span>
          </motion.div>
        ) : state === 'saving' ? (
          <motion.div
            key="saving"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 0.85, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.2 }}
            style={pillStyle}
          >
            <motion.span
              animate={{ scale: [1, 0.65, 1], opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: 'rgba(255,255,255,0.55)',
                display: 'inline-block',
              }}
            />
          </motion.div>
        ) : showSaved ? (
          <motion.div
            key="saved"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            style={pillStyle}
          >
            <SavedPulse />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

function SavedPulse() {
  const color = 'var(--accent-teal, #5EE7C8)'
  return (
    <span style={{ position: 'relative', width: 8, height: 8, display: 'inline-block' }}>
      <motion.span
        initial={{ scale: 0.5, opacity: 0.75 }}
        animate={{ scale: 2.5, opacity: 0 }}
        transition={{ duration: 0.85, ease: 'easeOut' }}
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 999,
          background: color,
        }}
      />
      <span
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 999,
          background: color,
          boxShadow: `0 0 12px ${color}`,
        }}
      />
    </span>
  )
}

function Dot({ color }: { color: string }) {
  return (
    <span
      style={{
        width: 8,
        height: 8,
        borderRadius: 999,
        background: color,
        boxShadow: `0 0 12px ${color}`,
        display: 'inline-block',
      }}
    />
  )
}

const pillStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 8,
  borderRadius: 999,
  background: 'rgba(15, 22, 24, 0.5)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  boxShadow: '0 6px 18px rgba(0,0,0,0.22)',
} as const
