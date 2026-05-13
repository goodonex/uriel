import { motion } from 'framer-motion'
import { useCallback, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CollapsibleSection } from '../components/CollapsibleSection'
import { useToast } from '../components/Toast'
import { useAssets } from '../hooks/useAssets'
import { useBrandId } from '../hooks/useBrandId'
import { useBrands } from '../hooks/useBrands'
import { useBusinessModel } from '../hooks/useBusinessModel'
import { useDiscoveryFeed } from '../hooks/useDiscoveryFeed'
import { useDiscoveryFoundation } from '../hooks/useDiscoveryFoundation'
import { useDiscoverySettings } from '../hooks/useDiscoverySettings'
import { useICPs } from '../hooks/useICPs'
import { usePositioning } from '../hooks/usePositioning'
import { useSOPs } from '../hooks/useSOPs'
import { useWordBank } from '../hooks/useWordBank'
import { BrandFoundationProvider } from '../lib/brandFoundationContext'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type { DiscoveryFeedIntervalDays } from '../types/db'
import { ContextExportButton } from '../pages/building/ContextExportButton'
import { BusinessModelSection } from './foundation/BusinessModelSection'
import { CompetitorsSection } from './foundation/CompetitorsSection'
import { DiscoveryFeedSection } from './foundation/DiscoveryFeedSection'
import { ICPsSection } from './foundation/ICPsSection'
import { LibraryAssetsSection } from './foundation/LibraryAssetsSection'
import { LibrarySopsSection } from './foundation/LibrarySopsSection'
import { MarketSection } from './foundation/MarketSection'
import { NicheSection } from './foundation/NicheSection'
import { PositioningToneSection } from './foundation/PositioningToneSection'
import { WordBankSection } from './foundation/WordBankSection'

type FnErrorBody = {
  code?: string
  message?: string
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

function sectionStatus(text: string | null | undefined): 'empty' | 'done' {
  return (text ?? '').trim() ? 'done' : 'empty'
}

export function FoundationMode() {
  const { slug } = useParams<{ slug: string }>()
  const { show } = useToast()
  const { brands } = useBrands()
  const brand = brands.find((b) => b.slug === slug) ?? null
  const brandId = useBrandId(slug)

  const businessModel = useBusinessModel(slug)
  const icps = useICPs(slug)
  const positioning = usePositioning(slug)
  const wordBank = useWordBank(slug)
  const assets = useAssets(slug)
  const sops = useSOPs(slug)
  const discoveryFoundation = useDiscoveryFoundation(slug)
  const discoveryFeed = useDiscoveryFeed(slug)
  const discoverySettings = useDiscoverySettings(slug)
  const [analysisBusy, setAnalysisBusy] = useState(false)

  const bm = businessModel.item
  const bmStatus: 'empty' | 'partial' | 'done' = useMemo(() => {
    if (!bm) return 'empty'
    const filled = [bm.who, bm.what, bm.how, bm.for_whom, bm.revenue].filter(
      (s) => (s ?? '').trim().length > 0,
    ).length
    if (filled === 0) return 'empty'
    if (filled < 5) return 'partial'
    return 'done'
  }, [bm])
  const positioningStatus: 'empty' | 'partial' | 'done' = useMemo(() => {
    const s = positioning.item?.statement?.trim()
    const t = positioning.item?.tone_of_voice?.trim()
    if (!s && !t) return 'empty'
    if (s && t) return 'done'
    return 'partial'
  }, [positioning.item])
  const icpStatus: 'empty' | 'partial' | 'done' =
    icps.items.length === 0 ? 'empty' : icps.items.length < 2 ? 'partial' : 'done'
  const wbStatus: 'empty' | 'partial' | 'done' =
    wordBank.items.length === 0 ? 'empty' : wordBank.items.length < 4 ? 'partial' : 'done'

  const runAnalysis = useCallback(async () => {
    if (!slug || !brandId || !discoveryFoundation.item) {
      show('Foundation noch nicht vollständig geladen.', 'error')
      return
    }
    if (!isSupabaseConfigured || !supabase) {
      show('Supabase ist nicht konfiguriert.', 'error')
      return
    }
    setAnalysisBusy(true)
    try {
      const { market, competitors, niche } = discoveryFoundation.item
      const { error } = await supabase.functions.invoke('discovery-agent', {
        body: { brand_id: brandId, market, competitors, niche },
      })
      if (error) {
        const ctx = await readInvokeErrorBody(error)
        show(ctx?.message ?? error.message ?? 'Analyse fehlgeschlagen', 'error')
        return
      }
      await discoveryFoundation.reload()
      await discoveryFeed.reload()
      show('Discovery-Analyse abgeschlossen.', 'success')
    } finally {
      setAnalysisBusy(false)
    }
  }, [brandId, discoveryFeed, discoveryFoundation, show, slug])

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
      show(ctx?.message ?? error.message ?? 'Feed-Update fehlgeschlagen.', 'error')
      return
    }
    discoverySettings.save({ last_feed_generated_at: new Date().toISOString() })
    await discoveryFeed.reload()
    show('Feed aktualisiert.', 'success')
  }, [brandId, discoveryFeed, discoverySettings, show, slug])

  const onIntervalChange = useCallback(
    (days: DiscoveryFeedIntervalDays) => {
      discoverySettings.save({ feed_interval_days: days })
    },
    [discoverySettings],
  )

  return (
    <BrandFoundationProvider
      brandName={brand?.name ?? slug ?? ''}
      positioning={positioning.item}
      icps={icps.items}
      wordBank={wordBank.items}
      businessModel={businessModel.item}
    >
      <motion.div
        key={slug}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        style={{ background: 'transparent' }}
      >
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div
              className="font-mono"
              style={{
                fontSize: 10,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--mode-building)',
                marginBottom: 6,
              }}
            >
              Foundation
            </div>
            <h2
              className="font-display"
              style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-primary)' }}
            >
              Foundation
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>
              Verstehen — intern und extern
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ContextExportButton
              brand={brand}
              positioning={positioning.item}
              icps={icps.items}
              wordBank={wordBank.items}
            />
            <button
              type="button"
              onClick={runAnalysis}
              disabled={analysisBusy}
              className="font-mono rounded-lg"
              style={{
                fontSize: 11,
                padding: '6px 14px',
                background: 'var(--glass-3)',
                border: '1px solid var(--glass-border-2)',
                color: 'var(--accent-coral)',
                opacity: analysisBusy ? 0.7 : 1,
              }}
            >
              {analysisBusy ? 'Analyse läuft…' : 'Analyse ausführen'}
            </button>
          </div>
        </div>

        <CollapsibleSection title="Business Model" status={bmStatus} defaultOpen>
          <BusinessModelSection
            item={businessModel.item}
            loading={businessModel.loading}
            error={businessModel.error}
            onSave={businessModel.save}
          />
        </CollapsibleSection>

        <CollapsibleSection title="ICPs / Zielgruppen" status={icpStatus}>
          <ICPsSection
            icps={icps.items}
            wordBank={wordBank.items}
            loading={icps.loading}
            error={icps.error}
            onCreate={() => icps.create()}
            onUpdate={icps.update}
            onDelete={icps.remove}
          />
        </CollapsibleSection>

        <CollapsibleSection title="Positioning & Tone" status={positioningStatus}>
          <PositioningToneSection
            item={positioning.item}
            loading={positioning.loading}
            error={positioning.error}
            onSave={positioning.save}
          />
        </CollapsibleSection>

        <CollapsibleSection title="Word Bank" status={wbStatus}>
          <WordBankSection
            items={wordBank.items}
            loading={wordBank.loading}
            error={wordBank.error}
            onCreate={wordBank.create}
            onRemove={wordBank.remove}
          />
        </CollapsibleSection>

        <CollapsibleSection
          title="Markt & Kontext"
          status={sectionStatus(discoveryFoundation.item?.market)}
        >
          <MarketSection
            item={discoveryFoundation.item}
            loading={discoveryFoundation.loading}
            error={discoveryFoundation.error}
            onSave={discoveryFoundation.save}
          />
        </CollapsibleSection>

        <CollapsibleSection
          title="Wettbewerber"
          status={sectionStatus(discoveryFoundation.item?.competitors)}
        >
          <CompetitorsSection
            item={discoveryFoundation.item}
            loading={discoveryFoundation.loading}
            error={discoveryFoundation.error}
            onSave={discoveryFoundation.save}
          />
        </CollapsibleSection>

        <CollapsibleSection
          title="Nische & Schwerpunkt"
          status={sectionStatus(discoveryFoundation.item?.niche)}
        >
          <NicheSection
            item={discoveryFoundation.item}
            loading={discoveryFoundation.loading}
            error={discoveryFoundation.error}
            onSave={discoveryFoundation.save}
          />
        </CollapsibleSection>

        <CollapsibleSection
          title="Discovery Feed"
          meta={discoveryFeed.items.length ? `${discoveryFeed.items.length} Signale` : undefined}
          defaultOpen={false}
        >
          {slug ? (
            <DiscoveryFeedSection
              slug={slug}
              items={discoveryFeed.items}
              loading={discoveryFeed.loading}
              error={discoveryFeed.error}
              settings={discoverySettings.item}
              settingsLoading={discoverySettings.loading}
              onIntervalChange={onIntervalChange}
              onRefreshFeed={refreshFeed}
            />
          ) : null}
        </CollapsibleSection>

        <CollapsibleSection
          title="Library"
          meta={`${assets.items.length + sops.items.length} Einträge`}
          defaultOpen={false}
        >
          <div style={{ display: 'grid', gap: 18 }}>
            <LibraryAssetsSection
              items={assets.items}
              loading={assets.loading}
              error={assets.error}
              onCreate={() => assets.create()}
              onUpdate={assets.update}
              onRemove={assets.remove}
            />
            <LibrarySopsSection
              items={sops.items}
              loading={sops.loading}
              error={sops.error}
              onCreate={() => sops.create()}
              onUpdate={sops.update}
              onDelete={sops.remove}
            />
          </div>
        </CollapsibleSection>
      </motion.div>
    </BrandFoundationProvider>
  )
}
