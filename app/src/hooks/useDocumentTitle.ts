import { useEffect } from 'react'

const DEFAULT_TITLE = 'Brand OS'

/**
 * Setzt `document.title` deklarativ und stellt beim Unmount den Default wieder her.
 * Falsy-Werte werden zu Brand OS.
 */
export function useDocumentTitle(parts: Array<string | null | undefined>): void {
  useEffect(() => {
    const clean = parts
      .map((p) => (typeof p === 'string' ? p.trim() : ''))
      .filter((p) => p.length > 0)

    const next = clean.length > 0 ? `${clean.join(' · ')} — ${DEFAULT_TITLE}` : DEFAULT_TITLE
    const prev = document.title
    document.title = next
    return () => {
      document.title = prev
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parts.join('|')])
}
