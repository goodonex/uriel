import { useCallback, useMemo, useState } from 'react'
import { Drawer } from '../../components/Drawer'
import { useToast } from '../../components/Toast'
import { useContentIdeas } from '../../hooks/useContentIdeas'
import { useContentPieces } from '../../hooks/useContentPieces'
import type { ContentIdea, ICP, WordBankEntry } from '../../types/db'
import {
  buildFoundationPromptParts,
  buildTipTapFromIdeaTexts,
  generateAnthropicContent,
  getAnthropicApiKey,
  ideaFormatToContentFormat,
  ideaKanalToChannel,
} from '../../lib/promoContentAi'

const FORMAT_FILTERS = [
  'alle',
  'post',
  'reel',
  'story',
  'mail',
  'artikel',
  'karussell',
  'ad',
] as const

const STATUS_FILTERS = ['alle', 'idee', 'skript', 'produktion', 'fertig'] as const

const KANAL_OPTIONS = ['linkedin', 'instagram', 'tiktok', 'website', 'email', 'other']

const FIELD = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 10,
  background: 'var(--glass-1)',
  border: '1px solid var(--glass-border-1)',
  color: 'var(--text-primary)',
  fontSize: 13,
} as const

export function PromoIdeasPanel({
  slug,
  brandName,
  positioningStatement,
  toneOfVoice,
  icps,
  wordBank,
}: {
  slug: string
  brandName: string
  positioningStatement: string
  toneOfVoice: string
  icps: ICP[]
  wordBank: WordBankEntry[]
}) {
  const ideas = useContentIdeas(slug)
  const pieces = useContentPieces(slug)
  const { show } = useToast()

  const [formatF, setFormatF] = useState<(typeof FORMAT_FILTERS)[number]>('alle')
  const [statusF, setStatusF] = useState<(typeof STATUS_FILTERS)[number]>('alle')
  const [weekF, setWeekF] = useState<number | 'alle'>('alle')
  const [drawerId, setDrawerId] = useState<string | null>(null)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiErr, setAiErr] = useState<string | null>(null)
  const [createBusy, setCreateBusy] = useState(false)

  const drawerIdea = useMemo(
    () => ideas.items.find((i) => i.id === drawerId) ?? null,
    [drawerId, ideas.items],
  )

  const weekOptions = useMemo(() => {
    const s = new Set<number>()
    for (const i of ideas.items) {
      if (i.woche != null && Number.isFinite(i.woche)) s.add(Number(i.woche))
    }
    return [...s].sort((a, b) => a - b)
  }, [ideas.items])

  const filtered = useMemo(() => {
    let rows = ideas.items
    if (formatF !== 'alle') rows = rows.filter((r) => r.format === formatF)
    if (statusF !== 'alle') rows = rows.filter((r) => r.status === statusF)
    if (weekF !== 'alle') rows = rows.filter((r) => r.woche === weekF)
    return rows
  }, [ideas.items, formatF, statusF, weekF])

  const hasKey = Boolean(getAnthropicApiKey())

  const runAi = useCallback(
    async (idea: ContentIdea) => {
      if (!hasKey) return
      setAiBusy(true)
      setAiErr(null)
      try {
        const yesWords = wordBank.filter((w) => w.type === 'yes')
        const { icpNamesAndPainpoints, jaWoerter } = buildFoundationPromptParts({
          brandName,
          positioningStatement,
          toneOfVoice,
          icps,
          wordBankYes: yesWords,
        })
        const gen = await generateAnthropicContent({
          brandName,
          positioningStatement,
          toneOfVoice,
          icpNamesAndPainpoints,
          jaWoerter,
          format: idea.format,
          kanal: idea.kanal,
          titelHint: idea.title,
        })
        const skriptMerged = [gen.haupttext, gen.cta].filter(Boolean).join('\n\n')
        await ideas.update(idea.id, {
          hook: gen.hook,
          skript: idea.skript ? `${idea.skript}\n\n${skriptMerged}` : skriptMerged,
          a_roll: gen.a_roll,
          b_roll: gen.b_roll,
        })
      } catch (e) {
        setAiErr(e instanceof Error ? e.message : 'KI-Fehler')
      } finally {
        setAiBusy(false)
      }
    },
    [brandName, hasKey, icps, ideas, positioningStatement, toneOfVoice, wordBank],
  )

  const createPieceFromIdea = useCallback(
    async (idea: ContentIdea) => {
      setCreateBusy(true)
      try {
        const content = buildTipTapFromIdeaTexts({
          hook: idea.hook,
          skript: idea.skript,
        })
        pieces.create({
          title: idea.title.trim() || 'Content aus Idee',
          content,
          tags: {
            icp_ids: [],
            cluster_tags: [],
            format: ideaFormatToContentFormat(idea.format),
            channel: ideaKanalToChannel(idea.kanal),
            goal: 'awareness',
          },
        })
        await ideas.update(idea.id, { status: 'fertig' })
        setDrawerId(null)
      } catch (e) {
        console.error(e)
      } finally {
        setCreateBusy(false)
      }
    },
    [ideas, pieces],
  )

  return (
    <div style={{ marginTop: 16 }}>
      {ideas.error ? (
        <p className="font-mono" style={{ fontSize: 12, color: 'var(--accent-coral)' }}>
          {ideas.error}
        </p>
      ) : null}

      <div
        className="glass-2 mb-6 flex flex-wrap items-end gap-3 rounded-2xl p-4"
        style={{ border: '1px solid var(--glass-border-1)' }}
      >
        <button
          type="button"
          className="font-mono"
          onClick={() =>
            void ideas.create().catch((e) => {
              const msg = e instanceof Error ? e.message : 'Idee konnte nicht angelegt werden.'
              show(msg, 'error')
            })
          }
          style={{
            fontSize: 11,
            padding: '10px 16px',
            borderRadius: 10,
            border: '1px solid var(--mode-promo)',
            background: 'color-mix(in srgb, var(--mode-promo) 14%, transparent)',
            color: 'var(--mode-promo)',
          }}
        >
          + Neue Idee
        </button>
        <label className="font-mono flex flex-col gap-1" style={{ fontSize: 10 }}>
          <span style={{ color: 'var(--text-tertiary)' }}>Format</span>
          <select
            value={formatF}
            onChange={(e) => setFormatF(e.target.value as typeof formatF)}
            style={{ ...FIELD, minWidth: 120 }}
          >
            {FORMAT_FILTERS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
        <label className="font-mono flex flex-col gap-1" style={{ fontSize: 10 }}>
          <span style={{ color: 'var(--text-tertiary)' }}>Status</span>
          <select
            value={statusF}
            onChange={(e) => setStatusF(e.target.value as typeof statusF)}
            style={{ ...FIELD, minWidth: 120 }}
          >
            {STATUS_FILTERS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
        <label className="font-mono flex flex-col gap-1" style={{ fontSize: 10 }}>
          <span style={{ color: 'var(--text-tertiary)' }}>Woche (KW)</span>
          <select
            value={weekF === 'alle' ? 'alle' : String(weekF)}
            onChange={(e) =>
              setWeekF(e.target.value === 'alle' ? 'alle' : Number(e.target.value))
            }
            style={{ ...FIELD, minWidth: 100 }}
          >
            <option value="alle">alle</option>
            {weekOptions.map((w) => (
              <option key={w} value={w}>
                KW{w}
              </option>
            ))}
          </select>
        </label>
      </div>

      {ideas.loading ? (
        <div
          className="animate-pulse rounded-2xl"
          style={{ height: 160, background: 'var(--glass-2)' }}
        />
      ) : (
        <div
          className="overflow-x-auto rounded-2xl"
          style={{ border: '1px solid var(--glass-border-1)' }}
        >
          <table className="w-full text-left" style={{ fontSize: 13 }}>
            <thead className="font-mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
              <tr>
                <th style={{ padding: 12 }}>Woche</th>
                <th style={{ padding: 12 }}>Format</th>
                <th style={{ padding: 12 }}>Titel</th>
                <th style={{ padding: 12 }}>Hook</th>
                <th style={{ padding: 12 }}>Status</th>
                <th style={{ padding: 12 }}>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr
                  key={row.id}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') setDrawerId(row.id)
                  }}
                  onClick={() => setDrawerId(row.id)}
                  style={{
                    borderTop: '1px solid var(--glass-border-1)',
                    cursor: 'pointer',
                  }}
                >
                  <td style={{ padding: 12 }}>{row.woche ?? '—'}</td>
                  <td style={{ padding: 12 }}>{row.format}</td>
                  <td style={{ padding: 12, color: 'var(--text-primary)' }}>{row.title || '—'}</td>
                  <td
                    style={{
                      padding: 12,
                      maxWidth: 220,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {row.hook || '—'}
                  </td>
                  <td style={{ padding: 12 }}>{row.status}</td>
                  <td style={{ padding: 12 }}>
                    <button
                      type="button"
                      className="font-mono"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDrawerId(row.id)
                      }}
                      style={{
                        fontSize: 10,
                        padding: '6px 10px',
                        borderRadius: 8,
                        border: '1px solid var(--glass-border-2)',
                        background: 'var(--glass-2)',
                        color: 'var(--mode-promo)',
                      }}
                    >
                      Bearbeiten
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Drawer
        open={drawerIdea !== null}
        onClose={() => setDrawerId(null)}
        title={drawerIdea?.title || 'Idee'}
        width={480}
      >
        {drawerIdea ? (
          <div className="flex flex-col gap-4">
            {aiErr ? (
              <p className="font-mono" style={{ fontSize: 11, color: 'var(--accent-coral)' }}>
                {aiErr}
              </p>
            ) : null}
            <div className="flex flex-wrap items-start gap-2">
              <div className="min-w-0 flex-1">
                <label className="font-mono mb-1 block" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                  Titel
                </label>
                <input
                  value={drawerIdea.title}
                  onChange={(e) => void ideas.update(drawerIdea.id, { title: e.target.value })}
                  style={FIELD}
                />
              </div>
              <div className="flex flex-col justify-end gap-1" style={{ paddingTop: 18 }}>
                <button
                  type="button"
                  disabled={!hasKey || aiBusy}
                  title={!hasKey ? 'API Key fehlt' : undefined}
                  className="font-mono whitespace-nowrap"
                  onClick={() => void runAi(drawerIdea)}
                  style={{
                    fontSize: 11,
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: '1px solid var(--accent-teal)',
                    background: hasKey
                      ? 'color-mix(in srgb, var(--accent-teal) 12%, transparent)'
                      : 'var(--glass-3)',
                    color: hasKey ? 'var(--accent-teal)' : 'var(--text-tertiary)',
                    opacity: !hasKey || aiBusy ? 0.55 : 1,
                    cursor: !hasKey || aiBusy ? 'not-allowed' : 'pointer',
                  }}
                >
                  {aiBusy ? 'KI denkt…' : 'KI generieren'}
                </button>
              </div>
            </div>
            <div>
              <label className="font-mono mb-1 block" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                Hook
              </label>
              <textarea
                value={drawerIdea.hook}
                onChange={(e) => void ideas.update(drawerIdea.id, { hook: e.target.value })}
                rows={3}
                style={{ ...FIELD, resize: 'vertical' }}
              />
            </div>
            <div>
              <label className="font-mono mb-1 block" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                A-Roll
              </label>
              <textarea
                value={drawerIdea.a_roll}
                onChange={(e) => void ideas.update(drawerIdea.id, { a_roll: e.target.value })}
                rows={3}
                style={{ ...FIELD, resize: 'vertical' }}
              />
            </div>
            <div>
              <label className="font-mono mb-1 block" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                B-Roll
              </label>
              <textarea
                value={drawerIdea.b_roll}
                onChange={(e) => void ideas.update(drawerIdea.id, { b_roll: e.target.value })}
                rows={3}
                style={{ ...FIELD, resize: 'vertical' }}
              />
            </div>
            <div>
              <label className="font-mono mb-1 block" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                Skript
              </label>
              <textarea
                value={drawerIdea.skript}
                onChange={(e) => void ideas.update(drawerIdea.id, { skript: e.target.value })}
                rows={8}
                style={{ ...FIELD, resize: 'vertical' }}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="font-mono flex flex-col gap-1" style={{ fontSize: 10 }}>
                <span style={{ color: 'var(--text-tertiary)' }}>Format</span>
                <select
                  value={drawerIdea.format}
                  onChange={(e) => void ideas.update(drawerIdea.id, { format: e.target.value })}
                  style={FIELD}
                >
                  {FORMAT_FILTERS.filter((f) => f !== 'alle').map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </label>
              <label className="font-mono flex flex-col gap-1" style={{ fontSize: 10 }}>
                <span style={{ color: 'var(--text-tertiary)' }}>Status</span>
                <select
                  value={drawerIdea.status}
                  onChange={(e) => void ideas.update(drawerIdea.id, { status: e.target.value })}
                  style={FIELD}
                >
                  {STATUS_FILTERS.filter((f) => f !== 'alle').map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="font-mono flex flex-col gap-1" style={{ fontSize: 10 }}>
              <span style={{ color: 'var(--text-tertiary)' }}>Kanal</span>
              <select
                value={drawerIdea.kanal}
                onChange={(e) => void ideas.update(drawerIdea.id, { kanal: e.target.value })}
                style={FIELD}
              >
                {KANAL_OPTIONS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </label>
            <label className="font-mono flex flex-col gap-1" style={{ fontSize: 10 }}>
              <span style={{ color: 'var(--text-tertiary)' }}>Woche (KW)</span>
              <input
                type="number"
                value={drawerIdea.woche ?? ''}
                onChange={(e) => {
                  const v = e.target.value
                  void ideas.update(drawerIdea.id, {
                    woche: v === '' ? null : Number(v),
                  })
                }}
                style={FIELD}
                placeholder="optional"
              />
            </label>
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                className="font-mono"
                disabled={createBusy}
                onClick={() => void createPieceFromIdea(drawerIdea)}
                style={{
                  fontSize: 11,
                  padding: '10px 16px',
                  borderRadius: 10,
                  border: '1px solid var(--mode-promo)',
                  background: 'color-mix(in srgb, var(--mode-promo) 14%, transparent)',
                  color: 'var(--mode-promo)',
                }}
              >
                Als Content-Piece erstellen
              </button>
              <button
                type="button"
                className="font-mono"
                onClick={() => void ideas.remove(drawerIdea.id).then(() => setDrawerId(null))}
                style={{
                  fontSize: 11,
                  padding: '10px 16px',
                  borderRadius: 10,
                  border: '1px solid var(--accent-coral)',
                  color: 'var(--accent-coral)',
                  background: 'transparent',
                }}
              >
                Löschen
              </button>
            </div>
          </div>
        ) : null}
      </Drawer>
    </div>
  )
}
