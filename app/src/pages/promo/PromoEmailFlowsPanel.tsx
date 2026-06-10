import { useState } from 'react'
import { SectionLabel } from '../../components/SectionLabel'
import { MailFlowsPanel } from './MailFlowsPanel'
import { PromoEmailPanel } from './PromoEmailPanel'

type Segment = 'email' | 'flows'

export function PromoEmailFlowsPanel({ slug }: { slug: string }) {
  const [segment, setSegment] = useState<Segment>('email')

  return (
    <div>
      <div
        className="font-mono flex gap-1"
        style={{ marginBottom: 12 }}
      >
        {(
          [
            ['email', 'E-Mail-Planung'],
            ['flows', 'Automation-Flows'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setSegment(key)}
            style={{
              fontSize: 10,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              padding: '6px 11px',
              borderRadius: 8,
              border: `1px solid ${segment === key ? 'var(--mode-promo)' : 'var(--glass-border-2)'}`,
              background:
                segment === key
                  ? 'color-mix(in srgb, var(--mode-promo) 14%, transparent)'
                  : 'var(--glass-2)',
              color: segment === key ? 'var(--mode-promo)' : 'var(--text-tertiary)',
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {segment === 'email' ? (
        <>
          <SectionLabel accent="var(--accent-blue)">E-Mail</SectionLabel>
          <PromoEmailPanel slug={slug} />
        </>
      ) : (
        <>
          <SectionLabel accent="var(--accent-blue)">Mail-Flows</SectionLabel>
          <MailFlowsPanel slug={slug} />
        </>
      )}
    </div>
  )
}
