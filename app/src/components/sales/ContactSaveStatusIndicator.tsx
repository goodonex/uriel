import { useEffect, useState } from 'react'
import type { ContactSaveState } from '../../hooks/useContactFieldSave'

export function ContactSaveStatusIndicator({ state }: { state: ContactSaveState }) {
  const [showSaved, setShowSaved] = useState(false)

  useEffect(() => {
    if (state === 'saved') {
      setShowSaved(true)
      const handle = window.setTimeout(() => setShowSaved(false), 2000)
      return () => window.clearTimeout(handle)
    }
    setShowSaved(false)
  }, [state])

  if (state === 'idle' && !showSaved) return null

  return (
    <div
      className="font-mono"
      style={{
        fontSize: 10,
        letterSpacing: '0.06em',
        color:
          state === 'error'
            ? 'var(--accent-coral)'
            : showSaved
              ? '#4ade80'
              : 'var(--text-tertiary)',
        minWidth: 120,
        textAlign: 'right',
      }}
    >
      {state === 'saving' ? 'Wird gespeichert...' : null}
      {state === 'error' ? 'Fehler beim Speichern' : null}
      {showSaved && state !== 'saving' && state !== 'error' ? 'Gespeichert' : null}
    </div>
  )
}
