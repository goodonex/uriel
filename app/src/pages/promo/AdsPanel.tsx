/**
 * AdsPanel — Promo > Ads.
 * Builder (Plattform/Hook/Body/CTA mit KI), UTM-Generator, Tracking-Link, Performance-Dashboard.
 */
import { motion } from 'framer-motion'
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { useToast } from '../../components/Toast'
import { useAdCampaigns } from '../../hooks/useAdCampaigns'
import { useBrandId } from '../../hooks/useBrandId'
import { useBrands } from '../../hooks/useBrands'
import { useBusinessModel } from '../../hooks/useBusinessModel'
import { useICPs } from '../../hooks/useICPs'
import { usePositioning } from '../../hooks/usePositioning'
import { useWordBank } from '../../hooks/useWordBank'
import {
  generateMarketingText,
  type AdCopySiblings,
  type AdField,
  type MarketingPlatform,
} from '../../lib/marketingAi'
import type { AdCampaign, AdPlatform, AdStatus } from '../../types/db'

interface AdsPanelProps {
  slug: string
}

const PLATFORM_META: Record<AdPlatform, { label: string; accent: string }> = {
  linkedin: { label: 'LinkedIn', accent: '#0A66C2' },
  meta: { label: 'Meta', accent: '#1877F2' },
  google: { label: 'Google', accent: '#EA4335' },
  tiktok: { label: 'TikTok', accent: '#FF0050' },
  other: { label: 'Andere', accent: 'var(--text-tertiary)' },
}

const STATUS_META: Record<AdStatus, { label: string; accent: string }> = {
  draft: { label: 'Entwurf', accent: 'var(--text-tertiary)' },
  live: { label: 'Live', accent: 'var(--accent-teal)' },
  paused: { label: 'Pausiert', accent: 'var(--mode-sales)' },
  ended: { label: 'Beendet', accent: 'var(--accent-coral)' },
}

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? ''

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

function buildLandingUrl(brandSlug: string, c: AdCampaign): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const params = new URLSearchParams()
  if (c.utm_campaign) params.set('campaign', c.utm_campaign)
  if (c.utm_source) params.set('source', c.utm_source)
  if (c.utm_medium) params.set('medium', c.utm_medium)
  if (c.utm_content) params.set('content', c.utm_content)
  return `${origin}/leads/${brandSlug}?${params.toString()}`
}

function buildTrackingUrl(c: AdCampaign): string {
  if (!SUPABASE_URL) return ''
  const dest = c.target_url || ''
  const params = new URLSearchParams()
  params.set('c', c.id)
  if (dest) params.set('u', dest)
  if (c.utm_content) params.set('k', c.utm_content)
  return `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/track-click?${params.toString()}`
}

function debounce<F extends (...args: never[]) => void>(fn: F, ms: number): F {
  let h: number | null = null
  return ((...args: never[]) => {
    if (h) window.clearTimeout(h)
    h = window.setTimeout(() => fn(...args), ms)
  }) as F
}

export function AdsPanel({ slug }: AdsPanelProps) {
  const camps = useAdCampaigns(slug)
  const brandId = useBrandId(slug)
  const { brands } = useBrands()
  const brand = useMemo(() => brands.find((b) => b.slug === slug), [brands, slug])
  const positioning = usePositioning(slug)
  const icps = useICPs(slug)
  const wordBank = useWordBank(slug)
  const businessModel = useBusinessModel(slug)
  const { show } = useToast()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [view, setView] = useState<'builder' | 'performance'>('builder')

  const active = useMemo(
    () => camps.items.find((c) => c.id === activeId) ?? null,
    [camps.items, activeId],
  )

  useEffect(() => {
    if (!activeId && camps.items.length > 0) setActiveId(camps.items[0].id)
  }, [camps.items, activeId])

  const persist = useMemo(
    () =>
      debounce((id: string, patch: Partial<AdCampaign>) => {
        void camps.update(id, patch)
      }, 400),
    [camps],
  )

  const onField = useCallback(
    (patch: Partial<AdCampaign>) => {
      if (!active) return
      persist(active.id, patch)
    },
    [active, persist],
  )

  const aiContext = useMemo(() => {
    const yes: string[] = []
    const no: string[] = []
    for (const w of wordBank.items) {
      if (w.type === 'yes') yes.push(w.word)
      else if (w.type === 'no') no.push(w.word)
    }
    return {
      positioning_statement: positioning.item?.statement ?? '',
      tone_of_voice: positioning.item?.tone_of_voice ?? '',
      business_model: businessModel.item
        ? {
            who: businessModel.item.who,
            what: businessModel.item.what,
            how: businessModel.item.how,
            for_whom: businessModel.item.for_whom,
            revenue: businessModel.item.revenue,
          }
        : undefined,
      icps: icps.items.map((i) => ({
        name: i.name,
        pain_points: i.pain_points,
        location: i.location,
      })),
      word_bank: { yes, no },
    }
  }, [positioning.item, wordBank.items, businessModel.item, icps.items])

  const createNew = async () => {
    const name = window.prompt('Name der Kampagne?', 'Neue Kampagne')
    if (!name?.trim()) return
    const utmCampaign = slugify(`${slug}-${name}-${Date.now().toString(36).slice(-4)}`)
    const target = buildLandingUrl(slug, {
      utm_campaign: utmCampaign,
      utm_source: 'brandos',
      utm_medium: 'paid',
      utm_content: '',
      id: '',
    } as AdCampaign)
    const created = await camps.create({
      name: name.trim(),
      utm_campaign: utmCampaign,
      utm_source: 'brandos',
      utm_medium: 'paid',
      target_url: target,
    })
    setActiveId(created.id)
    show('Kampagne angelegt', 'success')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <PerformanceBanner items={camps.items} />

      <div style={{ display: 'flex', gap: 6 }}>
        <ViewToggle on={view === 'builder'} onClick={() => setView('builder')}>
          Builder
        </ViewToggle>
        <ViewToggle on={view === 'performance'} onClick={() => setView('performance')}>
          Performance
        </ViewToggle>
      </div>

      {view === 'performance' ? (
        <PerformanceDashboard items={camps.items} />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '260px 1fr',
            gap: 14,
            minHeight: 580,
          }}
        >
          <aside
            style={{
              background: 'var(--glass-1)',
              border: '1px solid var(--glass-border-1)',
              borderRadius: 14,
              padding: 14,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              height: 'fit-content',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span
                className="font-mono"
                style={{ fontSize: 9, letterSpacing: '0.14em', color: 'var(--text-tertiary)' }}
              >
                KAMPAGNEN ({camps.items.length})
              </span>
              <button
                type="button"
                onClick={createNew}
                className="font-mono"
                style={{
                  fontSize: 10,
                  padding: '4px 9px',
                  borderRadius: 7,
                  border: '1px solid var(--accent-blue)',
                  background: 'color-mix(in srgb, var(--accent-blue) 14%, transparent)',
                  color: 'var(--accent-blue)',
                  cursor: 'pointer',
                }}
              >
                + Neu
              </button>
            </div>

            {camps.loading ? (
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Lädt…</div>
            ) : camps.items.length === 0 ? (
              <div
                style={{
                  padding: 14,
                  border: '1px dashed var(--glass-border-2)',
                  borderRadius: 10,
                  fontSize: 11,
                  color: 'var(--text-tertiary)',
                  textAlign: 'center',
                  lineHeight: 1.6,
                }}
              >
                Noch keine Kampagnen.
                <br />
                <strong>+ Neu</strong> klicken.
              </div>
            ) : (
              camps.items.map((c) => (
                <CampListItem
                  key={c.id}
                  campaign={c}
                  active={c.id === activeId}
                  onSelect={() => setActiveId(c.id)}
                />
              ))
            )}
          </aside>

          {!active ? (
            <div
              style={{
                background: 'var(--glass-1)',
                border: '1px dashed var(--glass-border-2)',
                borderRadius: 14,
                display: 'grid',
                placeItems: 'center',
                color: 'var(--text-tertiary)',
                fontSize: 13,
                padding: 32,
              }}
            >
              Kampagne wählen oder neu anlegen.
            </div>
          ) : (
            <CampaignEditor
              key={active.id}
              campaign={active}
              brandSlug={slug}
              brandId={brandId ?? undefined}
              brandName={brand?.name}
              aiContext={aiContext}
              onField={onField}
              onRemove={() => {
                if (!window.confirm(`Kampagne „${active.name || 'unbenannt'}" löschen?`)) return
                void camps.remove(active.id)
                setActiveId(null)
              }}
            />
          )}
        </div>
      )}
    </div>
  )
}

function ViewToggle({
  on,
  onClick,
  children,
}: {
  on: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="font-mono"
      style={{
        padding: '7px 14px',
        borderRadius: 999,
        border: on ? '1px solid var(--accent-blue)' : '1px solid var(--glass-border-2)',
        background: on
          ? 'color-mix(in srgb, var(--accent-blue) 16%, transparent)'
          : 'var(--glass-2)',
        color: on ? 'var(--accent-blue)' : 'var(--text-secondary)',
        fontSize: 11,
        letterSpacing: '0.08em',
        fontWeight: on ? 600 : 400,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}

// =====================================================
// PerformanceBanner — Hero-Block oben
// =====================================================

function PerformanceBanner({ items }: { items: AdCampaign[] }) {
  const totals = useMemo(() => {
    let clicks = 0
    let leads = 0
    let spent = 0
    let live = 0
    let bestLeads = 0
    let bestName = ''
    for (const c of items) {
      clicks += c.clicks_count ?? 0
      leads += c.leads_count ?? 0
      spent += Number(c.budget_spent ?? 0)
      if (c.status === 'live') live++
      if ((c.leads_count ?? 0) > bestLeads) {
        bestLeads = c.leads_count ?? 0
        bestName = c.name
      }
    }
    const cpl = leads > 0 ? spent / leads : 0
    return { clicks, leads, spent, live, cpl, bestName, bestLeads }
  }, [items])

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 10,
        padding: 16,
        borderRadius: 14,
        background:
          'linear-gradient(135deg, color-mix(in srgb, var(--accent-blue) 16%, var(--glass-1)) 0%, color-mix(in srgb, var(--accent-teal) 8%, var(--glass-1)) 100%)',
        border: '1px solid color-mix(in srgb, var(--accent-blue) 38%, var(--glass-border-1))',
      }}
    >
      <Metric label="LIVE-KAMPAGNEN" value={totals.live.toString()} hint={`${items.length} gesamt`} accent="var(--accent-teal)" />
      <Metric label="KLICKS" value={totals.clicks.toLocaleString('de-DE')} accent="var(--accent-blue)" />
      <Metric label="LEADS" value={totals.leads.toLocaleString('de-DE')} hint={totals.bestName ? `Top · ${totals.bestName}` : undefined} accent="var(--mode-promo)" />
      <Metric
        label="COST / LEAD"
        value={totals.cpl > 0 ? `€${totals.cpl.toFixed(0)}` : '—'}
        hint={totals.spent > 0 ? `€${totals.spent.toFixed(0)} ausgegeben` : undefined}
        accent="var(--accent-coral)"
      />
    </motion.div>
  )
}

function Metric({
  label,
  value,
  hint,
  accent,
}: {
  label: string
  value: string
  hint?: string
  accent: string
}) {
  return (
    <div>
      <div className="font-mono" style={{ fontSize: 9, letterSpacing: '0.14em', color: accent, fontWeight: 600 }}>
        {label}
      </div>
      <div
        className="font-display"
        style={{
          marginTop: 4,
          fontSize: 26,
          fontWeight: 700,
          letterSpacing: '-0.3px',
          color: 'var(--text-primary)',
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      {hint ? (
        <div className="font-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 2 }}>
          {hint}
        </div>
      ) : null}
    </div>
  )
}

// =====================================================
// PerformanceDashboard — sortierte Liste mit Bars
// =====================================================

function PerformanceDashboard({ items }: { items: AdCampaign[] }) {
  const ranked = useMemo(
    () =>
      [...items].sort((a, b) => (b.leads_count ?? 0) - (a.leads_count ?? 0)),
    [items],
  )
  const maxClicks = Math.max(1, ...items.map((i) => i.clicks_count ?? 0))
  const maxLeads = Math.max(1, ...items.map((i) => i.leads_count ?? 0))

  if (items.length === 0) {
    return (
      <div
        style={{
          padding: 32,
          background: 'var(--glass-1)',
          border: '1px dashed var(--glass-border-2)',
          borderRadius: 14,
          textAlign: 'center',
          color: 'var(--text-tertiary)',
          fontSize: 13,
        }}
      >
        Keine Kampagnen-Daten — leg eine Kampagne im Builder an.
      </div>
    )
  }

  return (
    <div
      style={{
        background: 'var(--glass-1)',
        border: '1px solid var(--glass-border-1)',
        borderRadius: 14,
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div
        className="font-mono"
        style={{
          display: 'grid',
          gridTemplateColumns: '1.5fr 80px 80px 80px 100px 80px',
          gap: 8,
          padding: '8px 12px',
          fontSize: 9,
          letterSpacing: '0.12em',
          color: 'var(--text-tertiary)',
        }}
      >
        <span>KAMPAGNE</span>
        <span style={{ textAlign: 'right' }}>KLICKS</span>
        <span style={{ textAlign: 'right' }}>LEADS</span>
        <span style={{ textAlign: 'right' }}>CR</span>
        <span style={{ textAlign: 'right' }}>BUDGET</span>
        <span style={{ textAlign: 'right' }}>CPL</span>
      </div>
      {ranked.map((c) => {
        const cr = (c.clicks_count ?? 0) > 0 ? ((c.leads_count ?? 0) / (c.clicks_count ?? 1)) * 100 : 0
        const cpl = (c.leads_count ?? 0) > 0 ? Number(c.budget_spent ?? 0) / (c.leads_count ?? 1) : 0
        const status = STATUS_META[c.status]
        const platform = PLATFORM_META[c.platform]
        return (
          <div
            key={c.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '1.5fr 80px 80px 80px 100px 80px',
              gap: 8,
              padding: '10px 12px',
              borderRadius: 9,
              background: 'var(--glass-2)',
              border: '1px solid var(--glass-border-2)',
              alignItems: 'center',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {c.name || '(unbenannt)'}
              </div>
              <div
                className="font-mono"
                style={{
                  display: 'flex',
                  gap: 8,
                  marginTop: 2,
                  fontSize: 9,
                  color: 'var(--text-tertiary)',
                  letterSpacing: '0.06em',
                }}
              >
                <span style={{ color: platform.accent }}>{platform.label}</span>
                <span>·</span>
                <span style={{ color: status.accent }}>{status.label}</span>
              </div>
            </div>
            <Bar value={c.clicks_count ?? 0} max={maxClicks} accent="var(--accent-blue)" />
            <Bar value={c.leads_count ?? 0} max={maxLeads} accent="var(--accent-teal)" />
            <NumberCell value={`${cr.toFixed(1)}%`} dim={cr === 0} />
            <NumberCell value={`€${Number(c.budget_spent ?? 0).toFixed(0)} / ${Number(c.budget_total ?? 0).toFixed(0)}`} small />
            <NumberCell value={cpl > 0 ? `€${cpl.toFixed(0)}` : '—'} dim={cpl === 0} />
          </div>
        )
      })}
    </div>
  )
}

function Bar({ value, max, accent }: { value: number; max: number; accent: string }) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  return (
    <div style={{ position: 'relative', height: 22, textAlign: 'right' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 5,
          background: 'var(--glass-1)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: `${100 - pct}%`,
          right: 0,
          top: 0,
          bottom: 0,
          borderRadius: 5,
          background: `color-mix(in srgb, ${accent} 28%, transparent)`,
        }}
      />
      <span
        className="font-mono"
        style={{
          position: 'relative',
          fontSize: 11,
          color: 'var(--text-primary)',
          paddingRight: 6,
          display: 'inline-block',
          lineHeight: '22px',
        }}
      >
        {value.toLocaleString('de-DE')}
      </span>
    </div>
  )
}

function NumberCell({ value, dim, small }: { value: string; dim?: boolean; small?: boolean }) {
  return (
    <span
      className="font-mono"
      style={{
        fontSize: small ? 10 : 11,
        textAlign: 'right',
        color: dim ? 'var(--text-tertiary)' : 'var(--text-primary)',
      }}
    >
      {value}
    </span>
  )
}

// =====================================================
// CampaignList & Editor
// =====================================================

function CampListItem({
  campaign,
  active,
  onSelect,
}: {
  campaign: AdCampaign
  active: boolean
  onSelect: () => void
}) {
  const status = STATUS_META[campaign.status]
  const platform = PLATFORM_META[campaign.platform]
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        width: '100%',
        textAlign: 'left',
        padding: '9px 11px',
        borderRadius: 9,
        border: active ? '1px solid var(--accent-blue)' : '1px solid var(--glass-border-2)',
        background: active
          ? 'color-mix(in srgb, var(--accent-blue) 14%, var(--glass-2))'
          : 'var(--glass-2)',
        cursor: 'pointer',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 6,
          alignItems: 'baseline',
        }}
      >
        <span
          style={{
            fontSize: 12,
            color: 'var(--text-primary)',
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: 180,
          }}
        >
          {campaign.name || '(unbenannt)'}
        </span>
        <span
          className="font-mono"
          style={{
            fontSize: 8,
            letterSpacing: '0.1em',
            color: status.accent,
            fontWeight: 600,
          }}
        >
          {status.label.toUpperCase()}
        </span>
      </div>
      <div
        className="font-mono"
        style={{ marginTop: 4, fontSize: 10, color: platform.accent, display: 'flex', gap: 6 }}
      >
        <span>{platform.label}</span>
        <span style={{ color: 'var(--text-tertiary)' }}>·</span>
        <span style={{ color: 'var(--text-tertiary)' }}>
          {(campaign.clicks_count ?? 0).toLocaleString('de-DE')} K · {(campaign.leads_count ?? 0).toLocaleString('de-DE')} L
        </span>
      </div>
    </button>
  )
}

function CampaignEditor({
  campaign,
  brandSlug,
  brandId,
  brandName,
  aiContext,
  onField,
  onRemove,
}: {
  campaign: AdCampaign
  brandSlug: string
  brandId?: string
  brandName?: string
  aiContext: unknown
  onField: (patch: Partial<AdCampaign>) => void
  onRemove: () => void
}) {
  const [draft, setDraft] = useState(campaign)
  useEffect(() => {
    setDraft(campaign)
  }, [campaign.id])
  const updateDraft = (patch: Partial<AdCampaign>) => {
    setDraft((d) => ({ ...d, ...patch }))
    onField(patch)
  }
  const { show } = useToast()

  const landingUrl = useMemo(() => buildLandingUrl(brandSlug, draft), [brandSlug, draft])
  const trackingUrl = useMemo(() => buildTrackingUrl(draft), [draft])

  const copy = async (val: string, label: string) => {
    try {
      await navigator.clipboard.writeText(val)
      show(`${label} kopiert`, 'success')
    } catch {
      show('Kopieren fehlgeschlagen', 'info')
    }
  }

  const platformForAi: MarketingPlatform =
    draft.platform === 'meta'
      ? 'meta'
      : draft.platform === 'google'
        ? 'google'
        : draft.platform === 'linkedin'
          ? 'linkedin_ad'
          : 'other'

  return (
    <section
      style={{
        background: 'var(--glass-1)',
        border: '1px solid var(--glass-border-1)',
        borderRadius: 14,
        padding: 18,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <input
            type="text"
            value={draft.name}
            onChange={(e) => updateDraft({ name: e.target.value })}
            placeholder="Kampagnen-Name …"
            className="font-display"
            style={{
              width: '100%',
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: '-0.3px',
              border: 'none',
              background: 'transparent',
              color: 'var(--text-primary)',
              outline: 'none',
              padding: 0,
            }}
          />
          <div
            className="font-mono"
            style={{ marginTop: 4, fontSize: 10, color: 'var(--text-tertiary)' }}
          >
            UTM: {draft.utm_campaign || '—'}
          </div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="font-mono"
          style={{
            fontSize: 10,
            padding: '6px 10px',
            borderRadius: 8,
            border: '1px solid color-mix(in srgb, var(--accent-coral) 50%, transparent)',
            background: 'transparent',
            color: 'var(--accent-coral)',
            cursor: 'pointer',
          }}
        >
          Löschen
        </button>
      </header>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <PillGroup label="PLATTFORM">
          {(Object.keys(PLATFORM_META) as AdPlatform[]).map((p) => {
            const m = PLATFORM_META[p]
            const on = draft.platform === p
            return (
              <Pill
                key={p}
                label={m.label}
                accent={m.accent}
                on={on}
                onClick={() => updateDraft({ platform: p })}
              />
            )
          })}
        </PillGroup>
        <PillGroup label="STATUS">
          {(Object.keys(STATUS_META) as AdStatus[]).map((s) => {
            const m = STATUS_META[s]
            const on = draft.status === s
            return (
              <Pill
                key={s}
                label={m.label}
                accent={m.accent}
                on={on}
                onClick={() => updateDraft({ status: s })}
              />
            )
          })}
        </PillGroup>
      </div>

      <AiField
        label="HOOK"
        value={draft.hook}
        onChange={(v) => updateDraft({ hook: v })}
        placeholder="Aufmerksamkeitsstarker Hook — max. 12 Wörter."
        rows={2}
        aiField="hook"
        platform={platformForAi}
        campaignName={draft.name}
        brandId={brandId}
        brandName={brandName}
        aiContext={aiContext}
        adCopy={{ hook: draft.hook, body: draft.body, cta: draft.cta }}
      />
      <AiField
        label="BODY"
        value={draft.body}
        onChange={(v) => updateDraft({ body: v })}
        placeholder="2-3 Sätze, Problem + Lösung."
        rows={4}
        aiField="body"
        platform={platformForAi}
        campaignName={draft.name}
        brandId={brandId}
        brandName={brandName}
        aiContext={aiContext}
        adCopy={{ hook: draft.hook, body: draft.body, cta: draft.cta }}
      />
      <AiField
        label="CTA"
        value={draft.cta}
        onChange={(v) => updateDraft({ cta: v })}
        placeholder="Max. 4 Wörter, action-orientiert."
        rows={1}
        aiField="cta"
        platform={platformForAi}
        campaignName={draft.name}
        brandId={brandId}
        brandName={brandName}
        aiContext={aiContext}
        adCopy={{ hook: draft.hook, body: draft.body, cta: draft.cta }}
      />

      {/* Budget + Laufzeit */}
      <div
        style={{
          background: 'var(--glass-2)',
          border: '1px solid var(--glass-border-2)',
          borderRadius: 12,
          padding: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div
          className="font-mono"
          style={{ fontSize: 9, letterSpacing: '0.14em', color: 'var(--text-tertiary)' }}
        >
          BUDGET & LAUFZEIT
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          <Field
            label="Budget €"
            type="number"
            value={String(draft.budget_total)}
            onChange={(v) => updateDraft({ budget_total: parseFloat(v || '0') || 0 })}
          />
          <Field
            label="Ausgegeben €"
            type="number"
            value={String(draft.budget_spent)}
            onChange={(v) => updateDraft({ budget_spent: parseFloat(v || '0') || 0 })}
          />
          <Field
            label="Cost / Lead €"
            type="number"
            value={String(draft.cost_per_lead)}
            onChange={(v) => updateDraft({ cost_per_lead: parseFloat(v || '0') || 0 })}
          />
          <Field
            label="Leads"
            type="number"
            value={String(draft.leads_count)}
            onChange={(v) => updateDraft({ leads_count: parseInt(v || '0', 10) || 0 })}
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Field
            label="Start"
            type="date"
            value={draft.start_date ?? ''}
            onChange={(v) => updateDraft({ start_date: v || null })}
          />
          <Field
            label="Ende"
            type="date"
            value={draft.end_date ?? ''}
            onChange={(v) => updateDraft({ end_date: v || null })}
          />
        </div>
      </div>

      {/* UTM + Tracking */}
      <div
        style={{
          background: 'var(--glass-2)',
          border: '1px solid var(--glass-border-2)',
          borderRadius: 12,
          padding: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div
          className="font-mono"
          style={{ fontSize: 9, letterSpacing: '0.14em', color: 'var(--text-tertiary)' }}
        >
          UTM & TRACKING-LINKS
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          <Field label="utm_source" value={draft.utm_source} onChange={(v) => updateDraft({ utm_source: v })} placeholder="brandos" />
          <Field label="utm_medium" value={draft.utm_medium} onChange={(v) => updateDraft({ utm_medium: v })} placeholder="paid" />
          <Field label="utm_campaign" value={draft.utm_campaign} onChange={(v) => updateDraft({ utm_campaign: v })} placeholder="brand-2026q2" />
          <Field label="utm_content" value={draft.utm_content} onChange={(v) => updateDraft({ utm_content: v })} placeholder="creative-a" />
        </div>

        <Field
          label="Ziel-URL (eigene Landingpage — leer = nutze Lead-Formular)"
          value={draft.target_url}
          onChange={(v) => updateDraft({ target_url: v })}
          placeholder={landingUrl}
        />

        <LinkBox label="LEAD-FORMULAR (CRM Auto-Intake)" value={landingUrl} accent="var(--accent-teal)" onCopy={() => copy(landingUrl, 'Lead-Link')} />
        {trackingUrl ? (
          <LinkBox label="TRACKING-LINK (für Anzeige)" value={trackingUrl} accent="var(--accent-blue)" onCopy={() => copy(trackingUrl, 'Tracking-Link')} />
        ) : null}
      </div>
    </section>
  )
}

// =====================================================
// Subcomponents
// =====================================================

function LinkBox({
  label,
  value,
  accent,
  onCopy,
}: {
  label: string
  value: string
  accent: string
  onCopy: () => void
}) {
  return (
    <div
      style={{
        padding: 10,
        borderRadius: 10,
        background: `color-mix(in srgb, ${accent} 8%, var(--bg-deep))`,
        border: `1px solid color-mix(in srgb, ${accent} 35%, transparent)`,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div className="font-mono" style={{ fontSize: 9, color: accent, letterSpacing: '0.1em' }}>
        {label}
      </div>
      <code
        style={{
          fontSize: 11,
          color: 'var(--text-primary)',
          background: 'var(--glass-1)',
          padding: '7px 9px',
          borderRadius: 7,
          wordBreak: 'break-all',
          fontFamily: 'ui-monospace, monospace',
        }}
      >
        {value}
      </code>
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          type="button"
          onClick={onCopy}
          className="font-mono"
          style={{
            fontSize: 10,
            padding: '6px 10px',
            borderRadius: 7,
            border: `1px solid ${accent}`,
            background: `color-mix(in srgb, ${accent} 16%, transparent)`,
            color: accent,
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          ⎘ Kopieren
        </button>
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono"
          style={{
            fontSize: 10,
            padding: '6px 10px',
            borderRadius: 7,
            border: '1px solid var(--glass-border-2)',
            background: 'var(--glass-2)',
            color: 'var(--text-secondary)',
            textDecoration: 'none',
            cursor: 'pointer',
          }}
        >
          ↗ Öffnen
        </a>
      </div>
    </div>
  )
}

function AiField({
  label,
  value,
  onChange,
  placeholder,
  rows,
  aiField,
  platform,
  campaignName,
  brandId,
  brandName,
  aiContext,
  adCopy,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  rows: number
  aiField: AdField
  platform: MarketingPlatform
  campaignName: string
  brandId?: string
  brandName?: string
  aiContext: unknown
  adCopy?: AdCopySiblings
}) {
  const [variants, setVariants] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const { show } = useToast()

  const requestVariants = async () => {
    if (loading) return
    setLoading(true)
    setVariants([])
    const res = await generateMarketingText({
      kind: 'ad',
      field: aiField,
      brand_id: brandId,
      brand_name: brandName,
      platform,
      title: campaignName,
      current_value: value,
      ad_copy: adCopy,
      context: aiContext as never,
    })
    setLoading(false)
    if (res.error) {
      show(`KI-Fehler: ${res.error}`, 'info')
      return
    }
    setVariants(res.variants ?? [])
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}
      >
        <span
          className="font-mono"
          style={{ fontSize: 9, letterSpacing: '0.14em', color: 'var(--text-tertiary)' }}
        >
          {label}
        </span>
        <button
          type="button"
          onClick={requestVariants}
          disabled={loading}
          className="font-mono"
          style={{
            fontSize: 10,
            padding: '4px 9px',
            borderRadius: 6,
            border: '1px solid var(--accent-blue)',
            background: 'color-mix(in srgb, var(--accent-blue) 14%, transparent)',
            color: 'var(--accent-blue)',
            cursor: loading ? 'wait' : 'pointer',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? 'KI denkt …' : '✨ 3 Vorschläge'}
        </button>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        style={{
          width: '100%',
          padding: '10px 12px',
          borderRadius: 9,
          border: '1px solid var(--glass-border-2)',
          background: 'var(--glass-2)',
          color: 'var(--text-primary)',
          fontSize: 13,
          fontFamily: 'inherit',
          lineHeight: 1.5,
          outline: 'none',
          resize: 'vertical',
        }}
      />
      {variants.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {variants.map((v, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                onChange(v)
                setVariants([])
                show('Vorschlag übernommen', 'success')
              }}
              style={{
                textAlign: 'left',
                padding: '10px 12px',
                borderRadius: 9,
                border: '1px solid color-mix(in srgb, var(--accent-blue) 35%, transparent)',
                background: 'color-mix(in srgb, var(--accent-blue) 7%, var(--glass-1))',
                color: 'var(--text-primary)',
                fontSize: 12,
                lineHeight: 1.55,
                whiteSpace: 'pre-wrap',
                cursor: 'pointer',
              }}
            >
              <div
                className="font-mono"
                style={{
                  fontSize: 8,
                  color: 'var(--accent-blue)',
                  letterSpacing: '0.1em',
                  marginBottom: 4,
                }}
              >
                ✨ VARIANTE {idx + 1} · KLICK ZUM ÜBERNEHMEN
              </div>
              {v}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function PillGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div
        className="font-mono"
        style={{
          fontSize: 9,
          letterSpacing: '0.14em',
          color: 'var(--text-tertiary)',
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{children}</div>
    </div>
  )
}

function Pill({
  label,
  accent,
  on,
  onClick,
}: {
  label: string
  accent: string
  on: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="font-mono"
      style={{
        fontSize: 10,
        padding: '6px 10px',
        borderRadius: 999,
        border: on ? `1px solid ${accent}` : '1px solid var(--glass-border-2)',
        background: on
          ? `color-mix(in srgb, ${accent} 18%, transparent)`
          : 'var(--glass-2)',
        color: on ? accent : 'var(--text-tertiary)',
        cursor: 'pointer',
        fontWeight: on ? 600 : 400,
      }}
    >
      {label}
    </button>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span
        className="font-mono"
        style={{ fontSize: 9, letterSpacing: '0.08em', color: 'var(--text-tertiary)' }}
      >
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="font-mono"
        style={inputStyle}
      />
    </label>
  )
}

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '7px 9px',
  borderRadius: 7,
  border: '1px solid var(--glass-border-2)',
  background: 'var(--glass-1)',
  color: 'var(--text-primary)',
  fontSize: 11,
  outline: 'none',
}
