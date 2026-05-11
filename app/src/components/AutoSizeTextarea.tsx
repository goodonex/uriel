import { useEffect, useRef, type TextareaHTMLAttributes } from 'react'

type AutoSizeTextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> & {
  value: string
  onChange: (v: string) => void
  /** Mindesthöhe in Pixeln. Default 48. */
  minHeight?: number
  /** Maximalhöhe in Pixeln (danach wird gescrollt). Default 720 — praktisch unbegrenzt. */
  maxHeight?: number
}

/**
 * Textarea, deren Höhe sich automatisch dem Inhalt anpasst.
 *
 * Kein Resize-Handle, kein klein-scrollbares Feld — der Inhalt wächst mit
 * dem Text. Verwendet `field-sizing: content` (modern), fällt auf
 * scrollHeight-Berechnung zurück.
 */
export function AutoSizeTextarea({
  value,
  onChange,
  minHeight = 48,
  maxHeight = 720,
  style,
  ...rest
}: AutoSizeTextareaProps) {
  const ref = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    const next = Math.min(Math.max(el.scrollHeight, minHeight), maxHeight)
    el.style.height = `${next}px`
  }, [value, minHeight, maxHeight])

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        resize: 'none',
        overflow: 'hidden',
        minHeight,
        maxHeight,
        ...style,
      }}
      {...rest}
    />
  )
}
