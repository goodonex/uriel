import { useState } from 'react'
import { useToast } from '../Toast'

const STORAGE_PREFIX = 'bcc-hint-dismissed:'

export function ContactBccHint({ brandSlug }: { brandSlug: string }) {
  const toast = useToast()
  const key = `${STORAGE_PREFIX}${brandSlug}`
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(key) === '1'
    } catch {
      return false
    }
  })

  if (dismissed) return null

  const address = `leads+${brandSlug}@frameworkos.de`

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address)
      toast.show('BCC-Adresse kopiert', 'success')
    } catch {
      toast.show(address, 'info')
    }
  }

  return (
    <div
      className="font-mono mb-4 flex flex-wrap items-center gap-2 rounded-xl px-3 py-2"
      style={{
        fontSize: 11,
        color: 'var(--text-secondary)',
        background: 'var(--glass-2)',
        border: '1px solid var(--glass-border-1)',
      }}
    >
      <span>
        BCC an{' '}
        <button
          type="button"
          onClick={() => void copy()}
          style={{
            border: 'none',
            background: 'none',
            color: 'var(--mode-sales)',
            cursor: 'pointer',
            textDecoration: 'underline',
            padding: 0,
            font: 'inherit',
          }}
        >
          {address}
        </button>{' '}
        um Mails automatisch hier zu protokollieren
      </span>
      <button
        type="button"
        onClick={() => {
          try {
            localStorage.setItem(key, '1')
          } catch {
            /* ignore */
          }
          setDismissed(true)
        }}
        style={{
          marginLeft: 'auto',
          border: 'none',
          background: 'none',
          color: 'var(--text-tertiary)',
          cursor: 'pointer',
          fontSize: 10,
        }}
      >
        Ausblenden
      </button>
    </div>
  )
}
