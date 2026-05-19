import { useCallback, useEffect, useRef, useState } from 'react'
import type { Contact } from '../types/db'

export type ContactSaveState = 'idle' | 'saving' | 'saved' | 'error'

const DEBOUNCE_MS = 800
const SAVED_FADE_MS = 2000

export function useContactFieldSave(
  pushPatch: (patch: Partial<Omit<Contact, 'id' | 'brand_id'>>) => void,
) {
  const [state, setState] = useState<ContactSaveState>('idle')
  const timersRef = useRef<Map<string, number>>(new Map())
  const savedFadeRef = useRef<number | null>(null)
  const pushRef = useRef(pushPatch)
  pushRef.current = pushPatch

  useEffect(() => {
    return () => {
      for (const t of timersRef.current.values()) window.clearTimeout(t)
      timersRef.current.clear()
      if (savedFadeRef.current !== null) window.clearTimeout(savedFadeRef.current)
    }
  }, [])

  const scheduleSavedFade = useCallback(() => {
    if (savedFadeRef.current !== null) window.clearTimeout(savedFadeRef.current)
    savedFadeRef.current = window.setTimeout(() => {
      setState((cur) => (cur === 'saved' ? 'idle' : cur))
      savedFadeRef.current = null
    }, SAVED_FADE_MS)
  }, [])

  const onField = useCallback(
    (patch: Partial<Omit<Contact, 'id' | 'brand_id'>>, fieldKey: string) => {
      setState('saving')
      const prev = timersRef.current.get(fieldKey)
      if (prev !== undefined) window.clearTimeout(prev)
      const handle = window.setTimeout(() => {
        timersRef.current.delete(fieldKey)
        try {
          pushRef.current(patch)
          setState('saved')
          scheduleSavedFade()
        } catch {
          setState('error')
        }
      }, DEBOUNCE_MS)
      timersRef.current.set(fieldKey, handle)
    },
    [scheduleSavedFade],
  )

  const markError = useCallback(() => setState('error'), [])
  const markSaved = useCallback(() => {
    setState('saved')
    scheduleSavedFade()
  }, [scheduleSavedFade])

  return { state, onField, markError, markSaved }
}
