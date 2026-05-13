import { useMemo } from 'react'
import { SectionLabel } from '../../components/SectionLabel'
import { useCampaigns } from '../../hooks/useCampaigns'
import { useContacts } from '../../hooks/useContacts'
import { useContentPieces } from '../../hooks/useContentPieces'
import { useDiscoveryFeed } from '../../hooks/useDiscoveryFeed'
import { useFocusPreferences } from '../../hooks/useFocusPreferences'
import { useICPs } from '../../hooks/useICPs'
import { useWordBank } from '../../hooks/useWordBank'
import { computeFocusTasks } from '../../lib/mockFocusEngine'

export function IntelligenceFocusTasksBlock({ slug }: { slug: string }) {
  const pieces = useContentPieces(slug)
  const contacts = useContacts(slug)
  const campaigns = useCampaigns(slug)
  const icps = useICPs(slug)
  const wordBank = useWordBank(slug)
  const feed = useDiscoveryFeed(slug)
  const focusPrefs = useFocusPreferences(slug)

  const dismissed = useMemo(
    () => new Set(focusPrefs.dismissedIds),
    [focusPrefs.dismissedIds],
  )

  const tasks = useMemo(
    () =>
      computeFocusTasks({
        brandSlug: slug,
        pieces: pieces.items,
        contacts: contacts.items,
        discoveryItems: feed.items,
        icps: icps.items,
        wordBank: wordBank.items,
        dismissed,
      }),
    [
      slug,
      pieces.items,
      contacts.items,
      feed.items,
      icps.items,
      wordBank.items,
      dismissed,
    ],
  )

  const loading =
    pieces.loading ||
    contacts.loading ||
    campaigns.loading ||
    icps.loading ||
    wordBank.loading ||
    feed.loading ||
    focusPrefs.loading

  return (
    <>
      <SectionLabel accent="var(--mode-intelligence)" tight>
        Focus Tasks
      </SectionLabel>
      <div className="flex flex-col gap-2">
        {loading ? (
          <div
            className="animate-pulse"
            style={{
              height: 80,
              borderRadius: 14,
              background: 'var(--glass-1)',
              border: '1px solid var(--glass-border-1)',
            }}
          />
        ) : tasks.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
            Alles erledigt oder keine Signale — Super.
          </p>
        ) : (
          tasks.map((t) => (
            <div
              key={t.id}
              className="glass-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"
              style={{
                padding: 12,
                borderRadius: 12,
                border: '1px solid var(--glass-border-1)',
              }}
            >
              <div>
                <div
                  className="font-mono mb-1"
                  style={{ fontSize: 9, color: 'var(--text-tertiary)' }}
                >
                  {t.source.toUpperCase()} · {t.impact.toUpperCase()}
                </div>
                <div
                  className="font-display"
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                  }}
                >
                  {t.title}
                </div>
                <p className="mt-1" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {t.detail}
                </p>
              </div>
              <button
                type="button"
                className="font-mono shrink-0"
                style={{
                  fontSize: 10,
                  padding: '6px 10px',
                  borderRadius: 8,
                  border: '1px solid var(--glass-border-2)',
                  color: 'var(--text-secondary)',
                }}
                onClick={() => focusPrefs.dismiss(t.id)}
              >
                Erledigt
              </button>
            </div>
          ))
        )}
        {!loading && focusPrefs.dismissedIds.length > 0 ? (
          <button
            type="button"
            className="font-mono self-start"
            style={{
              fontSize: 10,
              marginTop: 4,
              color: 'var(--text-tertiary)',
              textDecoration: 'underline',
            }}
            onClick={() => focusPrefs.restoreAll()}
          >
            Ausblendungen zurücksetzen
          </button>
        ) : null}
      </div>
    </>
  )
}
