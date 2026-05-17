import { useState } from 'react'
import { SwarmCheckPanel } from './SwarmCheckPanel'

export function SwarmCheckButton({
  slug,
  content,
  contentType,
  label = 'Schwarm-Check',
}: {
  slug: string
  content: string
  contentType: string
  label?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        className="font-mono"
        onClick={() => setOpen(true)}
        disabled={!content.trim()}
        style={{
          fontSize: 10,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          padding: '8px 12px',
          borderRadius: 8,
          border: '1px solid color-mix(in srgb, var(--accent-blue) 45%, transparent)',
          background: 'color-mix(in srgb, var(--accent-blue) 10%, transparent)',
          color: 'var(--accent-blue)',
          cursor: content.trim() ? 'pointer' : 'not-allowed',
          opacity: content.trim() ? 1 : 0.45,
        }}
      >
        {label}
      </button>
      <SwarmCheckPanel
        slug={slug}
        open={open}
        onClose={() => setOpen(false)}
        content={content}
        contentType={contentType}
      />
    </>
  )
}
