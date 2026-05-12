/**
 * RecruitingPanel — Promo-Tab für Stellenanzeigen mit:
 *   - Live-CultureFit-Waitlist-Counter oben
 *   - Job-Liste (Sidebar links)
 *   - Editor rechts mit Titel, Beschreibung, Anforderungen, Benefits, Format, Status
 *   - KI-Variant-Generator pro Feld (marketing-ai)
 *   - UTM-Link-Generator für CultureFit (culturefit.to/mitmachen?...)
 *
 * Speichert via useRecruitingJobs (debounced).
 */
import { motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useToast } from '../../components/Toast'
import { useBrandId } from '../../hooks/useBrandId'
import { useBrands } from '../../hooks/useBrands'
import { useBusinessModel } from '../../hooks/useBusinessModel'
import { useCultureFitWaitlist } from '../../hooks/useCultureFitWaitlist'
import { useICPs } from '../../hooks/useICPs'
import { usePositioning } from '../../hooks/usePositioning'
import { useRecruitingJobs } from '../../hooks/useRecruitingJobs'
import { useWordBank } from '../../hooks/useWordBank'
import {
  generateMarketingText,
  type MarketingPlatform,
  type RecruitingField,
} from '../../lib/marketingAi'
import type { RecruitingJob, RecruitingJobFormat, RecruitingJobStatus } from '../../types/db'

interface RecruitingPanelProps {
  slug: string
}

const FORMAT_META: Record<RecruitingJobFormat, { label: string; accent: string; hint: string }> = {
  linkedin_organic: {
    label: 'LinkedIn · Organisch',
    accent: '#0A66C2',
    hint: 'Post oder Stellenangebot manuell auf LinkedIn — Brand-Stimme.',
  },
  linkedin_ad: {
    label: 'LinkedIn · Ad',
    accent: 'var(--accent-blue)',
    hint: 'Bezahlte LinkedIn-Anzeige — kurz, performance-orientiert.',
  },
  culturefit: {
    label: 'CultureFit',
    accent: 'var(--accent-teal)',
    hint: 'Direkt auf culturefit.to/mitmachen mit UTM-Tracking.',
  },
  other: {
    label: 'Anders',
    accent: 'var(--text-tertiary)',
    hint: 'Anderes Medium / Plattform.',
  },
}

const STATUS_META: Record<RecruitingJobStatus, { label: string; accent: string }> = {
  draft: { label: 'Entwurf', accent: 'var(--text-tertiary)' },
  active: { label: 'Aktiv', accent: 'var(--accent-teal)' },
  paused: { label: 'Pausiert', accent: 'var(--mode-sales)' },
  closed: { label: 'Abgeschlossen', accent: 'var(--accent-coral)' },
}

const CULTUREFIT_BASE_URL =
  (import.meta.env.VITE_CULTUREFIT_URL as string | undefined) ??
  'https://culturefit.to/mitmachen'

function buildUtmLink(job: RecruitingJob, brandSlug: string): string {
  if (job.format === 'culturefit') {
    const params = new URLSearchParams()
    params.set('utm_source', job.utm_source || 'brandos')
    params.set('utm_medium', job.utm_medium || 'recruiting')
    params.set('utm_campaign', job.utm_campaign || brandSlug)
    params.set('utm_content', job.title?.toLowerCase().replace(/\s+/g, '-').slice(0, 40) || job.id)
    return `${CULTUREFIT_BASE_URL}?${params.toString()}`
  }
  return job.external_url
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

function debounce<F extends (...args: never[]) => void>(fn: F, ms: number): F {
  let h: number | null = null
  return ((...args: never[]) => {
    if (h) window.clearTimeout(h)
    h = window.setTimeout(() => fn(...args), ms)
  }) as F
}

export function RecruitingPanel({ slug }: RecruitingPanelProps) {
  const jobs = useRecruitingJobs(slug)
  const brandId = useBrandId(slug)
  const { brands } = useBrands()
  const brand = useMemo(() => brands.find((b) => b.slug === slug), [brands, slug])
  const positioning = usePositioning(slug)
  const icps = useICPs(slug)
  const wordBank = useWordBank(slug)
  const businessModel = useBusinessModel(slug)
  const waitlist = useCultureFitWaitlist()
  const { show } = useToast()
  const [activeId, setActiveId] = useState<string | null>(null)

  const active = useMemo(
    () => jobs.items.find((j) => j.id === activeId) ?? null,
    [jobs.items, activeId],
  )

  useEffect(() => {
    if (!activeId && jobs.items.length > 0) setActiveId(jobs.items[0].id)
  }, [jobs.items, activeId])

  const persist = useMemo(
    () =>
      debounce((id: string, patch: Partial<RecruitingJob>) => {
        void jobs.update(id, patch)
      }, 450),
    [jobs],
  )

  const onField = useCallback(
    (patch: Partial<RecruitingJob>) => {
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
    const title = window.prompt('Titel der Stellenanzeige?', 'Senior Brand Strategist')
    if (!title?.trim()) return
    const created = await jobs.create({
      title: title.trim(),
      utm_campaign: slugify(`${slug}-${title}`),
      utm_source: 'brandos',
      utm_medium: 'recruiting',
    })
    setActiveId(created.id)
    show('Stelle angelegt', 'success')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <WaitlistBanner waitlist={waitlist} />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '260px 1fr',
          gap: 14,
          minHeight: 540,
        }}
      >
        {/* Sidebar */}
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
          <div
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}
          >
            <span
              className="font-mono"
              style={{
                fontSize: 9,
                letterSpacing: '0.14em',
                color: 'var(--text-tertiary)',
              }}
            >
              STELLEN ({jobs.items.length})
            </span>
            <button
              type="button"
              onClick={createNew}
              className="font-mono"
              style={{
                fontSize: 10,
                padding: '4px 9px',
                borderRadius: 7,
                border: '1px solid var(--accent-teal)',
                background: 'color-mix(in srgb, var(--accent-teal) 14%, transparent)',
                color: 'var(--accent-teal)',
                cursor: 'pointer',
              }}
            >
              + Neu
            </button>
          </div>

          {jobs.loading ? (
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Lädt…</div>
          ) : jobs.items.length === 0 ? (
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
              Noch keine Anzeigen.
              <br />
              <strong>+ Neu</strong> klicken.
            </div>
          ) : (
            jobs.items.map((j) => (
              <JobListItem
                key={j.id}
                job={j}
                active={j.id === activeId}
                onSelect={() => setActiveId(j.id)}
              />
            ))
          )}
        </aside>

        {/* Editor */}
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
            Stelle wählen oder neu anlegen.
          </div>
        ) : (
          <JobEditor
            key={active.id}
            job={active}
            brandSlug={slug}
            brandId={brandId ?? undefined}
            brandName={brand?.name}
            aiContext={aiContext}
            onField={onField}
            onRemove={() => {
              if (!window.confirm(`Stelle „${active.title || 'unbenannt'}" löschen?`)) return
              void jobs.remove(active.id)
              setActiveId(null)
            }}
          />
        )}
      </div>
    </div>
  )
}

// ============================================================
// WaitlistBanner
// ============================================================

function WaitlistBanner({
  waitlist,
}: {
  waitlist: ReturnType<typeof useCultureFitWaitlist>
}) {
  const total = waitlist.data?.total
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        alignItems: 'center',
        gap: 16,
        padding: '16px 20px',
        borderRadius: 14,
        background:
          'linear-gradient(135deg, color-mix(in srgb, var(--accent-teal) 18%, var(--glass-1)) 0%, color-mix(in srgb, var(--accent-blue) 8%, var(--glass-1)) 100%)',
        border: '1px solid color-mix(in srgb, var(--accent-teal) 40%, var(--glass-border-1))',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div>
        <div
          className="font-mono"
          style={{
            fontSize: 9,
            letterSpacing: '0.18em',
            color: 'var(--accent-teal)',
            fontWeight: 600,
          }}
        >
          ◉ CULTUREFIT · WARTELISTE LIVE
        </div>
        <div
          className="font-display"
          style={{
            marginTop: 6,
            fontSize: 28,
            fontWeight: 700,
            color: 'var(--text-primary)',
            letterSpacing: '-0.4px',
            lineHeight: 1.1,
          }}
        >
          {waitlist.loading && total == null
            ? '…'
            : total != null
              ? total.toLocaleString('de-DE')
              : '—'}{' '}
          <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--text-secondary)' }}>
            Bewerber
          </span>
        </div>
        <div
          className="font-mono"
          style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}
        >
          {waitlist.error
            ? 'Endpoint nicht erreichbar — culturefit.to/api/waitlist/stats'
            : waitlist.data?.fetched_at
              ? `Live · zuletzt synchronisiert ${new Date(waitlist.data.fetched_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`
              : 'Wird geladen…'}
        </div>
      </div>
      <button
        type="button"
        onClick={waitlist.reload}
        className="font-mono"
        style={{
          padding: '8px 12px',
          borderRadius: 9,
          border: '1px solid var(--glass-border-2)',
          background: 'var(--glass-2)',
          color: 'var(--text-secondary)',
          fontSize: 11,
          cursor: 'pointer',
        }}
      >
        ↻ Aktualisieren
      </button>
    </motion.div>
  )
}

// ============================================================
// JobListItem
// ============================================================

function JobListItem({
  job,
  active,
  onSelect,
}: {
  job: RecruitingJob
  active: boolean
  onSelect: () => void
}) {
  const status = STATUS_META[job.status]
  const format = FORMAT_META[job.format]
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        width: '100%',
        textAlign: 'left',
        padding: '9px 11px',
        borderRadius: 9,
        border: active
          ? '1px solid var(--accent-teal)'
          : '1px solid var(--glass-border-2)',
        background: active
          ? 'color-mix(in srgb, var(--accent-teal) 14%, var(--glass-2))'
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
          {job.title || '(Ohne Titel)'}
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
        style={{ marginTop: 4, fontSize: 10, color: format.accent }}
      >
        {format.label}
      </div>
    </button>
  )
}

// ============================================================
// JobEditor
// ============================================================

function JobEditor({
  job,
  brandSlug,
  brandId,
  brandName,
  aiContext,
  onField,
  onRemove,
}: {
  job: RecruitingJob
  brandSlug: string
  brandId?: string
  brandName?: string
  aiContext: ReturnType<typeof Object> // wird beim Build als Object inferred
  onField: (patch: Partial<RecruitingJob>) => void
  onRemove: () => void
}) {
  const format = FORMAT_META[job.format]
  const generatedLink = useMemo(() => buildUtmLink(job, brandSlug), [job, brandSlug])
  const { show } = useToast()

  // Lokale Draft-State um responsive Eingabe zu haben (debounced gespeichert via onField)
  const [draft, setDraft] = useState(job)
  useEffect(() => {
    setDraft(job)
  }, [job.id]) // beim Wechsel reset
  const updateDraft = (patch: Partial<RecruitingJob>) => {
    setDraft((d) => ({ ...d, ...patch }))
    onField(patch)
  }

  const copyLink = async () => {
    if (!generatedLink) {
      show('Kein Link verfügbar', 'info')
      return
    }
    try {
      await navigator.clipboard.writeText(generatedLink)
      show('Link kopiert', 'success')
    } catch {
      show('Kopieren fehlgeschlagen', 'info')
    }
  }

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
      {/* Header */}
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
            value={draft.title}
            onChange={(e) => updateDraft({ title: e.target.value })}
            placeholder="Titel der Stelle …"
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
            {format.hint}
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

      {/* Format + Status Pills */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <PillGroup label="FORMAT">
          {(Object.keys(FORMAT_META) as RecruitingJobFormat[]).map((f) => {
            const m = FORMAT_META[f]
            const on = draft.format === f
            return (
              <Pill
                key={f}
                label={m.label}
                accent={m.accent}
                on={on}
                onClick={() => updateDraft({ format: f })}
              />
            )
          })}
        </PillGroup>
        <PillGroup label="STATUS">
          {(Object.keys(STATUS_META) as RecruitingJobStatus[]).map((s) => {
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

      {/* AI-fähige Felder */}
      <AiField
        label="BESCHREIBUNG"
        value={draft.description}
        onChange={(v) => updateDraft({ description: v })}
        placeholder="Worum geht es bei der Stelle?"
        rows={4}
        aiField="description"
        job={draft}
        brandId={brandId}
        brandName={brandName}
        aiContext={aiContext}
      />
      <AiField
        label="ANFORDERUNGEN"
        value={draft.requirements}
        onChange={(v) => updateDraft({ requirements: v })}
        placeholder={'• Erfahrung mit …\n• Kompetent in …'}
        rows={5}
        aiField="requirements"
        job={draft}
        brandId={brandId}
        brandName={brandName}
        aiContext={aiContext}
      />
      <AiField
        label="BENEFITS"
        value={draft.benefits}
        onChange={(v) => updateDraft({ benefits: v })}
        placeholder={'• …\n• …'}
        rows={5}
        aiField="benefits"
        job={draft}
        brandId={brandId}
        brandName={brandName}
        aiContext={aiContext}
      />

      {/* UTM-Block */}
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
          TRACKING & LINK
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <Field label="utm_source" value={draft.utm_source} onChange={(v) => updateDraft({ utm_source: v })} placeholder="brandos" />
          <Field label="utm_medium" value={draft.utm_medium} onChange={(v) => updateDraft({ utm_medium: v })} placeholder="recruiting" />
          <Field label="utm_campaign" value={draft.utm_campaign} onChange={(v) => updateDraft({ utm_campaign: v })} placeholder="brand-2026" />
        </div>

        {draft.format === 'culturefit' ? (
          <div
            style={{
              padding: 12,
              borderRadius: 10,
              background: 'color-mix(in srgb, var(--accent-teal) 8%, var(--bg-deep))',
              border: '1px solid color-mix(in srgb, var(--accent-teal) 35%, transparent)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div className="font-mono" style={{ fontSize: 9, color: 'var(--accent-teal)', letterSpacing: '0.12em' }}>
              CULTUREFIT-LINK
            </div>
            <code
              style={{
                fontSize: 11,
                color: 'var(--text-primary)',
                background: 'var(--glass-1)',
                padding: '8px 10px',
                borderRadius: 7,
                wordBreak: 'break-all',
                fontFamily: 'ui-monospace, monospace',
              }}
            >
              {generatedLink}
            </code>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                onClick={copyLink}
                className="font-mono"
                style={{
                  fontSize: 10,
                  padding: '6px 10px',
                  borderRadius: 7,
                  border: '1px solid var(--accent-teal)',
                  background: 'color-mix(in srgb, var(--accent-teal) 16%, transparent)',
                  color: 'var(--accent-teal)',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                ⎘ Link kopieren
              </button>
              <a
                href={generatedLink}
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
        ) : (
          <Field
            label="Externer Link (Post / Job-Posting)"
            value={draft.external_url}
            onChange={(v) => updateDraft({ external_url: v })}
            placeholder="https://linkedin.com/jobs/…"
          />
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Field
            label="Views"
            type="number"
            value={String(draft.views_count || 0)}
            onChange={(v) => updateDraft({ views_count: parseInt(v || '0', 10) || 0 })}
          />
          <Field
            label="Bewerbungen"
            type="number"
            value={String(draft.applications_count || 0)}
            onChange={(v) => updateDraft({ applications_count: parseInt(v || '0', 10) || 0 })}
          />
        </div>
      </div>
    </section>
  )
}

// ============================================================
// AI-Field
// ============================================================

function AiField({
  label,
  value,
  onChange,
  placeholder,
  rows,
  aiField,
  job,
  brandId,
  brandName,
  aiContext,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  rows: number
  aiField: RecruitingField
  job: RecruitingJob
  brandId?: string
  brandName?: string
  aiContext: unknown
}) {
  const [variants, setVariants] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { show } = useToast()

  const requestVariants = async () => {
    if (loading) return
    setLoading(true)
    setError(null)
    setVariants([])
    const platform: MarketingPlatform =
      job.format === 'culturefit'
        ? 'culturefit'
        : job.format === 'linkedin_ad'
          ? 'linkedin_ad'
          : job.format === 'linkedin_organic'
            ? 'linkedin_organic'
            : 'other'
    const res = await generateMarketingText({
      kind: 'recruiting',
      field: aiField,
      brand_id: brandId,
      brand_name: brandName,
      platform,
      title: job.title,
      current_value: value,
      context: aiContext as never,
    })
    setLoading(false)
    if (res.error) {
      setError(res.error)
      show(`KI-Fehler: ${res.error}`, 'info')
      return
    }
    setVariants(res.variants ?? [])
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
        }}
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
      {error ? (
        <div style={{ fontSize: 10, color: 'var(--accent-coral)' }}>{error}</div>
      ) : null}
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
                style={{ fontSize: 8, color: 'var(--accent-blue)', letterSpacing: '0.1em', marginBottom: 4 }}
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

// ============================================================
// Helpers
// ============================================================

function PillGroup({ label, children }: { label: string; children: React.ReactNode }) {
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
