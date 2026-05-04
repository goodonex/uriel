import type { ReactNode } from 'react'

interface SectionLabelProps {
  children: ReactNode
  accent?: string
  tight?: boolean
}

export function SectionLabel({ children, accent, tight }: SectionLabelProps) {
  return (
    <div
      className="font-mono"
      style={{
        fontSize: 10,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        color: accent ?? 'var(--text-tertiary)',
        marginTop: tight ? 24 : 40,
        marginBottom: 14,
      }}
    >
      {children}
    </div>
  )
}
