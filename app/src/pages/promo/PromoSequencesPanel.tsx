import { useCallback, useMemo, useState } from 'react'
import { useToast } from '../../components/Toast'
import { useContentPieces } from '../../hooks/useContentPieces'
import { useContentSequences } from '../../hooks/useContentSequences'
import type { ContentSequence, ContentSequencePlanPiece, ContentSequencePlanWeek } from '../../types/db'
import {
  buildTipTapFromIdeaTexts,
  ideaFormatToContentFormat,
  ideaKanalToChannel,
} from '../../lib/promoContentAi'

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}

function addDaysIso(startYmd: string, days: number): string {
  const d = new Date(`${startYmd}T12:00:00`)
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

const STATUSES = ['aktiv', 'pausiert', 'abgeschlossen'] as const

const PIECE_FORMATS = ['post', 'reel', 'story', 'mail', 'artikel', 'karussell', 'ad']
const PIECE_KANAL = ['linkedin', 'instagram', 'tiktok', 'website', 'email']

const FIELD = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 10,
  background: 'var(--glass-1)',
  border: '1px solid var(--glass-border-1)',
  color: 'var(--text-primary)',
  fontSize: 12,
} as const

function normalizePlanWeeks(plan: ContentSequencePlanWeek[], wochen: number): ContentSequencePlanWeek[] {
  const byW = new Map(plan.map((w) => [w.woche, w]))
  const out: ContentSequencePlanWeek[] = []
  for (let i = 1; i <= wochen; i++) {
    const prev = byW.get(i)
    if (prev) out.push(prev)
    else out.push({ woche: i, thema: '', pieces: [] })
  }
  return out
}

export function PromoSequencesPanel({ slug, className }: { slug: string; className?: string }) {
  const seq = useContentSequences(slug, { kind: 'content' })
  const pieces = useContentPieces(slug)
  const { show } = useToast()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [startYmd, setStartYmd] = useState(() => new Date().toISOString().slice(0, 10))
  const [transferBusy, setTransferBusy] = useState(false)

  const selected = useMemo(
    () => seq.items.find((s) => s.id === selectedId) ?? null,
    [seq.items, selectedId],
  )

  const setPlan = useCallback(
    async (id: string, plan: ContentSequencePlanWeek[]) => {
      await seq.update(id, { plan })
    },
    [seq],
  )

  const updateWeek = useCallback(
    async (s: ContentSequence, weekIdx: number, patch: Partial<ContentSequencePlanWeek>) => {
      const plan = normalizePlanWeeks(s.plan, s.wochen)
      const i = plan.findIndex((w) => w.woche === weekIdx)
      if (i < 0) return
      plan[i] = { ...plan[i], ...patch }
      await setPlan(s.id, plan)
    },
    [setPlan],
  )

  const addPiece = useCallback(
    async (s: ContentSequence, weekNum: number) => {
      const plan = normalizePlanWeeks(s.plan, s.wochen)
      const i = plan.findIndex((w) => w.woche === weekNum)
      if (i < 0) return
      const p: ContentSequencePlanPiece = { format: 'post', titel: '', kanal: 'linkedin' }
      plan[i] = { ...plan[i], pieces: [...plan[i].pieces, p] }
      await setPlan(s.id, plan)
    },
    [setPlan],
  )

  const updatePiece = useCallback(
    async (
      s: ContentSequence,
      weekNum: number,
      pi: number,
      patch: Partial<ContentSequencePlanPiece>,
    ) => {
      const plan = normalizePlanWeeks(s.plan, s.wochen)
      const i = plan.findIndex((w) => w.woche === weekNum)
      if (i < 0) return
      const pcs = [...plan[i].pieces]
      const cur = pcs[pi]
      if (!cur) return
      pcs[pi] = { ...cur, ...patch }
      plan[i] = { ...plan[i], pieces: pcs }
      await setPlan(s.id, plan)
    },
    [setPlan],
  )

  const removePiece = useCallback(
    async (s: ContentSequence, weekNum: number, pi: number) => {
      const plan = normalizePlanWeeks(s.plan, s.wochen)
      const i = plan.findIndex((w) => w.woche === weekNum)
      if (i < 0) return
      const pcs = plan[i].pieces.filter((_, j) => j !== pi)
      plan[i] = { ...plan[i], pieces: pcs }
      await setPlan(s.id, plan)
    },
    [setPlan],
  )

  const transferToCalendar = useCallback(async () => {
    if (!selected) return
    setTransferBusy(true)
    try {
      const plan = normalizePlanWeeks(selected.plan, selected.wochen)
      for (const w of plan) {
        const day = addDaysIso(startYmd, (w.woche - 1) * 7)
        for (const p of w.pieces) {
          const title = p.titel.trim() || `${selected.name} · Woche ${w.woche}`
          const hookText = w.thema ? `Thema: ${w.thema}` : ''
          pieces.create({
            title,
            scheduled_at: day,
            content: buildTipTapFromIdeaTexts({ hook: hookText, skript: '' }),
            tags: {
              icp_ids: [],
              cluster_tags: [],
              format: ideaFormatToContentFormat(p.format),
              channel: ideaKanalToChannel(p.kanal),
              goal: 'awareness',
            },
          })
        }
      }
    } finally {
      setTransferBusy(false)
    }
  }, [pieces, selected, startYmd])

  return (
    <div className={`mt-4 grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr] ${className ?? ''}`.trim()}>
      <div
        className="glass-2 flex flex-col gap-3 rounded-2xl p-4"
        style={{ border: '1px solid var(--glass-border-1)', alignSelf: 'start' }}
      >
        <button
          type="button"
          className="font-mono"
          onClick={() =>
            void seq
              .create()
              .then((id) => {
                setSelectedId(id)
              })
              .catch((e) => {
                const msg = e instanceof Error ? e.message : 'Sequenz konnte nicht angelegt werden.'
                show(msg, 'error')
              })
          }
          style={{
            fontSize: 11,
            padding: '10px 14px',
            borderRadius: 10,
            border: '1px solid var(--mode-promo)',
            background: 'color-mix(in srgb, var(--mode-promo) 14%, transparent)',
            color: 'var(--mode-promo)',
          }}
        >
          + Neue Sequenz
        </button>
        {seq.error ? (
          <p className="font-mono" style={{ fontSize: 11, color: 'var(--accent-coral)' }}>
            {seq.error}
          </p>
        ) : null}
        <div className="flex max-h-[420px] flex-col gap-2 overflow-y-auto pr-1">
          {seq.items.map((s) => {
            const on = s.id === selectedId
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedId(s.id)}
                className="text-left font-mono"
                style={{
                  fontSize: 11,
                  padding: '10px 12px',
                  borderRadius: 12,
                  border: on ? '1px solid var(--mode-promo)' : '1px solid var(--glass-border-2)',
                  background: on ? 'var(--glass-3)' : 'var(--glass-1)',
                  color: 'var(--text-primary)',
                }}
              >
                <div style={{ fontWeight: 600 }}>{s.name || 'Ohne Namen'}</div>
                <div style={{ color: 'var(--text-tertiary)', marginTop: 4, fontSize: 10 }}>
                  {s.wochen} Wochen · {s.status}
                </div>
                {s.description ? (
                  <div style={{ color: 'var(--text-secondary)', marginTop: 6, fontSize: 10 }}>
                    {s.description.slice(0, 120)}
                    {s.description.length > 120 ? '…' : ''}
                  </div>
                ) : null}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        {!selected ? (
          <p className="font-mono" style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
            Sequenz wählen oder anlegen.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <input
              value={selected.name}
              onChange={(e) => void seq.update(selected.id, { name: e.target.value })}
              className="font-display"
              style={{
                ...FIELD,
                fontSize: 20,
                fontWeight: 600,
                padding: '12px 14px',
              }}
            />
            <textarea
              value={selected.description}
              onChange={(e) => void seq.update(selected.id, { description: e.target.value })}
              rows={2}
              placeholder="Beschreibung"
              style={{ ...FIELD, resize: 'vertical' }}
            />
            <div className="flex flex-wrap gap-3">
              <label className="font-mono flex flex-col gap-1" style={{ fontSize: 10 }}>
                <span style={{ color: 'var(--text-tertiary)' }}>Wochen</span>
                <input
                  type="number"
                  min={1}
                  max={52}
                  value={selected.wochen}
                  onChange={(e) => {
                    const n = Math.max(1, Math.min(52, Number(e.target.value) || 1))
                    const plan = normalizePlanWeeks(selected.plan, n)
                    void seq.update(selected.id, { wochen: n, plan })
                  }}
                  style={{ ...FIELD, maxWidth: 100 }}
                />
              </label>
              <label className="font-mono flex flex-col gap-1" style={{ fontSize: 10 }}>
                <span style={{ color: 'var(--text-tertiary)' }}>Status</span>
                <select
                  value={selected.status}
                  onChange={(e) => void seq.update(selected.id, { status: e.target.value })}
                  style={{ ...FIELD, minWidth: 140 }}
                >
                  {STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div
              className="flex gap-3 overflow-x-auto pb-2"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              {normalizePlanWeeks(selected.plan, selected.wochen).map((w) => (
                <div
                  key={w.woche}
                  className="glass-2 shrink-0 rounded-2xl p-3"
                  style={{
                    width: 220,
                    border: '1px solid var(--glass-border-1)',
                  }}
                >
                  <div className="font-mono mb-2" style={{ fontSize: 10, color: 'var(--mode-promo)' }}>
                    Woche {w.woche}
                  </div>
                  <input
                    value={w.thema}
                    onChange={(e) => void updateWeek(selected, w.woche, { thema: e.target.value })}
                    placeholder="Thema"
                    style={{ ...FIELD, marginBottom: 8 }}
                  />
                  <ul className="flex flex-col gap-2">
                    {w.pieces.map((p, pi) => (
                      <li
                        key={`${w.woche}-${pi}`}
                        className="rounded-lg p-2"
                        style={{ border: '1px solid var(--glass-border-2)', background: 'var(--glass-1)' }}
                      >
                        <select
                          value={p.format}
                          onChange={(e) => void updatePiece(selected, w.woche, pi, { format: e.target.value })}
                          style={{ ...FIELD, fontSize: 10, marginBottom: 6 }}
                        >
                          {PIECE_FORMATS.map((f) => (
                            <option key={f} value={f}>
                              {f}
                            </option>
                          ))}
                        </select>
                        <input
                          value={p.titel}
                          onChange={(e) => void updatePiece(selected, w.woche, pi, { titel: e.target.value })}
                          placeholder="Titel"
                          style={{ ...FIELD, marginBottom: 6 }}
                        />
                        <select
                          value={p.kanal}
                          onChange={(e) => void updatePiece(selected, w.woche, pi, { kanal: e.target.value })}
                          style={{ ...FIELD, fontSize: 10, marginBottom: 6 }}
                        >
                          {PIECE_KANAL.map((k) => (
                            <option key={k} value={k}>
                              {k}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="font-mono"
                          onClick={() => void removePiece(selected, w.woche, pi)}
                          style={{
                            fontSize: 9,
                            color: 'var(--accent-coral)',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: 0,
                          }}
                        >
                          Entfernen
                        </button>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className="font-mono mt-2 w-full"
                    onClick={() => void addPiece(selected, w.woche)}
                    style={{
                      fontSize: 10,
                      padding: '8px',
                      borderRadius: 8,
                      border: '1px dashed var(--glass-border-2)',
                      background: 'transparent',
                      color: 'var(--text-tertiary)',
                    }}
                  >
                    + Piece
                  </button>
                </div>
              ))}
            </div>

            <div
              className="glass-2 flex flex-wrap items-end gap-3 rounded-xl p-4"
              style={{ border: '1px solid var(--glass-border-1)' }}
            >
              <label className="font-mono flex flex-col gap-1" style={{ fontSize: 10 }}>
                <span style={{ color: 'var(--text-tertiary)' }}>Startdatum (erste Woche)</span>
                <input
                  type="date"
                  value={startYmd}
                  onChange={(e) => setStartYmd(e.target.value)}
                  style={FIELD}
                />
              </label>
              <button
                type="button"
                disabled={transferBusy}
                className="font-mono"
                onClick={() => void transferToCalendar()}
                style={{
                  fontSize: 11,
                  padding: '10px 16px',
                  borderRadius: 10,
                  border: '1px solid var(--accent-teal)',
                  background: 'color-mix(in srgb, var(--accent-teal) 12%, transparent)',
                  color: 'var(--accent-teal)',
                }}
              >
                {transferBusy ? 'Übertrage…' : 'Sequenz in Kalender übertragen'}
              </button>
            </div>

            <button
              type="button"
              className="font-mono self-start"
              onClick={() => void seq.remove(selected.id).then(() => setSelectedId(null))}
              style={{
                fontSize: 11,
                color: 'var(--accent-coral)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Sequenz löschen
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
