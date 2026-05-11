import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'

export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export interface SaveStatusContextValue {
  state: SaveState
  lastSavedAt: number | null
  errorMessage: string | null
  /** Start eines Speichervorgangs registrieren. Returnt eine Funktion zum Abschluss. */
  begin: () => (ok?: boolean, errorMessage?: string) => void
  /** Direkt einen sofortigen Save markieren (für Bookmarking ohne async). */
  markSaved: () => void
}

const noopEnd = () => {
  /* noop */
}

const DEFAULT: SaveStatusContextValue = {
  state: 'idle',
  lastSavedAt: null,
  errorMessage: null,
  begin: () => noopEnd,
  markSaved: () => {
    /* noop */
  },
}

const SaveStatusContext = createContext<SaveStatusContextValue>(DEFAULT)

export function SaveStatusProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SaveState>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const inflightRef = useRef(0)
  const fadeTimeoutRef = useRef<number | null>(null)

  const clearFadeTimeout = () => {
    if (fadeTimeoutRef.current) {
      window.clearTimeout(fadeTimeoutRef.current)
      fadeTimeoutRef.current = null
    }
  }

  const begin = useCallback(() => {
    inflightRef.current += 1
    setState('saving')
    setErrorMessage(null)
    clearFadeTimeout()

    let closed = false
    return (ok: boolean = true, msg?: string) => {
      if (closed) return
      closed = true
      inflightRef.current = Math.max(0, inflightRef.current - 1)
      if (!ok) {
        setState('error')
        setErrorMessage(msg ?? 'Fehler beim Speichern')
        return
      }
      if (inflightRef.current === 0) {
        setState('saved')
        setLastSavedAt(Date.now())
        clearFadeTimeout()
        fadeTimeoutRef.current = window.setTimeout(() => {
          setState((cur) => (cur === 'saved' ? 'idle' : cur))
        }, 2400)
      }
    }
  }, [])

  const markSaved = useCallback(() => {
    setState('saved')
    setLastSavedAt(Date.now())
    setErrorMessage(null)
    clearFadeTimeout()
    fadeTimeoutRef.current = window.setTimeout(() => {
      setState((cur) => (cur === 'saved' ? 'idle' : cur))
    }, 2400)
  }, [])

  const value = useMemo<SaveStatusContextValue>(
    () => ({ state, lastSavedAt, errorMessage, begin, markSaved }),
    [state, lastSavedAt, errorMessage, begin, markSaved],
  )

  return <SaveStatusContext.Provider value={value}>{children}</SaveStatusContext.Provider>
}

export function useSaveStatus(): SaveStatusContextValue {
  return useContext(SaveStatusContext)
}
