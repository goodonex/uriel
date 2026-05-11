import { motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useDebouncedCallback } from '../../hooks/useDebouncedCallback'
import type { Asset, AssetType, SocialPlatform } from '../../types/db'

interface AssetsSectionProps {
  items: Asset[]
  loading: boolean
  error: string | null
  onCreate: () => Asset
  onUpdate: (id: string, patch: Partial<Omit<Asset, 'id' | 'brand_id'>>) => void
  onRemove: (id: string) => void
}

const GLASS_CARD = {
  background: 'rgba(255,255,255,0.04)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)' as const,
  border: '1px solid rgba(255,255,255,0.08)',
}

const SOCIAL_PLATFORM_META: Record<
  SocialPlatform,
  { label: string; short: string }
> = {
  linkedin: { label: 'LinkedIn', short: 'in' },
  instagram: { label: 'Instagram', short: 'IG' },
  facebook: { label: 'Facebook', short: 'f' },
  tiktok: { label: 'TikTok', short: 'TT' },
  youtube: { label: 'YouTube', short: 'YT' },
  twitter: { label: 'X (Twitter)', short: '𝕏' },
}

const SOCIAL_PLATFORMS: SocialPlatform[] = [
  'linkedin',
  'instagram',
  'facebook',
  'tiktok',
  'youtube',
  'twitter',
]

function assetToSelectValue(asset: Asset): string {
  if (asset.type === 'social' && asset.social_platform) {
    return `social:${asset.social_platform}`
  }
  return asset.type
}

function parseTypeSelect(
  raw: string,
): Pick<Asset, 'type' | 'social_platform'> | { type: AssetType } {
  if (raw.startsWith('social:')) {
    const p = raw.slice(7) as SocialPlatform
    return { type: 'social', social_platform: p }
  }
  return { type: raw as AssetType, social_platform: null }
}

function normalizeUrl(url: string): string {
  const t = url.trim()
  if (!t) return ''
  return /^https?:\/\//i.test(t) ? t : `https://${t}`
}

function formatGermanDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('de-DE', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return '—'
  }
}

function scoreColor(score: number): string {
  if (score < 50) return '#ef4444'
  if (score < 90) return '#f97316'
  return '#22c55e'
}

type UptimeState =
  | { phase: 'loading' }
  | { phase: 'ok' }
  | { phase: 'bad' }

function useUptimeCheck(url: string | undefined) {
  const [state, setState] = useState<UptimeState>({ phase: 'loading' })

  useEffect(() => {
    if (!url?.trim()) {
      setState({ phase: 'bad' })
      return
    }
    const target = normalizeUrl(url)
    let cancelled = false
    setState({ phase: 'loading' })

    const ctrl = new AbortController()
    const t = window.setTimeout(() => ctrl.abort(), 5000)

    void fetch(target, { method: 'HEAD', mode: 'cors', signal: ctrl.signal })
      .then((res) => {
        if (cancelled) return
        if (res.ok && res.status < 400) setState({ phase: 'ok' })
        else setState({ phase: 'bad' })
      })
      .catch(() => {
        if (!cancelled) setState({ phase: 'bad' })
      })
      .finally(() => window.clearTimeout(t))

    return () => {
      cancelled = true
      ctrl.abort()
    }
  }, [url])

  return state
}

interface PageSpeedMetrics {
  score: number
  fcp: string | null
  lcp: string | null
  cls: string | null
}

function parsePageSpeedJson(data: unknown): PageSpeedMetrics | null {
  try {
    const root = data as {
      lighthouseResult?: {
        categories?: { performance?: { score?: number | null } }
        audits?: Record<
          string,
          { numericValue?: number; displayValue?: string }
        >
      }
    }
    const lh = root.lighthouseResult
    if (!lh?.categories?.performance) return null
    const rawScore = lh.categories.performance.score
    const score =
      rawScore == null ? 0 : Math.round(Math.min(1, Math.max(0, rawScore)) * 100)
    const audits = lh.audits ?? {}
    const fcp = audits['first-contentful-paint']?.displayValue ?? null
    const lcp = audits['largest-contentful-paint']?.displayValue ?? null
    const clsAudit = audits['cumulative-layout-shift']
    const cls =
      clsAudit?.displayValue ??
      (clsAudit?.numericValue != null ? String(clsAudit.numericValue) : null)
    return { score, fcp, lcp, cls }
  } catch {
    return null
  }
}

function PageSpeedRing({
  score,
  color,
  size,
  stroke,
}: {
  score: number
  color: string
  size: number
  stroke: number
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const p = (score / 100) * c
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={`${p} ${c}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dasharray 0.4s ease' }}
      />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        className="font-display"
        fill="#fff"
        fontSize={size * 0.22}
        fontWeight={600}
      >
        {score}
      </text>
    </svg>
  )
}

function WebsitePerformanceSidebar({
  asset,
  onUpdate,
  onEditRequested,
}: {
  asset: Asset
  onUpdate: (id: string, patch: Partial<Omit<Asset, 'id' | 'brand_id'>>) => void
  onEditRequested: () => void
}) {
  const apiKey = import.meta.env.VITE_GOOGLE_PAGESPEED_KEY as string | undefined
  const uptime = useUptimeCheck(asset.url)
  const [psLoading, setPsLoading] = useState(false)
  const [psError, setPsError] = useState<string | null>(null)
  const [psMetrics, setPsMetrics] = useState<PageSpeedMetrics | null>(null)

  const runPageSpeed = useCallback(async () => {
    if (!apiKey?.trim() || !asset.url.trim()) return
    setPsLoading(true)
    setPsError(null)
    try {
      const u = encodeURIComponent(normalizeUrl(asset.url))
      const res = await fetch(
        `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${u}&strategy=mobile&key=${encodeURIComponent(apiKey.trim())}`,
      )
      const json = await res.json()
      if (!res.ok) {
        setPsError((json as { error?: { message?: string } })?.error?.message ?? 'API-Fehler')
        setPsMetrics(null)
        return
      }
      const m = parsePageSpeedJson(json)
      setPsMetrics(m)
      if (!m) setPsError('Keine Messdaten')
    } catch (e) {
      setPsMetrics(null)
      setPsError(e instanceof Error ? e.message : 'Unbekannter Fehler')
    } finally {
      setPsLoading(false)
    }
  }, [apiKey, asset.url])

  useEffect(() => {
    if (apiKey?.trim() && asset.url.trim()) void runPageSpeed()
  }, [apiKey, asset.url, runPageSpeed])

  const debouncedNotes = useDebouncedCallback((v: string) =>
    onUpdate(asset.id, { notes: v }),
  )

  const upDot = (() => {
    if (uptime.phase === 'loading')
      return { c: 'rgba(255,255,255,0.35)', t: 'Wird geprüft...' }
    if (uptime.phase === 'ok') return { c: '#22c55e', t: 'Online' }
    return { c: '#ef4444', t: 'Nicht erreichbar' }
  })()

  return (
    <div
      className="font-body flex min-h-0 flex-col gap-3 overflow-y-auto"
      style={{
        ...GLASS_CARD,
        borderRadius: 16,
        padding: '16px 20px',
      }}
    >
      <div>
        <div
          className="font-body mb-1"
          style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}
        >
          Uptime
        </div>
        <div className="flex items-center gap-2" style={{ fontSize: 13, color: '#fff' }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: upDot.c,
            }}
          />
          {upDot.t}
        </div>
      </div>

      <div>
        <div
          className="font-body mb-1"
          style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}
        >
          PageSpeed Score
        </div>
        {!apiKey?.trim() ? (
          <div
            style={{
              padding: 12,
              borderRadius: 12,
              border: '1px dashed rgba(255,255,255,0.12)',
              fontSize: 12,
              color: 'rgba(255,255,255,0.55)',
            }}
          >
            PageSpeed API Key fehlt —{' '}
            <a
              href="https://console.cloud.google.com/apis/library/pagespeedonline.googleapis.com"
              target="_blank"
              rel="noreferrer"
              className="underline"
              style={{ color: 'var(--text-accent)' }}
            >
              Google Cloud Console
            </a>
          </div>
        ) : psLoading && !psMetrics ? (
          <div style={{ fontSize: 12, opacity: 0.5 }}>Lade PageSpeed…</div>
        ) : psError && !psMetrics ? (
          <div style={{ fontSize: 12, color: 'var(--accent-coral)' }}>{psError}</div>
        ) : psMetrics ? (
          <div className="flex flex-col items-center gap-2">
            <PageSpeedRing
              score={psMetrics.score}
              color={scoreColor(psMetrics.score)}
              size={112}
              stroke={8}
            />
            <div
              className="grid w-full grid-cols-3 gap-1 text-center font-mono"
              style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)' }}
            >
              <div>
                <div>FCP</div>
                <div style={{ color: '#fff' }}>{psMetrics.fcp ?? '—'}</div>
              </div>
              <div>
                <div>LCP</div>
                <div style={{ color: '#fff' }}>{psMetrics.lcp ?? '—'}</div>
              </div>
              <div>
                <div>CLS</div>
                <div style={{ color: '#fff' }}>{psMetrics.cls ?? '—'}</div>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div>
        <div
          className="font-body mb-1"
          style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}
        >
          Asset
        </div>
        <a
          href={normalizeUrl(asset.url)}
          target="_blank"
          rel="noreferrer"
          className="block break-all"
          style={{ fontSize: 12, color: 'var(--accent-blue)' }}
        >
          {asset.url || '—'}
        </a>
        <div className="mt-1" style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
          Hinzugefügt: {formatGermanDateTime(asset.created_at)}
        </div>
        <textarea
          key={`notes-${asset.id}`}
          defaultValue={asset.notes}
          onChange={(e) => debouncedNotes(e.target.value)}
          placeholder="Notizen…"
          rows={3}
          className="mt-2 w-full resize-none rounded-lg font-body outline-none"
          style={{
            fontSize: 12,
            padding: '8px 10px',
            background: 'var(--glass-1)',
            border: '1px solid var(--glass-border-1)',
            color: 'var(--text-primary)',
          }}
        />
      </div>

      <div className="mt-auto flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          className="rounded-lg font-mono"
          style={{
            fontSize: 10,
            padding: '6px 10px',
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(255,255,255,0.06)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
          }}
          onClick={() => window.open(normalizeUrl(asset.url), '_blank', 'noopener,noreferrer')}
        >
          Im Browser öffnen
        </button>
        <button
          type="button"
          className="rounded-lg font-mono"
          style={{
            fontSize: 10,
            padding: '6px 10px',
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(255,255,255,0.06)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
          }}
          onClick={() => void runPageSpeed()}
        >
          PageSpeed neu laden
        </button>
        <button
          type="button"
          className="rounded-lg font-mono"
          style={{
            fontSize: 10,
            padding: '6px 10px',
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(255,255,255,0.06)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
          }}
          onClick={onEditRequested}
        >
          Asset bearbeiten
        </button>
      </div>
    </div>
  )
}

function SocialAssetVisual({ asset }: { asset: Asset }) {
  const platform: SocialPlatform = asset.social_platform ?? 'linkedin'
  const meta = SOCIAL_PLATFORM_META[platform]

  return (
    <div
      className="font-body flex flex-col gap-4"
      style={{
        ...GLASS_CARD,
        borderRadius: 16,
        padding: '20px 24px',
        minHeight: 200,
      }}
    >
      <div className="flex items-start gap-3">
        <span
          className="font-display flex h-12 w-12 items-center justify-center rounded-xl"
          style={{
            background: 'rgba(255,255,255,0.06)',
            fontSize: 20,
            color: '#fff',
          }}
        >
          {meta.short}
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-display" style={{ fontSize: 20, color: '#fff' }}>
            {meta.label}
          </div>
          <div className="mt-1 truncate" style={{ fontSize: 13, opacity: 0.6 }}>
            {asset.url.trim() || 'Keine URL'}
          </div>
        </div>
      </div>
      <button
        type="button"
        className="font-mono w-max rounded-lg"
        style={{
          fontSize: 11,
          padding: '8px 14px',
          border: '1px solid rgba(255,255,255,0.15)',
          background: 'rgba(255,255,255,0.06)',
          color: '#fff',
          cursor: 'pointer',
        }}
        onClick={() => {
          if (asset.url.trim()) window.open(normalizeUrl(asset.url), '_blank', 'noopener,noreferrer')
        }}
      >
        Profil öffnen
      </button>
      <div className="grid grid-cols-3 gap-2">
        {(['Follower', 'Posts', 'Engagement'] as const).map((label) => (
          <div
            key={label}
            style={{
              padding: '10px 8px',
              borderRadius: 12,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{label}</div>
            <div className="font-display mt-1" style={{ fontSize: 16, color: '#fff' }}>
              —
            </div>
          </div>
        ))}
      </div>
      <div className="font-body text-center" style={{ fontSize: 10, opacity: 0.3 }}>
        Live-Daten folgen in Phase 2
      </div>
    </div>
  )
}

export function AssetsSection({
  items,
  loading,
  error,
  onCreate,
  onUpdate,
  onRemove,
}: AssetsSectionProps) {
  if (loading) return <SkeletonGrid />
  if (error) {
    return (
      <div
        className="font-mono"
        style={{ fontSize: 12, color: 'var(--accent-coral)' }}
      >
        Assets konnten nicht geladen werden: {error}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((asset, idx) => (
        <AssetCard
          key={asset.id}
          asset={asset}
          index={idx}
          onUpdate={onUpdate}
          onRemove={onRemove}
        />
      ))}
      <motion.button
        type="button"
        onClick={() => onCreate()}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          delay: items.length * 0.05,
          duration: 0.4,
          ease: [0.16, 1, 0.3, 1],
        }}
        whileHover={{ y: -1 }}
        className="flex min-h-[200px] items-center justify-center text-left transition-colors"
        style={{
          padding: 16,
          borderRadius: 12,
          background: 'var(--glass-1)',
          border: '1px dashed var(--glass-border-2)',
          color: 'var(--text-tertiary)',
        }}
      >
        <span
          className="font-mono"
          style={{
            fontSize: 11,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          + Neues Asset
        </span>
      </motion.button>
    </div>
  )
}

function AssetCard({
  asset,
  index,
  onUpdate,
  onRemove,
}: {
  asset: Asset
  index: number
  onUpdate: (id: string, patch: Partial<Omit<Asset, 'id' | 'brand_id'>>) => void
  onRemove: (id: string) => void
}) {
  const debouncedName = useDebouncedCallback((v: string) =>
    onUpdate(asset.id, { name: v }),
  )
  const debouncedUrl = useDebouncedCallback((v: string) =>
    onUpdate(asset.id, { url: v }),
  )

  const iframeSrc =
    asset.embed && asset.url.trim() && asset.type !== 'social'
      ? normalizeUrl(asset.url)
      : ''

  const isEmbedHero = Boolean(asset.embed && asset.url.trim() && asset.type !== 'social')
  const [editOpen, setEditOpen] = useState(false)

  const selectValue = useMemo(() => assetToSelectValue(asset), [asset])

  if (isEmbedHero) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          delay: index * 0.05,
          duration: 0.4,
          ease: [0.16, 1, 0.3, 1],
        }}
        className="col-span-1 flex flex-col text-left sm:col-span-2 lg:col-span-3"
        style={{
          padding: 16,
          borderRadius: 12,
          background: 'var(--glass-2)',
          border: '1px solid var(--glass-border-1)',
          backdropFilter: 'var(--blur-md)',
          WebkitBackdropFilter: 'var(--blur-md)',
          minHeight: 500,
        }}
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <input
            type="text"
            defaultValue={asset.name}
            key={`${asset.id}-name-h`}
            onChange={(e) => debouncedName(e.target.value)}
            placeholder="Name"
            className="min-w-[140px] flex-1 rounded-lg outline-none"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 15,
              fontWeight: 600,
              padding: '6px 8px',
              background: 'var(--glass-1)',
              border: '1px solid var(--glass-border-1)',
              color: 'var(--text-primary)',
            }}
          />
        </div>
        <div
          className="grid flex-1 gap-3"
          style={{ gridTemplateColumns: '3fr 2fr', minHeight: 460 }}
        >
          <div
            className="min-h-0 overflow-hidden rounded-lg"
            style={{
              border: '1px solid var(--glass-border-1)',
              minHeight: 440,
              background: 'var(--bg-base)',
            }}
          >
            <iframe
              title={asset.name}
              src={iframeSrc}
              className="h-full min-h-[440px] w-full border-0"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            />
          </div>
          <WebsitePerformanceSidebar
            asset={asset}
            onUpdate={onUpdate}
            onEditRequested={() => setEditOpen((o) => !o)}
          />
        </div>
        {editOpen ? (
          <div
            className="font-body mt-3 space-y-2 rounded-xl p-3"
            style={{ background: 'var(--glass-1)', border: '1px solid var(--glass-border-1)' }}
          >
            <div className="flex flex-wrap gap-2">
              <label className="font-mono text-[10px] text-[var(--text-tertiary)]">Typ</label>
              <select
                value={selectValue}
                onChange={(e) => {
                  const p = parseTypeSelect(e.target.value)
                  onUpdate(asset.id, p)
                }}
                className="rounded-lg outline-none"
                style={{
                  fontSize: 12,
                  padding: '4px 8px',
                  background: 'var(--glass-1)',
                  border: '1px solid var(--glass-border-2)',
                  color: 'var(--text-secondary)',
                }}
              >
                <option value="website">Website</option>
                <option value="document">Dokument</option>
                <option value="instagram">Instagram (Legacy)</option>
                <option value="linkedin">LinkedIn (Legacy)</option>
                <optgroup label="Social">
                  {SOCIAL_PLATFORMS.map((p) => (
                    <option key={p} value={`social:${p}`}>
                      {SOCIAL_PLATFORM_META[p].label}
                    </option>
                  ))}
                </optgroup>
              </select>
              <label className="ml-auto flex cursor-pointer items-center gap-1.5 font-mono text-[10px] text-[var(--text-tertiary)]">
                <input
                  type="checkbox"
                  checked={asset.embed}
                  onChange={(e) => onUpdate(asset.id, { embed: e.target.checked })}
                />
                Embed
              </label>
            </div>
            <input
              type="text"
              defaultValue={asset.url}
              key={`${asset.id}-url-h`}
              onChange={(e) => debouncedUrl(e.target.value)}
              placeholder="https://…"
              className="w-full rounded-lg outline-none"
              style={{
                fontSize: 12,
                padding: '8px 10px',
                background: 'var(--glass-1)',
                border: '1px solid var(--glass-border-1)',
                color: 'var(--text-primary)',
              }}
            />
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => {
            if (window.confirm(`Asset „${asset.name}“ löschen?`)) onRemove(asset.id)
          }}
          className="font-mono mt-3 self-start rounded-lg"
          style={{
            fontSize: 10,
            padding: '4px 10px',
            border: '1px solid var(--glass-border-2)',
            color: 'var(--accent-coral)',
            background: 'transparent',
          }}
        >
          Entfernen
        </button>
      </motion.div>
    )
  }

  if (asset.type === 'social') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          delay: index * 0.05,
          duration: 0.4,
          ease: [0.16, 1, 0.3, 1],
        }}
        className="flex flex-col text-left"
        style={{
          padding: 16,
          borderRadius: 12,
          background: 'var(--glass-2)',
          border: '1px solid var(--glass-border-1)',
          backdropFilter: 'var(--blur-md)',
          WebkitBackdropFilter: 'var(--blur-md)',
        }}
      >
        <input
          type="text"
          defaultValue={asset.name}
          key={`${asset.id}-name-s`}
          onChange={(e) => debouncedName(e.target.value)}
          placeholder="Name"
          className="mb-2 w-full rounded-lg outline-none"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 15,
            fontWeight: 600,
            padding: '6px 8px',
            background: 'var(--glass-1)',
            border: '1px solid var(--glass-border-1)',
            color: 'var(--text-primary)',
          }}
        />
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <label
            className="font-mono"
            style={{ fontSize: 10, color: 'var(--text-tertiary)' }}
          >
            Plattform
          </label>
          <select
            value={selectValue}
            onChange={(e) => {
              const p = parseTypeSelect(e.target.value)
              onUpdate(asset.id, p)
            }}
            className="rounded-lg outline-none"
            style={{
              fontSize: 12,
              padding: '4px 8px',
              background: 'var(--glass-1)',
              border: '1px solid var(--glass-border-2)',
              color: 'var(--text-secondary)',
            }}
          >
            {SOCIAL_PLATFORMS.map((p) => (
              <option key={p} value={`social:${p}`}>
                {SOCIAL_PLATFORM_META[p].label}
              </option>
            ))}
          </select>
        </div>
        <input
          type="text"
          defaultValue={asset.url}
          key={`${asset.id}-url-s`}
          onChange={(e) => debouncedUrl(e.target.value)}
          placeholder="Profil-URL"
          className="mb-3 w-full rounded-lg outline-none"
          style={{
            fontSize: 12,
            padding: '8px 10px',
            background: 'var(--glass-1)',
            border: '1px solid var(--glass-border-1)',
            color: 'var(--text-primary)',
          }}
        />
        <SocialAssetVisual asset={asset} />
        <button
          type="button"
          onClick={() => {
            if (window.confirm(`Asset „${asset.name}“ löschen?`)) onRemove(asset.id)
          }}
          className="font-mono mt-3 self-start rounded-lg"
          style={{
            fontSize: 10,
            padding: '4px 10px',
            border: '1px solid var(--glass-border-2)',
            color: 'var(--accent-coral)',
            background: 'transparent',
          }}
        >
          Entfernen
        </button>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: index * 0.05,
        duration: 0.4,
        ease: [0.16, 1, 0.3, 1],
      }}
      className="flex flex-col text-left"
      style={{
        padding: 16,
        borderRadius: 12,
        background: 'var(--glass-2)',
        border: '1px solid var(--glass-border-1)',
        backdropFilter: 'var(--blur-md)',
        WebkitBackdropFilter: 'var(--blur-md)',
      }}
    >
      <input
        type="text"
        defaultValue={asset.name}
        key={`${asset.id}-name`}
        onChange={(e) => debouncedName(e.target.value)}
        placeholder="Name"
        className="mb-2 w-full rounded-lg outline-none"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 15,
          fontWeight: 600,
          padding: '6px 8px',
          background: 'var(--glass-1)',
          border: '1px solid var(--glass-border-1)',
          color: 'var(--text-primary)',
        }}
      />
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <label
          className="font-mono"
          style={{ fontSize: 10, color: 'var(--text-tertiary)' }}
        >
          Typ
        </label>
        <select
          value={selectValue}
          onChange={(e) => {
            const p = parseTypeSelect(e.target.value)
            onUpdate(asset.id, p)
          }}
          className="rounded-lg outline-none"
          style={{
            fontSize: 12,
            padding: '4px 8px',
            background: 'var(--glass-1)',
            border: '1px solid var(--glass-border-2)',
            color: 'var(--text-secondary)',
          }}
        >
          <option value="website">Website</option>
          <option value="document">Dokument</option>
          <option value="instagram">Instagram (Legacy)</option>
          <option value="linkedin">LinkedIn (Legacy)</option>
          <optgroup label="Social">
            {SOCIAL_PLATFORMS.map((p) => (
              <option key={p} value={`social:${p}`}>
                {SOCIAL_PLATFORM_META[p].label}
              </option>
            ))}
          </optgroup>
        </select>
        <label
          className="ml-auto flex cursor-pointer items-center gap-1.5 font-mono"
          style={{ fontSize: 10, color: 'var(--text-tertiary)' }}
        >
          <input
            type="checkbox"
            checked={asset.embed}
            onChange={(e) => onUpdate(asset.id, { embed: e.target.checked })}
          />
          Embed
        </label>
      </div>
      <input
        type="text"
        defaultValue={asset.url}
        key={`${asset.id}-url`}
        onChange={(e) => debouncedUrl(e.target.value)}
        placeholder="https://…"
        className="mb-2 w-full rounded-lg outline-none"
        style={{
          fontSize: 12,
          padding: '8px 10px',
          background: 'var(--glass-1)',
          border: '1px solid var(--glass-border-1)',
          color: 'var(--text-primary)',
        }}
      />
      {iframeSrc ? (
        <div
          className="mt-1 overflow-hidden rounded-lg"
          style={{
            border: '1px solid var(--glass-border-1)',
            height: 160,
            background: 'var(--bg-base)',
          }}
        >
          <iframe
            title={asset.name}
            src={iframeSrc}
            className="h-full w-full border-0"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          />
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => {
          if (window.confirm(`Asset „${asset.name}“ löschen?`)) onRemove(asset.id)
        }}
        className="font-mono mt-3 self-start rounded-lg"
        style={{
          fontSize: 10,
          padding: '4px 10px',
          border: '1px solid var(--glass-border-2)',
          color: 'var(--accent-coral)',
          background: 'transparent',
        }}
      >
        Entfernen
      </button>
    </motion.div>
  )
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1].map((i) => (
        <div
          key={i}
          className="animate-pulse"
          style={{
            minHeight: 200,
            borderRadius: 12,
            background: 'var(--glass-1)',
            border: '1px solid var(--glass-border-1)',
          }}
        />
      ))}
    </div>
  )
}
