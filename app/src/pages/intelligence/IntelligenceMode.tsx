import { motion } from 'framer-motion'
import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { SectionLabel } from '../../components/SectionLabel'
import { useBrands } from '../../hooks/useBrands'
import { useCampaigns } from '../../hooks/useCampaigns'
import { useContacts } from '../../hooks/useContacts'
import { useContentPieces } from '../../hooks/useContentPieces'
import { useDiscoveryFeed } from '../../hooks/useDiscoveryFeed'
import { useFocusPreferences } from '../../hooks/useFocusPreferences'
import { useICPs } from '../../hooks/useICPs'
import { useWordBank } from '../../hooks/useWordBank'
import { computeFocusTasks } from '../../lib/mockFocusEngine'
import { buildIntelligenceSnapshot } from '../../lib/mockIntelligence'
import { IntelligenceReports } from './IntelligenceReports'
import { MorningBriefSection } from './MorningBriefSection'

export function IntelligenceMode() {
  const { slug } = useParams<{ slug: string }>()
  const { brands } = useBrands()
  const brand = brands.find((b) => b.slug === slug)

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
      slug
        ? computeFocusTasks({
            brandSlug: slug,
            pieces: pieces.items,
            contacts: contacts.items,
            discoveryItems: feed.items,
            icps: icps.items,
            wordBank: wordBank.items,
            dismissed,
          })
        : [],
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

  const snapshot = useMemo(
    () =>
      buildIntelligenceSnapshot({
        brandName: brand?.name ?? slug ?? 'Brand',
        pieces: pieces.items,
        contacts: contacts.items,
        campaigns: campaigns.items,
        icps: icps.items,
      }),
    [brand?.name, slug, pieces.items, contacts.items, campaigns.items, icps.items],
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
    <motion.div
      key={slug}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      style={{ background: 'transparent' }}
    >
      {slug ? <MorningBriefSection slug={slug} /> : null}

      {slug ? (
        <div className="mb-8">
          <SectionLabel accent="var(--mode-intelligence)" tight>
            Live-Reports
          </SectionLabel>
          <IntelligenceReports slug={slug} />
        </div>
      ) : null}

      <div className="mb-6">
        <div
          className="font-mono"
          style={{
            fontSize: 10,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--mode-intelligence)',
            marginBottom: 6,
          }}
        >
          Intelligence Mode
        </div>
        <h2
          className="font-display"
          style={{
            fontSize: 22,
            fontWeight: 600,
            color: 'var(--text-primary)',
            letterSpacing: '-0.3px',
          }}
        >
          Focus &amp; Lernschicht
        </h2>
      </div>

      <SectionLabel accent="var(--mode-intelligence)" tight>
        Focus Tasks
      </SectionLabel>
      <div className="mb-8 flex flex-col gap-2">
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
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
            Alles erledigt oder keine Signale — Super.
          </p>
        ) : (
          tasks.map((t) => (
            <div
              key={t.id}
              className="glass-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"
              style={{
                padding: 14,
                borderRadius: 14,
                border: '1px solid var(--glass-border-1)',
              }}
            >
              <div>
                <div
                  className="font-mono mb-1"
                  style={{ fontSize: 10, color: 'var(--text-tertiary)' }}
                >
                  {t.source.toUpperCase()} · {t.impact.toUpperCase()}
                </div>
                <div
                  className="font-display"
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                  }}
                >
                  {t.title}
                </div>
                <p
                  className="mt-1"
                  style={{ fontSize: 13, color: 'var(--text-secondary)' }}
                >
                  {t.detail}
                </p>
              </div>
              <button
                type="button"
                className="font-mono shrink-0"
                style={{
                  fontSize: 11,
                  padding: '8px 12px',
                  borderRadius: 10,
                  border: '1px solid var(--glass-border-2)',
                  color: 'var(--text-secondary)',
                }}
                onClick={() => focusPrefs.dismiss(t.id)}
              >
                Erledigt / Ausblenden
              </button>
            </div>
          ))
        )}
        {!loading && focusPrefs.dismissedIds.length > 0 ? (
          <button
            type="button"
            className="font-mono self-start"
            style={{
              fontSize: 11,
              marginTop: 6,
              color: 'var(--text-tertiary)',
              textDecoration: 'underline',
            }}
            onClick={() => focusPrefs.restoreAll()}
          >
            Ausblendungen zurücksetzen
          </button>
        ) : null}
      </div>

      <SectionLabel accent="var(--mode-intelligence)">
        Morning Brief (Mock)
      </SectionLabel>
      <div
        className="glass-2 mb-8"
        style={{
          padding: 16,
          borderRadius: 16,
          border: '1px solid var(--glass-border-1)',
        }}
      >
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {snapshot.morningBrief}
        </p>
      </div>

      <SectionLabel accent="var(--mode-intelligence)">
        Pattern Recognition (Mock)
      </SectionLabel>
      <ul className="mb-8 flex flex-col gap-2">
        {snapshot.patterns.map((line, i) => (
          <li
            key={i}
            className="glass-2"
            style={{
              padding: 12,
              borderRadius: 12,
              fontSize: 13,
              color: 'var(--text-secondary)',
              border: '1px solid var(--glass-border-1)',
            }}
          >
            {line}
          </li>
        ))}
      </ul>

      <SectionLabel accent="var(--mode-intelligence)">
        ICP &amp; Drift (Mock)
      </SectionLabel>
      <ul className="mb-8 flex flex-col gap-2">
        {snapshot.icpDrift.map((line, i) => (
          <li
            key={i}
            className="glass-2"
            style={{
              padding: 12,
              borderRadius: 12,
              fontSize: 13,
              color: 'var(--text-secondary)',
              border: '1px solid var(--glass-border-1)',
            }}
          >
            {line}
          </li>
        ))}
      </ul>

      <SectionLabel accent="var(--mode-intelligence)">
        Foundation-Vorschläge (Mock)
      </SectionLabel>
      <ul className="mb-8 flex flex-col gap-2">
        {snapshot.foundationIdeas.length === 0 ? (
          <li style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
            Keine automatischen Vorschläge — Datenbasis wirkt konsistent.
          </li>
        ) : (
          snapshot.foundationIdeas.map((line, i) => (
            <li
              key={i}
              className="glass-2"
              style={{
                padding: 12,
                borderRadius: 12,
                fontSize: 13,
                color: 'var(--text-secondary)',
                border: '1px solid var(--glass-border-1)',
              }}
            >
              {line}
            </li>
          ))
        )}
      </ul>

      <SectionLabel accent="var(--mode-intelligence)">
        Discovery Automation
      </SectionLabel>
      <p style={{ fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
        Geplanter Cron über Supabase Edge Functions (Phase 6 Roadmap in docs/phases.md)
        — in der App weiterhin manuell „Feed aktualisieren“ im Discovery Mode.
      </p>
    </motion.div>
  )
}
