import { useMemo } from 'react'
import { useCallLogs, useEmailLogs, useSalesGoals } from '../../hooks/useSalesPro'
import { useActivityLog } from '../../hooks/useActivityLog'
import { useContacts } from '../../hooks/useContacts'
import { useBrandId } from '../../hooks/useBrandId'
import { logActivity } from '../../lib/activityLog'
import { useToast } from '../Toast'
import { usePerformanceDrawers } from './PerformanceDrawerContext'

interface GoalsCardProps {
  slug: string
  onOpenSettings?: () => void
}

function startOfWeekTs(): number {
  const d = new Date()
  const day = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - day)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

interface ProgressBarProps {
  label: string
  current: number
  target: number
  accent: string
  onTally?: () => void
}

function ProgressBar({ label, current, target, accent, onTally }: ProgressBarProps) {
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0
  return (
    <div>
      <div
        className="font-mono mb-1 flex items-baseline justify-between"
        style={{ fontSize: 10, color: 'var(--text-tertiary)' }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {label}
          {onTally ? (
            <button
              type="button"
              onClick={onTally}
              title={`+1 ${label}`}
              className="font-mono"
              style={{
                fontSize: 9,
                padding: '1px 6px',
                borderRadius: 999,
                border: `1px solid ${accent}`,
                background: `color-mix(in srgb, ${accent} 14%, transparent)`,
                color: accent,
                cursor: 'pointer',
                lineHeight: 1.4,
              }}
            >
              +1
            </button>
          ) : null}
        </span>
        <span style={{ color: 'var(--text-secondary)' }}>
          {current}{' '}
          <span style={{ color: 'var(--text-tertiary)' }}>
            / {target || '—'}
          </span>
        </span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full"
        style={{ background: 'var(--glass-2)' }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: accent,
            borderRadius: 999,
            transition: 'width 0.3s ease',
          }}
        />
      </div>
    </div>
  )
}

export function GoalsCard({ slug, onOpenSettings }: GoalsCardProps) {
  const drawers = usePerformanceDrawers()
  const openSettings = onOpenSettings ?? drawers?.openGoals
  const goals = useSalesGoals(slug, 'week')
  const calls = useCallLogs(slug, { limit: 500 })
  const mails = useEmailLogs(slug, { limit: 500 })
  const contacts = useContacts(slug)
  const activity = useActivityLog(slug, 500)
  const brandId = useBrandId(slug)
  const { show } = useToast()

  const stats = useMemo(() => {
    const weekTs = startOfWeekTs()
    const callsCount = calls.items.filter(
      (c) => new Date(c.called_at).getTime() >= weekTs,
    ).length
    const mailsCount = mails.items.filter(
      (m) => new Date(m.sent_at).getTime() >= weekTs,
    ).length
    const linkedinCount = activity.items.filter(
      (a) =>
        a.action === 'linkedin_sent' &&
        new Date(a.created_at).getTime() >= weekTs,
    ).length
    const qualificationsCount = contacts.items.filter(
      (c) =>
        c.stage_changed_at &&
        new Date(c.stage_changed_at).getTime() >= weekTs &&
        ['conversation', 'proposal', 'deal'].includes(c.pipeline_stage),
    ).length
    const meetings = contacts.items.filter(
      (c) =>
        c.stage_changed_at &&
        new Date(c.stage_changed_at).getTime() >= weekTs &&
        c.pipeline_stage === 'conversation',
    ).length
    const deals = contacts.items.filter(
      (c) => c.won_at && new Date(c.won_at).getTime() >= weekTs,
    ).length
    return { callsCount, mailsCount, linkedinCount, qualificationsCount, meetings, deals }
  }, [calls.items, mails.items, activity.items, contacts.items])

  const tallyLinkedIn = () => {
    if (!brandId) {
      show('Bitte erst Brand auswählen', 'info')
      return
    }
    logActivity({
      brand_id: brandId,
      entity_type: 'contact',
      action: 'linkedin_sent',
      summary: 'LinkedIn-Nachricht gesendet',
    })
    void activity.reload()
    show('LinkedIn +1', 'success')
  }

  const g = goals.current
  const hasAny =
    (g?.calls_target ?? 0) +
      (g?.mails_target ?? 0) +
      (g?.linkedin_target ?? 0) +
      (g?.qualifications_target ?? 0) +
      (g?.meetings_target ?? 0) +
      (g?.deals_target ?? 0) >
    0

  return (
    <div
      style={{
        background: 'var(--glass-1)',
        border: '1px solid var(--glass-border-1)',
        borderRadius: 14,
        padding: 18,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 16,
        }}
      >
        <div>
          <div
            className="font-mono"
            style={{
              fontSize: 9,
              letterSpacing: '0.14em',
              color: 'var(--text-tertiary)',
              marginBottom: 4,
            }}
          >
            WOCHEN-ZIELE
          </div>
          <div className="font-display" style={{ fontSize: 15, fontWeight: 600 }}>
            Diese Woche
          </div>
        </div>
        {openSettings ? (
          <button
            type="button"
            onClick={openSettings}
            className="font-mono"
            style={{
              fontSize: 10,
              padding: '4px 10px',
              borderRadius: 7,
              border: '1px solid var(--glass-border-2)',
              background: 'transparent',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
            }}
          >
            Anpassen
          </button>
        ) : null}
      </div>

      {!hasAny ? (
        <div
          style={{
            fontSize: 12,
            color: 'var(--text-tertiary)',
            textAlign: 'center',
            padding: 12,
            border: '1px dashed var(--glass-border-1)',
            borderRadius: 10,
          }}
        >
          Noch keine Wochenziele gesetzt.
          {openSettings ? (
            <>
              {' '}
              <button
                type="button"
                onClick={openSettings}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--mode-sales)',
                  cursor: 'pointer',
                  fontSize: 12,
                }}
              >
                Setzen →
              </button>
            </>
          ) : null}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <ProgressBar
            label="Anrufe"
            current={stats.callsCount}
            target={g?.calls_target ?? 0}
            accent="var(--mode-sales)"
          />
          <ProgressBar
            label="E-Mails"
            current={stats.mailsCount}
            target={g?.mails_target ?? 0}
            accent="var(--accent-blue)"
          />
          <ProgressBar
            label="LinkedIn-Nachrichten"
            current={stats.linkedinCount}
            target={g?.linkedin_target ?? 0}
            accent="#0A66C2"
            onTally={tallyLinkedIn}
          />
          <ProgressBar
            label="Qualifizierungen"
            current={stats.qualificationsCount}
            target={g?.qualifications_target ?? 0}
            accent="var(--accent-mint, var(--accent-teal))"
          />
          <ProgressBar
            label="Erstgespräche"
            current={stats.meetings}
            target={g?.meetings_target ?? 0}
            accent="var(--accent-teal)"
          />
          <ProgressBar
            label="Abschlüsse"
            current={stats.deals}
            target={g?.deals_target ?? 0}
            accent="var(--brand-accent, var(--accent-teal))"
          />
        </div>
      )}
    </div>
  )
}
