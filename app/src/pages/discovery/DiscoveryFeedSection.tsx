import { Link } from 'react-router-dom'
import type {
  DiscoveryFeedIntervalDays,
  DiscoveryFeedItem,
  DiscoverySettingsDoc,
} from '../../types/db'

const CATEGORY_LABEL: Record<DiscoveryFeedItem['category'], string> = {
  competitor: 'Wettbewerb',
  format: 'Format',
  trend: 'Trend',
  icp_search: 'Suchintent',
}

const SIGNAL_LABEL: Record<DiscoveryFeedItem['signal_strength'], string> = {
  low: 'Signal: niedrig',
  medium: 'Signal: mittel',
  high: 'Signal: hoch',
}

function formatRecorded(iso: string): string {
  try {
    return new Date(iso).toLocaleString('de-DE', {
      dateStyle: 'short',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

interface DiscoveryFeedSectionProps {
  slug: string
  items: DiscoveryFeedItem[]
  loading: boolean
  error: string | null
  settings: DiscoverySettingsDoc | null
  settingsLoading: boolean
  onIntervalChange: (days: DiscoveryFeedIntervalDays) => void
  onRefreshFeed: () => void | Promise<void>
}

export function DiscoveryFeedSection({
  slug,
  items,
  loading,
  error,
  settings,
  settingsLoading,
  onIntervalChange,
  onRefreshFeed,
}: DiscoveryFeedSectionProps) {
  const interval = settings?.feed_interval_days ?? 7
  const lastAt = settings?.last_feed_generated_at

  return (
    <div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div style={{ maxWidth: 480 }}>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            Signale aus Markt und Formaten (derzeit Mock-Daten). Intervall
            merkt dir, wie oft du den Feed erneuern willst — später kann ein
            Agent das automatisch füttern.
          </p>
          {lastAt ? (
            <p
              className="font-mono mt-3"
              style={{ fontSize: 11, color: 'var(--text-tertiary)' }}
            >
              Letzte Aktualisierung: {formatRecorded(lastAt)}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="flex items-center gap-2 font-mono" style={{ fontSize: 12 }}>
            <span style={{ color: 'var(--text-tertiary)' }}>Intervall</span>
            <select
              value={interval}
              disabled={settingsLoading}
              onChange={(e) =>
                onIntervalChange(Number(e.target.value) as DiscoveryFeedIntervalDays)
              }
              style={{
                padding: '8px 10px',
                borderRadius: 10,
                background: 'var(--glass-2)',
                border: '1px solid var(--glass-border-2)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
              }}
            >
              <option value={1}>Täglich</option>
              <option value={7}>Wöchentlich</option>
              <option value={14}>Alle 2 Wochen</option>
            </select>
          </label>
          <button
            type="button"
            className="font-mono"
            style={{
              fontSize: 12,
              padding: '10px 16px',
              borderRadius: 12,
              background: 'var(--glass-3)',
              border: '1px solid var(--glass-border-2)',
              color: 'var(--accent-coral)',
            }}
            onClick={onRefreshFeed}
          >
            Feed aktualisieren
          </button>
        </div>
      </div>

      <p className="mt-4" style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
        Übernahme in{' '}
        <Link
          to={`/brand/${slug}/foundation`}
          style={{ color: 'var(--accent-coral)', textDecoration: 'underline' }}
        >
          Building
        </Link>
        : ICPs und Word Bank dort weiterbearbeiten.
      </p>

      {loading ? (
        <div
          className="animate-pulse mt-6"
          style={{
            minHeight: 160,
            borderRadius: 16,
            background: 'var(--glass-1)',
            border: '1px solid var(--glass-border-1)',
          }}
        />
      ) : error ? (
        <div
          className="font-mono mt-6"
          style={{ fontSize: 12, color: 'var(--accent-coral)' }}
        >
          Feed konnte nicht geladen werden: {error}
        </div>
      ) : items.length === 0 ? (
        <p className="mt-8" style={{ fontSize: 14, color: 'var(--text-tertiary)' }}>
          Noch keine Einträge. „Feed aktualisieren“ legt neue Signale oben an.
        </p>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {items.map((it) => (
            <li
              key={it.id}
              style={{
                padding: 16,
                borderRadius: 16,
                background: 'var(--glass-2)',
                border: '1px solid var(--glass-border-2)',
              }}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="font-mono"
                  style={{
                    fontSize: 10,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'var(--accent-coral)',
                  }}
                >
                  {CATEGORY_LABEL[it.category]}
                </span>
                <span
                  className="font-mono"
                  style={{ fontSize: 10, color: 'var(--text-tertiary)' }}
                >
                  {formatRecorded(it.recorded_at)}
                </span>
                <span
                  className="font-mono"
                  style={{
                    fontSize: 10,
                    padding: '2px 8px',
                    borderRadius: 8,
                    background: 'var(--glass-1)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {SIGNAL_LABEL[it.signal_strength]}
                </span>
              </div>
              <h3
                className="font-display mt-2"
                style={{
                  fontSize: 17,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                }}
              >
                {it.title}
              </h3>
              <p
                className="mt-2"
                style={{ fontSize: 14, color: 'var(--text-secondary)' }}
              >
                {it.summary}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
