import { motion } from 'framer-motion'
import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { SectionLabel } from '../../components/SectionLabel'
import { useBrands } from '../../hooks/useBrands'
import { useCampaigns } from '../../hooks/useCampaigns'
import { useContacts } from '../../hooks/useContacts'
import { useContentPieces } from '../../hooks/useContentPieces'
import { useICPs } from '../../hooks/useICPs'
import { buildIntelligenceSnapshot } from '../../lib/mockIntelligence'
import { IntelligenceReports } from './IntelligenceReports'
import { IntelligenceFocusTasksBlock } from './IntelligenceFocusTasksBlock'
import { MorningBriefSection } from './MorningBriefSection'

export function IntelligenceMode() {
  const { slug } = useParams<{ slug: string }>()
  const { brands } = useBrands()
  const brand = brands.find((b) => b.slug === slug)

  const pieces = useContentPieces(slug)
  const contacts = useContacts(slug)
  const campaigns = useCampaigns(slug)
  const icps = useICPs(slug)

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

      {slug ? <IntelligenceFocusTasksBlock slug={slug} /> : null}

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
