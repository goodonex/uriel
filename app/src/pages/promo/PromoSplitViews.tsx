/**
 * Desktop-Modul-Ansichten für Promo (Kalender / Pieces / Kampagnen).
 * Von PromoMode (Tab Kalender) und von promo-*-Modulen gemeinsam genutzt.
 */
import { motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Drawer } from '../../components/Drawer'
import { SectionLabel } from '../../components/SectionLabel'
import { useToast } from '../../components/Toast'
import { useBrands } from '../../hooks/useBrands'
import { useCampaigns } from '../../hooks/useCampaigns'
import { useContentPieces } from '../../hooks/useContentPieces'
import { useICPs } from '../../hooks/useICPs'
import { usePositioning } from '../../hooks/usePositioning'
import { useWordBank } from '../../hooks/useWordBank'
import type { ContentFormat, ContentPiece } from '../../types/db'
import { CampaignsSection } from './CampaignsSection'
import { ContentPieceEditor } from './ContentPieceEditor'

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function startOfCalendarMonth(d: Date): Date {
  const first = new Date(d.getFullYear(), d.getMonth(), 1)
  const dow = (first.getDay() + 6) % 7
  const start = new Date(first)
  start.setDate(first.getDate() - dow)
  return start
}

function formatDotColor(format: ContentFormat): string {
  switch (format) {
    case 'post':
      return 'var(--mode-promo)'
    case 'reel':
      return 'var(--accent-teal)'
    case 'story':
      return 'var(--accent-purple)'
    case 'email':
      return 'var(--accent-blue)'
    case 'article':
      return 'var(--accent-amber)'
    case 'carousel':
      return 'var(--accent-coral)'
    case 'other':
    default:
      return 'var(--text-tertiary)'
  }
}

function formatDayLabel(iso: string): string {
  return iso.slice(0, 10)
}

function DayDots({ dayPieces }: { dayPieces: ContentPiece[] }) {
  const shown = dayPieces.slice(0, 4)
  return (
    <span
      style={{
        display: 'flex',
        gap: 2,
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 8,
        flexWrap: 'wrap',
        maxWidth: 32,
      }}
    >
      {shown.map((p) => (
        <span
          key={p.id}
          title={p.title || 'Ohne Titel'}
          style={{
            width: 6,
            height: 6,
            borderRadius: 999,
            background: formatDotColor(p.tags.format),
            flexShrink: 0,
            opacity: 0.95,
          }}
        />
      ))}
      {dayPieces.length > 4 ? (
        <span
          className="font-mono"
          style={{ fontSize: 8, color: 'var(--text-tertiary)', lineHeight: 1 }}
        >
          +{dayPieces.length - 4}
        </span>
      ) : null}
    </span>
  )
}

export function PromoCalendarSplit() {
  const { slug } = useParams<{ slug: string }>()
  const pieces = useContentPieces(slug)
  const [cursor, setCursor] = useState(() => {
    const n = new Date()
    return new Date(n.getFullYear(), n.getMonth(), 1)
  })
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<string | null>(null)

  const piecesByDay = useMemo(() => {
    const m = new Map<string, ContentPiece[]>()
    for (const p of pieces.items) {
      const day = p.scheduled_at.slice(0, 10)
      const arr = m.get(day) ?? []
      arr.push(p)
      m.set(day, arr)
    }
    return m
  }, [pieces.items])

  const gridStart = startOfCalendarMonth(cursor)
  const cells: Date[] = []
  for (let i = 0; i < 42; i++) {
    const c = new Date(gridStart)
    c.setDate(gridStart.getDate() + i)
    cells.push(c)
  }

  const monthLabel = cursor.toLocaleDateString('de-DE', {
    month: 'long',
    year: 'numeric',
  })

  return (
    <div style={{ minWidth: 0 }}>
      <SectionLabel accent="var(--mode-promo)" tight>
        Kalender
      </SectionLabel>
      <div
        className="glass-2"
        style={{
          borderRadius: 16,
          padding: 16,
          border: '1px solid var(--glass-border-1)',
          backdropFilter: 'var(--blur-md)',
          WebkitBackdropFilter: 'var(--blur-md)',
        }}
      >
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            className="font-mono"
            style={{
              fontSize: 12,
              padding: '6px 10px',
              borderRadius: 8,
              border: '1px solid var(--glass-border-2)',
              color: 'var(--text-secondary)',
            }}
            onClick={() =>
              setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))
            }
          >
            ‹
          </button>
          <span
            className="font-display"
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}
          >
            {monthLabel}
          </span>
          <button
            type="button"
            className="font-mono"
            style={{
              fontSize: 12,
              padding: '6px 10px',
              borderRadius: 8,
              border: '1px solid var(--glass-border-2)',
              color: 'var(--text-secondary)',
            }}
            onClick={() =>
              setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))
            }
          >
            ›
          </button>
        </div>

        <div
          className="grid grid-cols-7 gap-1 font-mono"
          style={{ fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 6 }}
        >
          {WEEKDAYS.map((w) => (
            <div key={w} className="text-center">
              {w}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map((d) => {
            const ymd = toYMD(d)
            const inMonth = d.getMonth() === cursor.getMonth()
            const dayPieces = piecesByDay.get(ymd) ?? []
            const isSel = selectedCalendarDay === ymd
            return (
              <button
                key={ymd + d.getTime()}
                type="button"
                onClick={() => setSelectedCalendarDay(ymd)}
                className="font-mono"
                style={{
                  minHeight: 40,
                  borderRadius: 8,
                  border: isSel
                    ? '1px solid var(--mode-promo)'
                    : '1px solid transparent',
                  background: isSel ? 'var(--glass-3)' : 'var(--glass-1)',
                  color: inMonth ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  fontSize: 11,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 2,
                }}
              >
                <span>{d.getDate()}</span>
                {dayPieces.length > 0 ? (
                  <DayDots dayPieces={dayPieces} />
                ) : (
                  <span style={{ minHeight: 8 }} />
                )}
              </button>
            )
          })}
        </div>

        {selectedCalendarDay ? (
          <div className="mt-4 border-t border-[var(--glass-border-1)] pt-3">
            <span
              className="font-mono mb-2 block"
              style={{ fontSize: 10, color: 'var(--text-tertiary)' }}
            >
              Geplant am {selectedCalendarDay}
            </span>
            <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto">
              {(piecesByDay.get(selectedCalendarDay) ?? []).map((p) => (
                <li key={p.id} className="font-mono truncate text-[11px] text-[var(--text-secondary)]">
                  <span
                    style={{
                      display: 'inline-block',
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      marginRight: 8,
                      verticalAlign: 'middle',
                      background: formatDotColor(p.tags.format),
                    }}
                  />
                  {p.title || 'Ohne Titel'}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--glass-border-1)] pt-3">
          <span className="font-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
            Legende:
          </span>
          {(
            [
              ['post', 'Post'],
              ['reel', 'Reel'],
              ['story', 'Story'],
              ['email', 'Mail'],
              ['article', 'Artikel'],
              ['carousel', 'Karussell'],
              ['other', 'Ad'],
            ] as const
          ).map(([fmt, lab]) => (
            <span
              key={fmt}
              className="font-mono"
              style={{
                fontSize: 9,
                color: 'var(--text-secondary)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  background: formatDotColor(fmt),
                }}
              />
              {lab}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

export function PromoPiecesSplit() {
  const { slug } = useParams<{ slug: string }>()
  const { show } = useToast()
  const pieces = useContentPieces(slug)
  const campaigns = useCampaigns(slug)
  const icps = useICPs(slug)
  const wordBank = useWordBank(slug)
  const { brands } = useBrands()
  const positioning = usePositioning(slug)
  const brand = brands.find((b) => b.slug === slug)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = pieces.items.find((p) => p.id === selectedId) ?? null

  return (
    <div style={{ minWidth: 0 }}>
      <SectionLabel accent="var(--mode-promo)">Content-Pieces</SectionLabel>
      {pieces.loading ? (
        <div
          className="animate-pulse"
          style={{
            minHeight: 120,
            borderRadius: 16,
            background: 'var(--glass-1)',
            border: '1px solid var(--glass-border-1)',
          }}
        />
      ) : pieces.error ? (
        <div className="font-mono" style={{ fontSize: 12, color: 'var(--accent-coral)' }}>
          Content-Pieces konnten nicht geladen werden: {pieces.error}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-2">
            {pieces.items.map((piece, idx) => (
              <motion.button
                key={piece.id}
                type="button"
                onClick={() => setSelectedId(piece.id)}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: idx * 0.03,
                  duration: 0.35,
                  ease: [0.16, 1, 0.3, 1],
                }}
                whileHover={{ y: -1 }}
                className="text-left"
                style={{
                  padding: 12,
                  borderRadius: 12,
                  background: 'var(--glass-2)',
                  border: '1px solid var(--glass-border-1)',
                  backdropFilter: 'var(--blur-md)',
                  WebkitBackdropFilter: 'var(--blur-md)',
                }}
              >
                <div
                  className="font-mono"
                  style={{
                    fontSize: 9,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'var(--mode-promo)',
                    marginBottom: 4,
                  }}
                >
                  {piece.tags.channel} · {piece.tags.format}
                </div>
                <div
                  className="font-display truncate"
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                  }}
                >
                  {piece.title || 'Ohne Titel'}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 6 }}>
                  {formatDayLabel(piece.scheduled_at)}
                </div>
              </motion.button>
            ))}

            <motion.button
              type="button"
              onClick={() => {
                const p = pieces.create()
                setSelectedId(p.id)
              }}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ y: -1 }}
              className="flex min-h-[88px] flex-col items-center justify-center font-mono"
              style={{
                padding: 12,
                borderRadius: 12,
                border: '1px dashed var(--glass-border-2)',
                color: 'var(--text-tertiary)',
                fontSize: 11,
              }}
            >
              + Neues Piece
            </motion.button>
          </div>

          <Drawer
            open={selected !== null}
            onClose={() => setSelectedId(null)}
            title={selected?.title ?? 'Content-Piece'}
            width={520}
          >
            {selected ? (
              <ContentPieceEditor
                piece={selected}
                campaigns={campaigns.items}
                icps={icps.items}
                wordBank={wordBank.items}
                brandName={brand?.name ?? slug ?? ''}
                positioningStatement={positioning.item?.statement ?? ''}
                toneOfVoice={positioning.item?.tone_of_voice ?? ''}
                onPatch={(patch) => pieces.update(selected.id, patch)}
                onAutoTagged={() => show('Tags aus Foundation ergänzt', 'success')}
                onDelete={() => {
                  pieces.remove(selected.id)
                  setSelectedId(null)
                }}
              />
            ) : null}
          </Drawer>
        </>
      )}
    </div>
  )
}

export function PromoCampaignsSplit() {
  const { slug } = useParams<{ slug: string }>()
  const pieces = useContentPieces(slug)
  const campaigns = useCampaigns(slug)

  const removeCampaign = (id: string) => {
    for (const p of pieces.items) {
      if (p.campaign_id === id) {
        pieces.update(p.id, { campaign_id: null })
      }
    }
    campaigns.remove(id)
  }

  return (
    <div style={{ minWidth: 0 }}>
      <SectionLabel accent="var(--mode-promo)">Kampagnen</SectionLabel>
      <CampaignsSection
        campaigns={campaigns.items}
        pieces={pieces.items}
        loading={campaigns.loading}
        error={campaigns.error}
        onCreate={() => campaigns.create()}
        onUpdate={campaigns.update}
        onDelete={removeCampaign}
      />
    </div>
  )
}
