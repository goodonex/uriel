import { motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAllBrandsDiscoveryFeed, type AllBrandsFeedRow } from '../hooks/useDiscoveryFeed'
import { useBrandHudSnapshots } from '../hooks/useBrandHudSnapshots'
import { useBrands } from '../hooks/useBrands'
import { useUniverseNodeHover } from '../lib/universeNodeHover'
import type { Brand, DiscoveryFeedItem } from '../types/db'

const HUD_SLUGS = [
  'herrmann',
  'wertavio',
  'culturefit',
  'eversmell',
  'homeflower',
] as const

type HudSlug = (typeof HUD_SLUGS)[number]

const BRAND_CARD_LAYOUT: Record<
  HudSlug,
  { top?: number; bottom?: number; left?: number; right?: number }
> = {
  herrmann: { top: 80, right: 32 },
  wertavio: { top: 220, right: 32 },
  culturefit: { bottom: 180, right: 32 },
  eversmell: { bottom: 180, left: 32 },
  homeflower: { top: 220, left: 32 },
}

const CATEGORY_LABEL: Record<DiscoveryFeedItem['category'], string> = {
  competitor: 'Wettbewerb',
  format: 'Format',
  trend: 'Trend',
  icp_search: 'Suchintent',
}

const PRIORITY_LABELS = [
  '30 LinkedIn Anfragen',
  '3 Cold Calls — Herrmann & Co.',
  'Discovery Feed checken',
] as const

function localDateKey(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatGermanLongDate(): string {
  return new Intl.DateTimeFormat('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date())
}

function formatTimeAgoDe(iso: string): string {
  try {
    const t = new Date(iso).getTime()
    const diff = Date.now() - t
    const s = Math.floor(diff / 1000)
    if (s < 60) return 'gerade eben'
    const m = Math.floor(s / 60)
    if (m < 60) return `vor ${m} Min.`
    const h = Math.floor(m / 60)
    if (h < 24) return `vor ${h} Std.`
    const d = Math.floor(h / 24)
    return `vor ${d} Tag${d === 1 ? '' : 'en'}`
  } catch {
    return ''
  }
}

function MorningBrief() {
  const [done, setDone] = useState<boolean[]>(() => {
    try {
      const raw = localStorage.getItem(`daily_todos_${localDateKey()}`)
      if (raw) {
        const p = JSON.parse(raw) as unknown
        if (Array.isArray(p) && p.length === 3)
          return p.map((x) => Boolean(x)) as boolean[]
      }
    } catch {
      /* ignore */
    }
    return [false, false, false]
  })

  const persist = useCallback((next: boolean[]) => {
    const key = `daily_todos_${localDateKey()}`
    localStorage.setItem(key, JSON.stringify(next))
    setDone(next)
  }, [])

  useEffect(() => {
    const onDay = () => {
      try {
        const raw = localStorage.getItem(`daily_todos_${localDateKey()}`)
        if (raw) {
          const p = JSON.parse(raw) as unknown
          if (Array.isArray(p) && p.length === 3)
            setDone(p.map((x) => Boolean(x)) as boolean[])
          return
        }
      } catch {
        /* ignore */
      }
      setDone([false, false, false])
    }
    const id = window.setInterval(onDay, 60_000)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div
      style={{
        position: 'absolute',
        top: 80,
        left: 32,
        pointerEvents: 'auto',
        zIndex: 2,
      }}
    >
      <div
        className="font-display"
        style={{
          fontSize: 28,
          fontWeight: 600,
          color: '#fff',
          textShadow: '0 0 40px rgba(255,255,255,0.15)',
          lineHeight: 1.15,
        }}
      >
        Guten Morgen, Kevin.
      </div>
      <div
        className="font-body mt-2"
        style={{
          fontSize: 13,
          color: 'rgba(255,255,255,0.4)',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}
      >
        {formatGermanLongDate()}
      </div>
      <ul
        className="mt-5 list-none space-y-3 p-0"
        style={{ marginBottom: 0, minHeight: 110 }}
      >
        {PRIORITY_LABELS.map((label, i) => {
          const isDone = done[i] ?? false
          return (
            <li
              key={label}
              className="font-body flex items-center gap-3"
              style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)' }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  flexShrink: 0,
                  background: isDone ? 'var(--accent-teal)' : 'rgba(255,255,255,0.3)',
                }}
              />
              <span
                style={{
                  flex: 1,
                  textDecoration: isDone ? 'line-through' : 'none',
                  opacity: isDone ? 0.4 : 1,
                }}
              >
                {label}
              </span>
              <button
                type="button"
                aria-pressed={isDone}
                onClick={() => {
                  const next = [...done]
                  next[i] = !next[i]
                  persist(next)
                }}
                className="font-mono rounded-full"
                style={{
                  width: 36,
                  height: 22,
                  border: '1px solid rgba(255,255,255,0.15)',
                  background: isDone ? 'rgba(45,212,191,0.2)' : 'rgba(255,255,255,0.06)',
                  cursor: 'pointer',
                  fontSize: 10,
                  color: 'rgba(255,255,255,0.6)',
                }}
              >
                {isDone ? '✓' : ''}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** Ungefähre Slot-Positionen unter den 3D-Nodes (HTML-Overlay, nicht pixelgenau). */
const UNIVERSE_LABEL_SLOTS: { left: string; top: string }[] = [
  { left: '13%', top: '46%' },
  { left: '27%', top: '58%' },
  { left: '50%', top: '40%' },
  { left: '73%', top: '56%' },
  { left: '87%', top: '46%' },
]

function UniverseNodeLabels({ brands }: { brands: Brand[] }) {
  const hoveredSlug = useUniverseNodeHover((s) => s.hoveredBrandSlug)
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 2,
        pointerEvents: 'none',
      }}
    >
      {UNIVERSE_LABEL_SLOTS.map((slot, i) => {
        const b = brands[i]
        if (!b) return null
        const hi = hoveredSlug === b.slug
        return (
          <div
            key={b.id}
            className="font-body"
            style={{
              position: 'absolute',
              left: slot.left,
              top: slot.top,
              transform: 'translateX(-50%)',
              fontSize: 11,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.4)',
              opacity: hi ? 1 : 0.4,
              transition: 'opacity 0.22s ease',
              whiteSpace: 'nowrap',
              textAlign: 'center',
              maxWidth: '42vw',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              textShadow: '0 1px 14px rgba(0,0,0,0.55)',
            }}
          >
            {b.name}
          </div>
        )
      })}
    </div>
  )
}

function BrandHudCard({
  slug,
  name,
  color,
  counts,
  position,
}: {
  slug: HudSlug
  name: string
  color: string | null | undefined
  counts: { pipeline: number | null; content: number | null; projects: number | null }
  position: (typeof BRAND_CARD_LAYOUT)[HudSlug]
}) {
  const navigate = useNavigate()
  const hudEnter = useUniverseNodeHover((s) => s.hudEnter)
  const hudLeave = useUniverseNodeHover((s) => s.hudLeave)
  const hoveredSlug = useUniverseNodeHover((s) => s.hoveredBrandSlug)
  const [hover, setHover] = useState(false)
  const dotColor = color && color.trim() ? color : 'var(--accent-teal)'
  const visible = hoveredSlug === slug

  const fmt = (n: number | null) => (n === null ? '—' : String(n))

  return (
    <button
      type="button"
      onClick={() => navigate(`/brand/${slug}/dashboard`)}
      onMouseEnter={() => {
        setHover(true)
        hudEnter(slug)
      }}
      onMouseLeave={() => {
        setHover(false)
        hudLeave()
      }}
      className="text-left font-body"
      style={{
        position: 'absolute',
        zIndex: 2,
        pointerEvents: visible ? 'auto' : 'none',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.28s ease, transform 0.28s ease',
        transform: visible ? 'translateY(0)' : 'translateY(6px)',
        ...position,
        width: 220,
        padding: '16px 20px',
        borderRadius: 16,
        background: 'rgba(255,255,255,0.04)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: `1px solid ${hover ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)'}`,
        boxShadow: hover ? '0 0 24px rgba(255,255,255,0.06)' : 'none',
        cursor: visible ? 'pointer' : 'default',
      }}
    >
      <div className="mb-3 flex items-center gap-2">
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: dotColor,
            flexShrink: 0,
          }}
        />
        <span
          className="font-display"
          style={{
            fontSize: 13,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.92)',
          }}
        >
          {name}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {(
          [
            ['Pipeline', counts.pipeline],
            ['Content', counts.content],
            ['Projekte', counts.projects],
          ] as const
        ).map(([label, val]) => (
          <div key={label}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{label}</div>
            <div className="font-display" style={{ fontSize: 20, color: '#fff', marginTop: 2 }}>
              {fmt(val)}
            </div>
          </div>
        ))}
      </div>
    </button>
  )
}

function DiscoveryTicker({ rows }: { rows: AllBrandsFeedRow[] }) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 2,
        pointerEvents: 'none',
        width: '100%',
        maxWidth: 600,
        padding: '0 16px',
      }}
    >
      <div
        style={{
          padding: '12px 20px',
          borderRadius: 12,
          background: 'rgba(255,255,255,0.04)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div
          className="font-body mb-2"
          style={{
            fontSize: 10,
            color: 'rgba(255,255,255,0.3)',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
          }}
        >
          Neueste Signale
        </div>
        {rows.length === 0 ? (
          <div
            className="font-body text-center"
            style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', padding: '8px 0' }}
          >
            Noch keine Signale — starte Discovery
          </div>
        ) : (
          <ul className="list-none space-y-2 p-0" style={{ margin: 0 }}>
            {rows.map((row) => {
              const badgeBg =
                row.brand_color && row.brand_color.trim()
                  ? row.brand_color
                  : 'rgba(255,255,255,0.15)'
              return (
                <li
                  key={row.id}
                  className="font-body flex items-center gap-2"
                  style={{ fontSize: 12 }}
                >
                  <span
                    className="font-mono shrink-0"
                    style={{
                      fontSize: 9,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      padding: '2px 8px',
                      borderRadius: 999,
                      background: badgeBg,
                      color: 'rgba(0,0,0,0.75)',
                      maxWidth: 100,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {row.brand_name}
                  </span>
                  <span
                    className="min-w-0 flex-1 truncate"
                    style={{ color: '#fff', fontSize: 12 }}
                  >
                    {row.title}
                  </span>
                  <span className="hidden shrink-0 sm:inline" style={{ opacity: 0.4 }}>
                    {CATEGORY_LABEL[row.category as DiscoveryFeedItem['category']]}
                  </span>
                  <span className="shrink-0" style={{ opacity: 0.4, fontSize: 11 }}>
                    {formatTimeAgoDe(row.recorded_at)}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

export function NodeGraphPage() {
  const { brands } = useBrands()

  const slugToId = useMemo(() => {
    const o: Record<string, string | undefined> = {}
    for (const s of HUD_SLUGS) {
      o[s] = brands.find((b) => b.slug === s)?.id
    }
    return o
  }, [brands])

  const hudCounts = useBrandHudSnapshots(slugToId)
  const { items: feedRows } = useAllBrandsDiscoveryFeed()

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '100vh',
        pointerEvents: 'none',
        background: 'transparent',
        overflow: 'hidden',
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        style={{
          position: 'absolute',
          top: 24,
          left: 32,
          right: 32,
          pointerEvents: 'auto',
          zIndex: 3,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Link
          to="/"
          className="font-display"
          style={{
            fontSize: 17,
            fontWeight: 600,
            letterSpacing: '-0.3px',
            color: 'var(--text-primary)',
          }}
        >
          Brand OS
        </Link>
        <span
          className="font-mono"
          style={{
            fontSize: 10,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--text-tertiary)',
          }}
        >
          Universe
        </span>
      </motion.div>

      <MorningBrief />

      <UniverseNodeLabels brands={brands} />

      {HUD_SLUGS.map((slug) => {
        const b = brands.find((br) => br.slug === slug)
        const counts = hudCounts[slug] ?? {
          pipeline: null,
          content: null,
          projects: null,
        }
        return (
          <BrandHudCard
            key={slug}
            slug={slug}
            name={b?.name ?? slug}
            color={b?.color}
            counts={counts}
            position={BRAND_CARD_LAYOUT[slug]}
          />
        )
      })}

      <DiscoveryTicker rows={feedRows} />

      <div
        className="pointer-events-none font-mono"
        style={{
          position: 'absolute',
          bottom: 96,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1,
          fontSize: 10,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--text-tertiary)',
          textAlign: 'center',
          maxWidth: 360,
        }}
      >
        Klicke einen Node um in die Brand zu fliegen
      </div>
    </div>
  )
}
