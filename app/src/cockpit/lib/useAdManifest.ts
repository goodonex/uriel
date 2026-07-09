import { useCallback, useEffect, useRef, useState } from 'react'
import { useToast } from '../../components/Toast'
import type { AdManifest, AdStatus } from './adsApi'
import { fetchAdManifest, putAdManifest, seedReview } from './adsApi'

const PUT_DEBOUNCE_MS = 600

/**
 * Manifest-Hook fürs Ads-Review: optimistische Mutationen im State,
 * debounced PUT an den Runner. 409 (extern geändert, z.B. Claude-Session)
 * → Disk-Stand übernehmen + Toast. Refetch bei Window-Focus.
 */
export function useAdManifest(slug: string | undefined) {
  const { show } = useToast()
  const [manifest, setManifest] = useState<AdManifest | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // baseUpdatedAt = Disk-Stand, auf dem der aktuelle State basiert (Konflikt-Guard).
  const baseUpdatedAt = useRef<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pending = useRef<AdManifest | null>(null)
  const inFlight = useRef(false)
  const slugRef = useRef(slug)
  slugRef.current = slug

  const adopt = useCallback((m: AdManifest) => {
    baseUpdatedAt.current = m.updatedAt ?? null
    setManifest(m)
  }, [])

  const reload = useCallback(async (reset = false) => {
    if (!slugRef.current) return
    // Niemals über ungespeicherte oder gerade fliegende Änderungen drüberladen —
    // sonst ersetzt ein Refetch den State mit dem alten Disk-Stand, während der
    // PUT noch unterwegs ist, und der nächste Save schreibt den Rückstand fest.
    if (pending.current || inFlight.current) return
    if (reset) {
      setLoading(true)
      setManifest(null)
    }
    try {
      adopt(await fetchAdManifest(slugRef.current))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [adopt])

  const flush = useCallback(async () => {
    const m = pending.current
    const s = slugRef.current
    if (!m || !s) return
    pending.current = null
    inFlight.current = true
    try {
      const { updatedAt } = await putAdManifest(s, m, baseUpdatedAt.current)
      baseUpdatedAt.current = updatedAt
      // Disk entspricht jetzt exakt m — State darauf heilen, falls ihn
      // zwischenzeitlich etwas anderes (z.B. ein Refetch) ersetzt hat.
      setManifest((cur) => (pending.current ? cur : m))
    } catch (e) {
      const err = e as Error & { status?: number; body?: { current?: AdManifest } }
      if (err.status === 409 && err.body?.current) {
        adopt(err.body.current)
        show('Manifest wurde extern geändert — Stand neu geladen.', 'error')
      } else {
        show(`Speichern fehlgeschlagen: ${err.message}`, 'error')
      }
    } finally {
      inFlight.current = false
    }
  }, [adopt, show])

  /** Optimistisch mutieren + debounced persistieren. */
  const mutate = useCallback(
    (fn: (m: AdManifest) => AdManifest) => {
      setManifest((cur) => {
        if (!cur) return cur
        const next = fn(cur)
        pending.current = next
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => void flush(), PUT_DEBOUNCE_MS)
        return next
      })
    },
    [flush],
  )

  useEffect(() => {
    void reload(true)
  }, [reload, slug])

  // Claude-Edits an ads.json sollen beim Zurück-Tabben sichtbar werden —
  // reload() selbst schützt sich vor ungespeicherten/fliegenden Änderungen.
  useEffect(() => {
    const onFocus = () => void reload()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [reload])

  // Ausstehende Änderungen beim Unmount/Tab-Schließen noch rausschreiben.
  useEffect(() => {
    const onUnload = () => void flush()
    window.addEventListener('beforeunload', onUnload)
    return () => {
      window.removeEventListener('beforeunload', onUnload)
      if (timer.current) clearTimeout(timer.current)
      void flush()
    }
  }, [flush])

  const toggleCheck = useCallback(
    (adId: string, v: number, kind: 'design' | 'copy', itemId: string) => {
      mutate((m) => ({
        ...m,
        ads: m.ads.map((ad) =>
          ad.id !== adId
            ? ad
            : {
                ...ad,
                versions: ad.versions.map((ver) => {
                  if (ver.v !== v) return ver
                  const review = ver.review ?? seedReview()
                  return {
                    ...ver,
                    review: {
                      ...review,
                      [kind]: review[kind].map((c) =>
                        c.id === itemId ? { ...c, done: !c.done } : c,
                      ),
                    },
                  }
                }),
              },
        ),
      }))
    },
    [mutate],
  )

  const addNote = useCallback(
    (adId: string, v: number, text: string) => {
      const trimmed = text.trim()
      if (!trimmed) return
      mutate((m) => ({
        ...m,
        ads: m.ads.map((ad) =>
          ad.id !== adId
            ? ad
            : {
                ...ad,
                versions: ad.versions.map((ver) =>
                  ver.v !== v
                    ? ver
                    : { ...ver, notes: [...(ver.notes ?? []), { at: new Date().toISOString(), text: trimmed }] },
                ),
              },
        ),
      }))
    },
    [mutate],
  )

  const setStatus = useCallback(
    (adId: string, status: AdStatus) => {
      mutate((m) => ({
        ...m,
        ads: m.ads.map((ad) => (ad.id === adId ? { ...ad, status } : ad)),
      }))
    },
    [mutate],
  )

  return { manifest, loading, error, reload, toggleCheck, addNote, setStatus }
}
