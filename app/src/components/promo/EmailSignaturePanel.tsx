import { useEffect, useRef } from 'react'
import { useEmailSettings } from '../../hooks/useEmailSettings'

const FIELD = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid var(--glass-border-2)',
  background: 'var(--glass-1)',
  color: 'var(--text-primary)',
  fontSize: 12,
  lineHeight: 1.55,
  outline: 'none',
  fontFamily: 'inherit',
  resize: 'vertical' as const,
} as const

export function EmailSignaturePanel({ brandSlug }: { brandSlug: string }) {
  const { signature, setSignature, saveSignature, saving, loading } = useEmailSettings(brandSlug)
  const debounceRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
    }
  }, [])

  const onChange = (value: string) => {
    setSignature(value)
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => {
      void saveSignature(value)
    }, 700)
  }

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div
        className="glass-2 rounded-2xl p-4"
        style={{ border: '1px solid var(--glass-border-1)' }}
      >
        <div className="font-mono mb-2" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
          SIGNATUR
        </div>
        <p className="font-mono mb-3" style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0 }}>
          Wird automatisch an jede ausgehende Sales-Mail angehängt (nach dem Text, mit „--“ davor).
        </p>
        <textarea
          value={signature}
          onChange={(e) => onChange(e.target.value)}
          rows={8}
          disabled={loading}
          placeholder={'Beste Grüße\nName\nFirma\nTelefon'}
          style={FIELD}
        />
        <div className="font-mono mt-2" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
          {saving ? 'Speichert…' : 'Automatisch gespeichert'}
        </div>
      </div>

      <div
        className="glass-2 rounded-2xl p-4"
        style={{ border: '1px solid var(--glass-border-1)', height: 'fit-content' }}
      >
        <div className="font-mono mb-2" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
          VORSCHAU
        </div>
        <div
          style={{
            padding: 14,
            borderRadius: 10,
            background: '#fff',
            color: '#1a1a1a',
            fontSize: 13,
            lineHeight: 1.55,
            whiteSpace: 'pre-wrap',
          }}
        >
          <span style={{ color: '#666' }}>…dein Mail-Text…</span>
          {signature.trim() ? (
            <>
              {'\n\n--\n'}
              {signature.trim()}
            </>
          ) : (
            <div style={{ marginTop: 12, color: '#999', fontSize: 11 }}>Noch keine Signatur</div>
          )}
        </div>
      </div>
    </div>
  )
}
