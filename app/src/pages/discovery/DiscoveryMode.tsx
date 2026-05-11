import { useCallback, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useParams } from 'react-router-dom'
import { SectionLabel } from '../../components/SectionLabel'
import { useToast } from '../../components/Toast'
import { useBrandId } from '../../hooks/useBrandId'
import { useBusinessModel } from '../../hooks/useBusinessModel'
import { useDiscoveryFeed } from '../../hooks/useDiscoveryFeed'
import { useDiscoveryFoundation } from '../../hooks/useDiscoveryFoundation'
import { useDiscoverySettings } from '../../hooks/useDiscoverySettings'
import { useICPs } from '../../hooks/useICPs'
import { usePositioning } from '../../hooks/usePositioning'
import { useWordBank } from '../../hooks/useWordBank'
import { isSupabaseConfigured, supabase } from '../../lib/supabase'
import type {
  DiscoveryFeedIntervalDays,
  DiscoveryIcpDraft,
  DiscoveryWordSuggestion,
} from '../../types/db'
import { DiscoveryFeedSection } from './DiscoveryFeedSection'
import { DiscoveryFoundationSection } from './DiscoveryFoundationSection'

const DOCS_KEYS_PATH = 'docs/open-questions.md'

type FnErrorBody = {
  code?: string
  message?: string
  docsPath?: string
}

async function readInvokeErrorBody(err: unknown): Promise<FnErrorBody | null> {
  if (!err || typeof err !== 'object') return null
  const ctx = (err as { context?: Response }).context
  if (ctx && typeof ctx.clone === 'function' && typeof ctx.json === 'function') {
    try {
      return (await ctx.clone().json()) as FnErrorBody
    } catch {
      return null
    }
  }
  return null
}

export function DiscoveryMode() {
  const { slug } = useParams<{ slug: string }>()
  const { show } = useToast()
  const brandId = useBrandId(slug)

  const foundation = useDiscoveryFoundation(slug)
  const feed = useDiscoveryFeed(slug)
  const settings = useDiscoverySettings(slug)
  const icps = useICPs(slug)
  const wordBank = useWordBank(slug)
  const positioning = usePositioning(slug)
  const businessModel = useBusinessModel(slug)

  const [analysisRunBusy, setAnalysisRunBusy] = useState(false)
  const [analysisRunPhase, setAnalysisRunPhase] = useState(0)
  const [analysisRunError, setAnalysisRunError] = useState<string | null>(null)
  const phaseTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const clearPhaseTimer = () => {
    if (phaseTimerRef.current) {
      clearInterval(phaseTimerRef.current)
      phaseTimerRef.current = null
    }
  }

  const runAnalysis = useCallback(
    async (payload: { market: string; competitors: string; niche: string }) => {
      if (!slug || !brandId) {
        show('Brand nicht geladen.', 'error')
        return
      }
      if (!isSupabaseConfigured || !supabase) {
        show('Supabase ist nicht konfiguriert.', 'error')
        return
      }

      setAnalysisRunError(null)
      setAnalysisRunBusy(true)
      setAnalysisRunPhase(0)
      clearPhaseTimer()
      phaseTimerRef.current = setInterval(() => {
        setAnalysisRunPhase((p) => Math.min(p + 1, 2))
      }, 9000)

      foundation.save({
        market: payload.market,
        competitors: payload.competitors,
        niche: payload.niche,
      })

      try {
        const { data, error } = await supabase.functions.invoke('discovery-agent', {
          body: {
            brand_id: brandId,
            market: payload.market,
            competitors: payload.competitors,
            niche: payload.niche,
          },
        })

        if (error) {
          const ctx = await readInvokeErrorBody(error)
          if (ctx?.code === 'MISSING_API_KEYS') {
            const msg =
              ctx.message ??
              'API Keys fehlen — bitte in Supabase Edge Functions Secrets eintragen.'
            setAnalysisRunError(`${msg}\n\n→ ${ctx.docsPath ?? DOCS_KEYS_PATH}`)
            show('API Keys fehlen — siehe docs/open-questions.md', 'error')
            return
          }
          const hint = ctx?.message ?? (error as Error).message
          setAnalysisRunError(hint ?? 'Analyse fehlgeschlagen.')
          show(hint ?? 'Analyse fehlgeschlagen.', 'error')
          return
        }

        if (
          data &&
          typeof data === 'object' &&
          (data as { ok?: boolean }).ok === false &&
          (data as FnErrorBody).code === 'MISSING_API_KEYS'
        ) {
          const d = data as FnErrorBody
          setAnalysisRunError(
            `${d.message ?? 'API Keys fehlen'}\n\n→ ${d.docsPath ?? DOCS_KEYS_PATH}`,
          )
          show('API Keys fehlen — siehe docs/open-questions.md', 'error')
          return
        }

        setAnalysisRunPhase(2)
        await foundation.reload()
        await feed.reload()
        show('Discovery-Analyse abgeschlossen.', 'success')
      } finally {
        clearPhaseTimer()
        setAnalysisRunBusy(false)
      }
    },
    [slug, brandId, foundation, feed, show],
  )

  const refreshFeed = useCallback(async () => {
    if (!slug || !brandId) return
    if (!isSupabaseConfigured || !supabase) {
      show('Supabase ist nicht konfiguriert.', 'error')
      return
    }
    const { error } = await supabase.functions.invoke('discovery-feed-refresh', {
      body: { brand_id: brandId },
    })
    if (error) {
      const ctx = await readInvokeErrorBody(error)
      if (ctx?.code === 'MISSING_API_KEYS') {
        show(
          'API Keys fehlen — bitte PERPLEXITY_API_KEY in Supabase Secrets eintragen.',
          'error',
        )
        return
      }
      show(ctx?.message ?? error.message ?? 'Feed-Update fehlgeschlagen.', 'error')
      return
    }
    settings.save({ last_feed_generated_at: new Date().toISOString() })
    await feed.reload()
    show('Feed mit aktuellen Signalen ergänzt.', 'success')
  }, [slug, brandId, feed, settings, show])

  const onIntervalChange = useCallback(
    (days: DiscoveryFeedIntervalDays) => {
      settings.save({ feed_interval_days: days })
    },
    [settings],
  )

  const applyIcpDraftsBatch = useCallback(
    (drafts: DiscoveryIcpDraft[]) => {
      if (!drafts.length) return
      let n = 0
      for (const draft of drafts) {
        icps.create({
          name: draft.name,
          age_range: draft.age_range,
          location: draft.location,
          pain_points: draft.pain_hint ? [draft.pain_hint] : [],
          word_clusters: [],
          notes: 'Aus Discovery-Analyse',
        })
        n += 1
      }
      show(`${n} ICPs übernommen`, 'success')
    },
    [icps, show],
  )

  const applyIcp = useCallback(
    (draft: DiscoveryIcpDraft) => {
      applyIcpDraftsBatch([draft])
    },
    [applyIcpDraftsBatch],
  )

  const applyWordSuggestionsBatch = useCallback(
    (list: DiscoveryWordSuggestion[]) => {
      if (!list.length) return
      const existing = new Set(wordBank.items.map((x) => x.word.toLowerCase()))
      let added = 0
      let skipped = 0
      for (const s of list) {
        const w = typeof s.word === 'string' ? s.word.trim() : ''
        if (!w) continue
        const key = w.toLowerCase()
        if (existing.has(key)) {
          skipped += 1
          continue
        }
        existing.add(key)
        wordBank.create({
          word: w,
          type: s.type,
          cluster: s.cluster.trim() || 'Discovery',
        })
        added += 1
      }
      if (!added && skipped) {
        show('Alle Begriffe existieren bereits in der Word Bank', 'info')
        return
      }
      show(
        `${added} Wörter hinzugefügt${skipped ? `, ${skipped} Duplikate übersprungen` : ''}`,
        'success',
      )
    },
    [wordBank, show],
  )

  const applyWord = useCallback(
    (s: DiscoveryWordSuggestion) => {
      applyWordSuggestionsBatch([s])
    },
    [applyWordSuggestionsBatch],
  )

  const applyPositioningIdea = useCallback(
    (idea: string) => {
      const cur = positioning.item?.statement?.trim()
      if (cur) {
        const ok = window.confirm(
          'Positioning ist bereits gesetzt. Mit dem Discovery-Vorschlag überschreiben?',
        )
        if (!ok) return
      }
      positioning.save({ statement: idea })
      if (cur) {
        show('Positioning durch Discovery-Vorschlag ersetzt', 'success')
      } else {
        show('Positioning-Statement gesetzt', 'success')
      }
    },
    [positioning, show],
  )

  const syncFromBuilding = useCallback(() => {
    const bm = businessModel.item
    const pos = positioning.item
    const icpList = icps.items

    const marketParts: string[] = []
    if (bm?.for_whom) marketParts.push(`Zielgruppe: ${bm.for_whom.trim()}`)
    if (bm?.who) marketParts.push(`Eigene Rolle: ${bm.who.trim()}`)
    if (icpList.length) {
      const icpSummary = icpList
        .slice()
        .sort((a, b) => a.priority - b.priority)
        .map((i) => {
          const head = [i.name, i.age_range, i.location]
            .filter((x) => x && x.trim())
            .join(' · ')
          return `• ${head || 'ICP'}`
        })
        .join('\n')
      marketParts.push(`ICPs:\n${icpSummary}`)
    }

    const competitorsParts: string[] = []
    if (pos?.statement) competitorsParts.push(`Wir positionieren uns als: ${pos.statement.trim()}`)
    const painSamples = icpList
      .flatMap((i) => i.pain_points)
      .slice(0, 6)
    if (painSamples.length) {
      competitorsParts.push(
        `Kunden-Pains (aus ICPs):\n${painSamples.map((p) => `• ${p}`).join('\n')}`,
      )
    }
    competitorsParts.push(
      '↳ Wettbewerber-Namen, Profile, Websites hier ergänzen — die Analyse durchsucht den Markt darauf basierend.',
    )

    const nicheParts: string[] = []
    if (pos?.statement) nicheParts.push(pos.statement.trim())
    if (bm?.what) nicheParts.push(`Angebot: ${bm.what.trim()}`)
    if (bm?.how) nicheParts.push(`So machen wir es anders: ${bm.how.trim()}`)
    if (pos?.tone_of_voice) nicheParts.push(`Sprache: ${pos.tone_of_voice.trim()}`)

    const market = marketParts.join('\n\n').trim()
    const competitors = competitorsParts.join('\n\n').trim()
    const niche = nicheParts.join('\n\n').trim()

    if (!market && !competitors && !niche) {
      show('Building ist noch leer — erst dort Foundation ausfüllen.', 'info')
      return
    }

    foundation.save({ market, competitors, niche })
    show('Aus Building übernommen', 'success')
  }, [businessModel.item, positioning.item, icps.items, foundation, show])

  const applyToneOfVoice = useCallback(
    (text: string) => {
      const t = text.trim()
      if (!t) return
      const cur = positioning.item?.tone_of_voice?.trim()
      if (cur) {
        const ok = window.confirm(
          'Tone of Voice ist bereits gesetzt. Mit dem Discovery-Vorschlag überschreiben?',
        )
        if (!ok) return
      }
      positioning.save({ tone_of_voice: t })
      show('Tone of Voice übernommen', 'success')
    },
    [positioning, show],
  )

  return (
    <motion.div
      key={slug}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      style={{ background: 'transparent' }}
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
        analysisRunBusy={analysisRunBusy}
        analysisRunPhase={analysisRunPhase}
        analysisRunError={analysisRunError}
        onDismissAnalysisError={() => setAnalysisRunError(null)}
        onApplyIcpDraft={applyIcp}
        onApplyAllIcpDrafts={applyIcpDraftsBatch}
        onApplyWord={applyWord}
        onApplyAllWords={applyWordSuggestionsBatch}
        onApplyPositioningIdea={applyPositioningIdea}
        onApplyToneOfVoice={applyToneOfVoice}
        onSyncFromBuilding={syncFromBuilding}
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
