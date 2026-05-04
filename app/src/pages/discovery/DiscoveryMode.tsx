import { useCallback } from 'react'
import { motion } from 'framer-motion'
import { useParams } from 'react-router-dom'
import { SectionLabel } from '../../components/SectionLabel'
import { useToast } from '../../components/Toast'
import { useDiscoveryFeed } from '../../hooks/useDiscoveryFeed'
import { useDiscoveryFoundation } from '../../hooks/useDiscoveryFoundation'
import { useDiscoverySettings } from '../../hooks/useDiscoverySettings'
import { useICPs } from '../../hooks/useICPs'
import { usePositioning } from '../../hooks/usePositioning'
import { useWordBank } from '../../hooks/useWordBank'
import {
  generateMockFeedBatch,
  runMockDiscoveryAnalysis,
} from '../../lib/mockDiscoveryAgent'
import type {
  DiscoveryFeedIntervalDays,
  DiscoveryIcpDraft,
  DiscoveryWordSuggestion,
} from '../../types/db'
import { DiscoveryFeedSection } from './DiscoveryFeedSection'
import { DiscoveryFoundationSection } from './DiscoveryFoundationSection'

export function DiscoveryMode() {
  const { slug } = useParams<{ slug: string }>()
  const { show } = useToast()

  const foundation = useDiscoveryFoundation(slug)
  const feed = useDiscoveryFeed(slug)
  const settings = useDiscoverySettings(slug)
  const icps = useICPs(slug)
  const wordBank = useWordBank(slug)
  const positioning = usePositioning(slug)

  const runAnalysis = useCallback(() => {
    const it = foundation.item
    if (!it || !slug) return
    const analysis = runMockDiscoveryAnalysis({
      market: it.market,
      competitors: it.competitors,
      niche: it.niche,
    })
    foundation.save({
      analysis,
      analysis_run_at: new Date().toISOString(),
    })
    show('Analyse aktualisiert (Mock)', 'success')
  }, [foundation, slug, show])

  const refreshFeed = useCallback(() => {
    if (!slug) return
    const batch = generateMockFeedBatch(slug, 3)
    feed.prepend(batch)
    settings.save({ last_feed_generated_at: new Date().toISOString() })
    show('Feed aktualisiert', 'success')
  }, [slug, feed, settings, show])

  const onIntervalChange = useCallback(
    (days: DiscoveryFeedIntervalDays) => {
      settings.save({ feed_interval_days: days })
    },
    [settings],
  )

  const applyIcp = useCallback(
    (draft: DiscoveryIcpDraft) => {
      icps.create({
        name: draft.name,
        age_range: draft.age_range,
        location: draft.location,
        pain_points: draft.pain_hint ? [draft.pain_hint] : [],
        word_clusters: [],
        notes: 'Aus Discovery übernommen.',
      })
      show('ICP in Building angelegt', 'success')
    },
    [icps, show],
  )

  const applyWord = useCallback(
    (s: DiscoveryWordSuggestion) => {
      const w = s.word.trim()
      if (!w) return
      const exists = wordBank.items.some(
        (x) => x.word.toLowerCase() === w.toLowerCase(),
      )
      if (exists) {
        show('Begriff existiert bereits in der Word Bank', 'info')
        return
      }
      wordBank.create({
        word: w,
        type: s.type,
        cluster: s.cluster.trim() || 'Discovery',
      })
      show('In Word Bank übernommen', 'success')
    },
    [wordBank, show],
  )

  const applyPositioningIdea = useCallback(
    (idea: string) => {
      const cur = positioning.item?.statement?.trim()
      if (!cur) {
        positioning.save({ statement: idea })
        show('Positioning-Statement gesetzt', 'success')
        return
      }
      void navigator.clipboard.writeText(idea)
      show('In Zwischenablage kopiert (Statement war schon befüllt)', 'info')
    },
    [positioning, show],
  )

  return (
    <motion.div
      key={slug}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
        <div>
          <div
            className="font-mono"
            style={{
              fontSize: 10,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--accent-coral)',
              marginBottom: 6,
            }}
          >
            Discovery Mode
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
            Markt &amp; Signale
          </h2>
        </div>
      </div>

      <SectionLabel accent="var(--accent-coral)" tight>
        Discovery Foundation
      </SectionLabel>
      <DiscoveryFoundationSection
        item={foundation.item}
        loading={foundation.loading}
        error={foundation.error}
        onSave={foundation.save}
        onRunAnalysis={runAnalysis}
        onApplyIcpDraft={applyIcp}
        onApplyWord={applyWord}
        onApplyPositioningIdea={applyPositioningIdea}
      />

      <SectionLabel accent="var(--accent-coral)">Discovery Feed</SectionLabel>
      {slug ? (
        <DiscoveryFeedSection
          slug={slug}
          items={feed.items}
          loading={feed.loading}
          error={feed.error}
          settings={settings.item}
          settingsLoading={settings.loading}
          onIntervalChange={onIntervalChange}
          onRefreshFeed={refreshFeed}
        />
      ) : null}
    </motion.div>
  )
}
