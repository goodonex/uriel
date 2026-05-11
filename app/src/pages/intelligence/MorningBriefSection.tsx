import { motion } from 'framer-motion'
import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { computeBuildingHealth } from '../../lib/brandHealthScore'
import { useAssets } from '../../hooks/useAssets'
import { useBrands } from '../../hooks/useBrands'
import { useBusinessModel } from '../../hooks/useBusinessModel'
import { useContacts } from '../../hooks/useContacts'
import { useContentPieces } from '../../hooks/useContentPieces'
import { useDiscoveryFeed } from '../../hooks/useDiscoveryFeed'
import { useICPs } from '../../hooks/useICPs'
import { usePositioning } from '../../hooks/usePositioning'
import { useWordBank } from '../../hooks/useWordBank'
import type { PipelineStage } from '../../types/db'

const STAGE_LABEL: Record<PipelineStage, string> = {
  first_contact: 'Erstkontakt',
  conversation: 'Gespräch',
  proposal: 'Angebot',
  deal: 'Deal',
  paused: 'Pause',
}

function endOfToday(): Date {
  const d = new Date()
  d.setHours(23, 59, 59, 999)
  return d
}

function startOfWeekMonday(): Date {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? 6 : day - 1
  const mon = new Date(now)
  mon.setDate(now.getDate() - diff)
  mon.setHours(0, 0, 0, 0)
  return mon
}

export function MorningBriefSection({ slug }: { slug: string }) {
  const navigate = useNavigate()
  const { brands } = useBrands()
  const brandName = brands.find((b) => b.slug === slug)?.name ?? slug

  const contacts = useContacts(slug)
  const pieces = useContentPieces(slug)
  const feed = useDiscoveryFeed(slug)
  const positioning = usePositioning(slug)
  const icps = useICPs(slug)
  const wordBank = useWordBank(slug)
  const businessModel = useBusinessModel(slug)
  const assets = useAssets(slug)

  const [generatedAt, setGeneratedAt] = useState(() => new Date())

  const refresh = useCallback(() => {
    setGeneratedAt(new Date())
    void contacts.reload()
    void pieces.reload()
    void feed.reload()
  }, [contacts, pieces, feed])

  const health = useMemo(
    () =>
      computeBuildingHealth({
        positioning: positioning.item,
        icps: icps.items,
        wordBank: wordBank.items,
        businessModel: businessModel.item,
        assets: assets.items,
      }),
    [
      positioning.item,
      icps.items,
      wordBank.items,
      businessModel.item,
      assets.items,
    ],
  )

  const followUpsToday = useMemo(() => {
    const end = endOfToday()
    return contacts.items
      .filter((c) => c.next_follow_up_at && new Date(c.next_follow_up_at) <= end)
      .sort((a, b) =>
        String(a.next_follow_up_at).localeCompare(String(b.next_follow_up_at)),
      )
      .slice(0, 5)
  }, [contacts.items])

  const daysSincePublish = useMemo(() => {
    const published = pieces.items
      .filter((p) => p.published_at && String(p.published_at).trim())
      .map((p) => new Date(p.published_at as string).getTime())
    if (!published.length) return null
    const latest = Math.max(...published)
    return Math.floor((Date.now() - latest) / 86400000)
  }, [pieces.items])

  const discoveryWeekCount = useMemo(() => {
    const since = Date.now() - 7 * 86400000
    return feed.items.filter(
      (i) => !i.archived_at && new Date(i.recorded_at).getTime() >= since,
    ).length
  }, [feed.items])

  const weekStart = useMemo(() => startOfWeekMonday().getTime(), [])

  const pipelineMovesThisWeek = useMemo(() => {
    return contacts.items.filter(
      (c) => c.updated_at && new Date(c.updated_at).getTime() >= weekStart,
    ).length
  }, [contacts.items, weekStart])

  const lastPipelineActivity = useMemo(() => {
    if (!contacts.items.length) return null
    return Math.max(...contacts.items.map((c) => new Date(c.updated_at).getTime()))
  }, [contacts.items])

  const daysSincePipeline = lastPipelineActivity
    ? (Date.now() - lastPipelineActivity) / 86400000
    : null

  const openPipelineCount = useMemo(
    () => contacts.items.filter((c) => c.pipeline_stage !== 'paused').length,
    [contacts.items],
  )

  const recommendations = useMemo(() => {
    const base = `/brand/${slug}`
    const out: { text: string; onClick: () => void }[] = []
    if (health.percent < 50) {
      out.push({
        text: 'Building vervollständigen',
        onClick: () => navigate(`${base}/building`),
      })
    }
    if (daysSincePublish !== null && daysSincePublish > 14) {
      out.push({
        text: 'Content-Piece erstellen',
        onClick: () => navigate(`${base}/promo`),
      })
    }
    if (daysSincePipeline !== null && daysSincePipeline > 7 && openPipelineCount > 0) {
      out.push({
        text: `Pipeline checken — ${openPipelineCount} Kontakte warten`,
        onClick: () => navigate(`${base}/sales`),
      })
    }
    if (wordBank.items.length < 5) {
      out.push({
        text: 'Word Bank erweitern für besseres Targeting',
        onClick: () => navigate(`${base}/building`),
      })
    }
    return out
  }, [
    health.percent,
    daysSincePublish,
    daysSincePipeline,
    openPipelineCount,
    wordBank.items.length,
    navigate,
    slug,
  ])

  const loading =
    contacts.loading ||
    pieces.loading ||
    feed.loading ||
    positioning.loading ||
    icps.loading ||
    wordBank.loading ||
    businessModel.loading ||
    assets.loading

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="glass-2 mb-8 rounded-2xl p-5"
      style={{
        border: '1px solid var(--glass-border-1)',
        backdropFilter: 'var(--blur-md)',
        WebkitBackdropFilter: 'var(--blur-md)',
      }}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div
            className="font-mono"
            style={{ fontSize: 10, letterSpacing: '0.12em', color: 'var(--mode-intelligence)' }}
          >
            Morning Brief
          </div>
          <h3 className="font-display mt-1" style={{ fontSize: 18, fontWeight: 600 }}>
            Übersicht
          </h3>
        </div>
        <button
          type="button"
          className="font-mono"
          onClick={() => refresh()}
          style={{
            fontSize: 10,
            padding: '8px 12px',
            borderRadius: 10,
            border: '1px solid var(--glass-border-2)',
            background: 'var(--glass-3)',
            color: 'var(--text-secondary)',
          }}
        >
          Aktualisieren
        </button>
      </div>

      {loading ? (
        <p className="font-mono" style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
          Lade Daten…
        </p>
      ) : (
        <>
          <div className="mb-5">
            <div
              className="font-mono mb-2"
              style={{ fontSize: 9, letterSpacing: '0.1em', color: 'var(--text-tertiary)' }}
            >
              HEUTE
            </div>
            <ul className="flex flex-col gap-2" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {followUpsToday.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/brand/${slug}/sales/${c.id}`)}
                    className="text-left font-mono"
                    style={{
                      fontSize: 12,
                      color: 'var(--accent-blue)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    {c.name || 'Kontakt'} follow-up fällig — {STAGE_LABEL[c.pipeline_stage]}
                  </button>
                </li>
              ))}
              {followUpsToday.length === 0 ? (
                <li className="font-mono" style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                  Keine fälligen Follow-ups heute.
                </li>
              ) : null}
              <li className="font-mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {brandName}
                {': '}
                {daysSincePublish === null
                  ? 'noch kein veröffentlichtes Content-Piece.'
                  : `kein Content seit ${daysSincePublish} Tag${daysSincePublish === 1 ? '' : 'en'}.`}
              </li>
              <li className="font-mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {discoveryWeekCount} neue Discovery-Signale in den letzten 7 Tagen
                {pipelineMovesThisWeek > 0
                  ? ` · ${pipelineMovesThisWeek} Pipeline-Updates diese Woche`
                  : ''}
                .
              </li>
            </ul>
          </div>

          <div className="mb-2">
            <div
              className="font-mono mb-2"
              style={{ fontSize: 9, letterSpacing: '0.1em', color: 'var(--text-tertiary)' }}
            >
              EMPFEHLUNGEN
            </div>
            <ul className="flex flex-col gap-2" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {recommendations.map((r, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={r.onClick}
                    className="text-left font-mono"
                    style={{
                      fontSize: 12,
                      color: 'var(--accent-teal)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    · {r.text}
                  </button>
                </li>
              ))}
              {recommendations.length === 0 ? (
                <li className="font-mono" style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                  · Kurz alle Modi checken — sieht gut aus.
                </li>
              ) : null}
            </ul>
          </div>

          <div
            className="font-mono mt-4 border-t border-[var(--glass-border-1)] pt-3"
            style={{ fontSize: 10, color: 'var(--text-tertiary)' }}
          >
            Generiert um{' '}
            {generatedAt.toLocaleTimeString('de-DE', {
              hour: '2-digit',
              minute: '2-digit',
            })}{' '}
            · Health {health.percent}%
          </div>
        </>
      )}
    </motion.section>
  )
}
