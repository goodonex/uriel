import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { RunDetail } from '../lib/runnerApi'
import { fetchRun } from '../lib/runnerApi'

/** Ergebnis-Panel für Agent-Runs (REBUILD-PLAN §6): Markdown + Copy. */
export function RunDrawer({ runId, onClose }: { runId: string; onClose: () => void }) {
  const [run, setRun] = useState<RunDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setRun(null)
    setError(null)
    fetchRun(runId)
      .then(setRun)
      .catch((e: Error) => setError(e.message))
  }, [runId])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const copy = async () => {
    if (!run) return
    await navigator.clipboard.writeText(run.content)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div
      role="dialog"
      aria-label={`Agent-Run ${runId}`}
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: 'min(560px, 92vw)',
        background: 'var(--ck-panel)',
        borderLeft: '1px solid var(--ck-border-strong)',
        zIndex: 55,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '12px 16px',
          borderBottom: '1px solid var(--ck-border)',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div className="ck-label">{run?.agent ?? 'Run'} · {run?.status ?? ''}</div>
          <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {runId}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button className="ck-btn" onClick={copy}>{copied ? '✓ kopiert' : 'Copy'}</button>
          <button className="ck-btn" onClick={onClose} aria-label="Schließen">✕</button>
        </div>
      </div>

      <div className="ck-md" style={{ flex: 1, overflowY: 'auto', padding: '14px 18px', fontSize: 13, lineHeight: 1.65 }}>
        {error ? (
          <p style={{ color: 'var(--ck-warn)' }}>{error}</p>
        ) : run ? (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{run.content}</ReactMarkdown>
        ) : (
          <p style={{ color: 'var(--ck-text-3)' }}>Lade…</p>
        )}
      </div>
    </div>
  )
}
