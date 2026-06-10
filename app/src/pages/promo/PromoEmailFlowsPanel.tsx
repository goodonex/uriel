import { useSearchParams } from 'react-router-dom'
import { SectionLabel } from '../../components/SectionLabel'
import { EmailSignaturePanel } from '../../components/promo/EmailSignaturePanel'
import { EmailTemplatesPanel } from '../../components/promo/EmailTemplatesPanel'
import { MailFlowsPanel } from './MailFlowsPanel'
import { PromoEmailPanel } from './PromoEmailPanel'

type TopSegment = 'email' | 'flows'
type EmailTab = 'planung' | 'vorlagen' | 'signatur'

export const PROMO_EMAIL_TAB_PARAM = 'emailTab'

export function PromoEmailFlowsPanel({ slug }: { slug: string }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const topSegment: TopSegment =
    searchParams.get('segment') === 'flows' ? 'flows' : 'email'
  const emailTab: EmailTab = (() => {
    const t = searchParams.get(PROMO_EMAIL_TAB_PARAM)
    if (t === 'vorlagen' || t === 'signatur' || t === 'planung') return t
    return 'planung'
  })()

  const setTopSegment = (segment: TopSegment) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (segment === 'flows') next.set('segment', 'flows')
        else next.delete('segment')
        return next
      },
      { replace: true },
    )
  }

  const setEmailTab = (tab: EmailTab) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('segment')
        if (tab === 'planung') next.delete(PROMO_EMAIL_TAB_PARAM)
        else next.set(PROMO_EMAIL_TAB_PARAM, tab)
        return next
      },
      { replace: true },
    )
  }

  return (
    <div>
      <div className="font-mono flex gap-1" style={{ marginBottom: 12 }}>
        {(
          [
            ['email', 'E-Mail'],
            ['flows', 'Automation-Flows'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTopSegment(key)}
            style={{
              fontSize: 10,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              padding: '6px 11px',
              borderRadius: 8,
              border: `1px solid ${topSegment === key ? 'var(--mode-promo)' : 'var(--glass-border-2)'}`,
              background:
                topSegment === key
                  ? 'color-mix(in srgb, var(--mode-promo) 14%, transparent)'
                  : 'var(--glass-2)',
              color: topSegment === key ? 'var(--mode-promo)' : 'var(--text-tertiary)',
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {topSegment === 'email' ? (
        <>
          <div className="font-mono mb-3 flex flex-wrap gap-1">
            {(
              [
                ['planung', 'Sequenz-Planung'],
                ['vorlagen', 'Vorlagen'],
                ['signatur', 'Signatur'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setEmailTab(key)}
                style={{
                  fontSize: 10,
                  padding: '5px 10px',
                  borderRadius: 8,
                  border: `1px solid ${emailTab === key ? 'var(--accent-blue)' : 'var(--glass-border-2)'}`,
                  background:
                    emailTab === key
                      ? 'color-mix(in srgb, var(--accent-blue) 12%, transparent)'
                      : 'transparent',
                  color: emailTab === key ? 'var(--accent-blue)' : 'var(--text-tertiary)',
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {emailTab === 'planung' ? (
            <>
              <SectionLabel accent="var(--accent-blue)">E-Mail-Sequenzen</SectionLabel>
              <PromoEmailPanel slug={slug} />
            </>
          ) : null}
          {emailTab === 'vorlagen' ? (
            <>
              <SectionLabel accent="var(--accent-blue)">E-Mail-Vorlagen</SectionLabel>
              <p className="font-mono" style={{ fontSize: 11, color: 'var(--text-tertiary)', margin: '8px 0 0' }}>
                Vorlagen für Sales-Mails — gleiche Daten wie in der Pipeline.
              </p>
              <EmailTemplatesPanel brandSlug={slug} />
            </>
          ) : null}
          {emailTab === 'signatur' ? (
            <>
              <SectionLabel accent="var(--accent-blue)">E-Mail-Signatur</SectionLabel>
              <EmailSignaturePanel brandSlug={slug} />
            </>
          ) : null}
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
