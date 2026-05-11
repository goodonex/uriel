import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useDebouncedCallback } from '../../hooks/useDebouncedCallback'
import {
  buildFoundationPromptParts,
  buildTipTapFromIdeaTexts,
  generateAnthropicContent,
  getAnthropicApiKey,
} from '../../lib/promoContentAi'
import {
  mergeTagsIntoPieceTags,
  suggestContentTags,
} from '../../lib/autoTagContent'
import type {
  Campaign,
  ContentChannel,
  ContentFormat,
  ContentGoal,
  ContentPiece,
  ICP,
  WordBankEntry,
} from '../../types/db'

interface ContentPieceEditorProps {
  piece: ContentPiece
  campaigns: Campaign[]
  icps: ICP[]
  wordBank: WordBankEntry[]
  brandName?: string
  positioningStatement?: string
  toneOfVoice?: string
  onPatch: (patch: Partial<Omit<ContentPiece, 'id' | 'brand_id'>>) => void
  onDelete: () => void
  onAutoTagged?: () => void
}

const EDITOR_STYLE = {
  minHeight: 220,
  fontSize: 14,
  lineHeight: 1.6,
  padding: '12px 14px',
  color: 'var(--text-primary)',
  outline: 'none',
}

const FORMAT_OPTIONS: { value: ContentFormat; label: string }[] = [
  { value: 'post', label: 'Post' },
  { value: 'reel', label: 'Reel' },
  { value: 'story', label: 'Story' },
  { value: 'email', label: 'E-Mail' },
  { value: 'article', label: 'Artikel' },
  { value: 'carousel', label: 'Karussell' },
  { value: 'other', label: 'Ad / Werbung' },
]

const CHANNEL_OPTIONS: { value: ContentChannel; label: string }[] = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'email', label: 'E-Mail' },
  { value: 'website', label: 'Website' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'other', label: 'Sonstiges' },
]

const GOAL_OPTIONS: { value: ContentGoal; label: string }[] = [
  { value: 'awareness', label: 'Awareness' },
  { value: 'leads', label: 'Lead' },
  { value: 'sales', label: 'Sale' },
  { value: 'nurture', label: 'Nurture' },
  { value: 'other', label: 'Sonstiges' },
]

const BTN = {
  fontSize: 11,
  padding: '6px 10px',
  borderRadius: 8,
  border: '1px solid var(--glass-border-2)',
  background: 'var(--glass-2)',
  color: 'var(--text-secondary)',
} as const

function readManualConversions(piece: ContentPiece): number | null {
  const j = piece.performance_api.instagram_metrics_json
  if (!j || typeof j !== 'object') return null
  const v = (j as Record<string, unknown>).manual_conversions
  return typeof v === 'number' ? v : null
}

export function ContentPieceEditor({
  piece,
  campaigns,
  icps,
  wordBank,
  brandName = '',
  positioningStatement = '',
  toneOfVoice = '',
  onPatch,
  onDelete,
  onAutoTagged,
}: ContentPieceEditorProps) {
  const [title, setTitle] = useState(piece.title)
  const [aiBusy, setAiBusy] = useState(false)
  const [aiErr, setAiErr] = useState<string | null>(null)
  const [imp, setImp] = useState(() =>
    String(piece.performance_manual.impressions ?? ''),
  )
  const [clk, setClk] = useState(() =>
    String(piece.performance_manual.engagements ?? ''),
  )
  const [leadsIn, setLeadsIn] = useState(() =>
    String(piece.performance_manual.leads ?? ''),
  )
  const [convIn, setConvIn] = useState(() =>
    String(readManualConversions(piece) ?? ''),
  )
  const [notesLocal, setNotesLocal] = useState(piece.performance_manual.notes)

  const pieceRef = useRef(piece)
  pieceRef.current = piece

  useEffect(() => {
    setTitle(piece.title)
  }, [piece.id, piece.title])

  useEffect(() => {
    setImp(String(piece.performance_manual.impressions ?? ''))
    setClk(String(piece.performance_manual.engagements ?? ''))
    setLeadsIn(String(piece.performance_manual.leads ?? ''))
    setConvIn(String(readManualConversions(piece) ?? ''))
    setNotesLocal(piece.performance_manual.notes)
  }, [piece.id])

  const debouncedTitle = useDebouncedCallback((v: string) =>
    onPatch({ title: v }),
  )
  const debouncedContent = useDebouncedCallback((doc: Record<string, unknown>) =>
    onPatch({ content: doc }),
  )

  const debouncedPerf = useDebouncedCallback(
    (partial: Partial<ContentPiece['performance_manual']>) => {
      const cur = pieceRef.current.performance_manual
      onPatch({
        performance_manual: {
          ...cur,
          ...partial,
          updated_at: new Date().toISOString(),
        },
      })
    },
    450,
  )

  const debouncedConversions = useDebouncedCallback((n: number | null) => {
    const cur = pieceRef.current.performance_api
    const prev =
      (cur.instagram_metrics_json as Record<string, unknown> | null) ?? {}
    onPatch({
      performance_api: {
        ...cur,
        instagram_metrics_json: { ...prev, manual_conversions: n },
      },
    })
  }, 450)

  const editor = useEditor({
    extensions: [StarterKit],
    content: piece.content,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'promo-editor-root',
        style: `font-family: var(--font-body);`,
      },
    },
    onUpdate: ({ editor: ed }) => {
      debouncedContent(ed.getJSON() as Record<string, unknown>)
    },
  })

  useEffect(() => {
    if (!editor) return
    const a = JSON.stringify(editor.getJSON())
    const b = JSON.stringify(piece.content)
    if (a !== b) {
      editor.commands.setContent(piece.content, { emitUpdate: false })
    }
  }, [editor, piece.id, piece.content])

  const clusterChoices = [
    ...new Set(
      wordBank.map((w) => (w.cluster.trim() ? w.cluster.trim() : 'Allgemein')),
    ),
  ].sort()

  const toggleIcp = (id: string) => {
    const set = new Set(piece.tags.icp_ids)
    if (set.has(id)) set.delete(id)
    else set.add(id)
    onPatch({ tags: { ...piece.tags, icp_ids: [...set] } })
  }

  const toggleCluster = (cluster: string) => {
    const set = new Set(piece.tags.cluster_tags)
    if (set.has(cluster)) set.delete(cluster)
    else set.add(cluster)
    onPatch({ tags: { ...piece.tags, cluster_tags: [...set] } })
  }

  const applyAutoTag = () => {
    const sug = suggestContentTags(icps, wordBank, title, piece.content)
    onPatch({
      tags: mergeTagsIntoPieceTags(piece.tags, sug),
    })
    onAutoTagged?.()
  }

  const hasAiKey = Boolean(getAnthropicApiKey())

  const runContentAi = useCallback(async () => {
    if (!hasAiKey || !editor) return
    setAiBusy(true)
    setAiErr(null)
    try {
      const yesWords = wordBank.filter((w) => w.type === 'yes')
      const { icpNamesAndPainpoints, jaWoerter } = buildFoundationPromptParts({
        brandName: brandName || 'Brand',
        positioningStatement,
        toneOfVoice,
        icps,
        wordBankYes: yesWords,
      })
      const gen = await generateAnthropicContent({
        brandName: brandName || 'Brand',
        positioningStatement,
        toneOfVoice,
        icpNamesAndPainpoints,
        jaWoerter,
        format: piece.tags.format,
        kanal: piece.tags.channel,
        titelHint: title,
      })
      const hashtags = gen.hashtags.filter(Boolean)
      const doc = buildTipTapFromIdeaTexts({
        hook: gen.hook,
        skript: gen.haupttext,
        cta: gen.cta,
        hashtags,
      })
      const inner = [...((doc.content as Record<string, unknown>[]) ?? [])]
      if (gen.a_roll?.trim()) {
        inner.push({
          type: 'paragraph',
          content: [{ type: 'text', text: `A-Roll: ${gen.a_roll.trim()}` }],
        })
      }
      if (gen.b_roll?.trim()) {
        inner.push({
          type: 'paragraph',
          content: [{ type: 'text', text: `B-Roll: ${gen.b_roll.trim()}` }],
        })
      }
      const fullDoc = { ...doc, content: inner }
      const nextTitle =
        title.trim() || (gen.hook ? gen.hook.slice(0, 96) : 'Neuer Content')
      setTitle(nextTitle)
      debouncedTitle(nextTitle)
      editor.commands.setContent(fullDoc, { emitUpdate: false })
      debouncedContent(fullDoc)
      onPatch({ title: nextTitle, content: fullDoc })
    } catch (e) {
      setAiErr(e instanceof Error ? e.message : 'KI-Fehler')
    } finally {
      setAiBusy(false)
    }
  }, [
    brandName,
    debouncedContent,
    debouncedTitle,
    editor,
    hasAiKey,
    icps,
    onPatch,
    piece.tags.channel,
    piece.tags.format,
    positioningStatement,
    title,
    toneOfVoice,
    wordBank,
  ])

  return (
    <div className="flex flex-col gap-4">
      {aiErr ? (
        <p className="font-mono" style={{ fontSize: 11, color: 'var(--accent-coral)' }}>
          {aiErr}
        </p>
      ) : null}
      <div>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <label
            className="font-mono block"
            style={{
              fontSize: 11,
              letterSpacing: '0.06em',
              color: 'var(--text-tertiary)',
            }}
          >
            Titel
          </label>
          <button
            type="button"
            disabled={!hasAiKey || aiBusy}
            title={!hasAiKey ? 'API Key fehlt' : undefined}
            className="font-mono"
            onClick={() => void runContentAi()}
            style={{
              fontSize: 10,
              padding: '6px 12px',
              borderRadius: 8,
              border: '1px solid var(--accent-teal)',
              background: hasAiKey
                ? 'color-mix(in srgb, var(--accent-teal) 12%, transparent)'
                : 'var(--glass-3)',
              color: hasAiKey ? 'var(--accent-teal)' : 'var(--text-tertiary)',
              opacity: !hasAiKey || aiBusy ? 0.55 : 1,
              cursor: !hasAiKey || aiBusy ? 'not-allowed' : 'pointer',
            }}
          >
            {aiBusy ? 'KI denkt…' : 'KI generieren'}
          </button>
        </div>
        <input
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value)
            debouncedTitle(e.target.value)
          }}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 10,
            background: 'var(--glass-1)',
            border: '1px solid var(--glass-border-1)',
            color: 'var(--text-primary)',
            fontSize: 14,
          }}
        />
      </div>

      <div>
        <label
          className="font-mono mb-1 block"
          style={{
            fontSize: 11,
            letterSpacing: '0.06em',
            color: 'var(--text-tertiary)',
          }}
        >
          Inhalt
        </label>
        {editor ? (
          <div
            className="mb-2 flex flex-wrap gap-1"
            style={{ pointerEvents: 'auto' }}
          >
            <button
              type="button"
              style={{
                ...BTN,
                fontWeight: editor.isActive('bold') ? 700 : 400,
              }}
              onClick={() => editor.chain().focus().toggleBold().run()}
            >
              Bold
            </button>
            <button
              type="button"
              style={{
                ...BTN,
                fontStyle: editor.isActive('italic') ? 'italic' : 'normal',
              }}
              onClick={() => editor.chain().focus().toggleItalic().run()}
            >
              Italic
            </button>
            <button
              type="button"
              style={{
                ...BTN,
                borderColor: editor.isActive('bulletList')
                  ? 'var(--mode-promo)'
                  : BTN.border,
              }}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
            >
              Liste
            </button>
            <button
              type="button"
              style={{
                ...BTN,
                borderColor: editor.isActive('orderedList')
                  ? 'var(--mode-promo)'
                  : BTN.border,
              }}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
            >
              Nummeriert
            </button>
          </div>
        ) : null}
        <div
          style={{
            borderRadius: 12,
            border: '1px solid var(--glass-border-1)',
            background: 'var(--glass-1)',
          }}
        >
          <EditorContent editor={editor} style={EDITOR_STYLE} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <span
            className="font-mono mb-1 block"
            style={{ fontSize: 10, color: 'var(--text-tertiary)' }}
          >
            Format
          </span>
          <select
            value={piece.tags.format}
            onChange={(e) =>
              onPatch({
                tags: {
                  ...piece.tags,
                  format: e.target.value as ContentFormat,
                },
              })
            }
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: 10,
              background: 'var(--glass-1)',
              border: '1px solid var(--glass-border-1)',
              color: 'var(--text-primary)',
              fontSize: 12,
            }}
          >
            {FORMAT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <span
            className="font-mono mb-1 block"
            style={{ fontSize: 10, color: 'var(--text-tertiary)' }}
          >
            Kanal
          </span>
          <select
            value={piece.tags.channel}
            onChange={(e) =>
              onPatch({
                tags: {
                  ...piece.tags,
                  channel: e.target.value as ContentChannel,
                },
              })
            }
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: 10,
              background: 'var(--glass-1)',
              border: '1px solid var(--glass-border-1)',
              color: 'var(--text-primary)',
              fontSize: 12,
            }}
          >
            {CHANNEL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <span
            className="font-mono mb-1 block"
            style={{ fontSize: 10, color: 'var(--text-tertiary)' }}
          >
            Ziel
          </span>
          <select
            value={piece.tags.goal}
            onChange={(e) =>
              onPatch({
                tags: {
                  ...piece.tags,
                  goal: e.target.value as ContentGoal,
                },
              })
            }
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: 10,
              background: 'var(--glass-1)',
              border: '1px solid var(--glass-border-1)',
              color: 'var(--text-primary)',
              fontSize: 12,
            }}
          >
            {GOAL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label
          className="font-mono mb-1 block"
          style={{
            fontSize: 11,
            letterSpacing: '0.06em',
            color: 'var(--text-tertiary)',
          }}
        >
          Geplant am (scheduled_at)
        </label>
        <input
          type="date"
          value={piece.scheduled_at.slice(0, 10)}
          onChange={(e) => onPatch({ scheduled_at: e.target.value })}
          style={{
            width: '100%',
            maxWidth: 220,
            padding: '10px 12px',
            borderRadius: 10,
            background: 'var(--glass-1)',
            border: '1px solid var(--glass-border-1)',
            color: 'var(--text-primary)',
            fontSize: 13,
          }}
        />
      </div>

      <div>
        <label
          className="font-mono mb-1 block"
          style={{
            fontSize: 11,
            letterSpacing: '0.06em',
            color: 'var(--text-tertiary)',
          }}
        >
          Kampagne
        </label>
        <select
          value={piece.campaign_id ?? ''}
          onChange={(e) =>
            onPatch({
              campaign_id: e.target.value === '' ? null : e.target.value,
            })
          }
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 10,
            background: 'var(--glass-1)',
            border: '1px solid var(--glass-border-1)',
            color: 'var(--text-primary)',
            fontSize: 13,
          }}
        >
          <option value="">— keine —</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div
        className="glass-2"
        style={{
          borderRadius: 12,
          padding: 14,
          border: '1px solid var(--glass-border-1)',
        }}
      >
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span
            className="font-mono"
            style={{
              fontSize: 10,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--mode-promo)',
            }}
          >
            Auto-Tagging &amp; Foundation
          </span>
          <button
            type="button"
            className="font-mono"
            style={{
              fontSize: 11,
              padding: '6px 12px',
              borderRadius: 999,
              border: '1px solid var(--glass-border-2)',
              background: 'var(--glass-3)',
              color: 'var(--mode-promo)',
            }}
            onClick={applyAutoTag}
          >
            Auto-Tag aus Text
          </button>
        </div>
        <div className="mt-3">
          <span
            className="font-mono mb-1 block"
            style={{ fontSize: 10, color: 'var(--text-tertiary)' }}
          >
            ICPs (useICPs)
          </span>
          <div className="flex max-h-28 flex-col gap-1 overflow-y-auto">
            {icps.length === 0 ? (
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                Keine ICPs in Building.
              </span>
            ) : (
              icps.map((icp) => (
                <label
                  key={icp.id}
                  className="flex cursor-pointer items-center gap-2"
                  style={{ fontSize: 13, color: 'var(--text-secondary)' }}
                >
                  <input
                    type="checkbox"
                    checked={piece.tags.icp_ids.includes(icp.id)}
                    onChange={() => toggleIcp(icp.id)}
                  />
                  {icp.name}
                </label>
              ))
            )}
          </div>
        </div>
        <div className="mt-3">
          <span
            className="font-mono mb-1 block"
            style={{ fontSize: 10, color: 'var(--text-tertiary)' }}
          >
            Word-Bank-Cluster (useWordBank)
          </span>
          <div className="flex flex-wrap gap-1.5">
            {clusterChoices.length === 0 ? (
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                Keine Cluster in der Word Bank.
              </span>
            ) : (
              clusterChoices.map((c) => {
                const active = piece.tags.cluster_tags.includes(c)
                return (
                  <button
                    key={c}
                    type="button"
                    className="font-mono"
                    style={{
                      fontSize: 10,
                      padding: '6px 10px',
                      borderRadius: 999,
                      border: active
                        ? '1px solid var(--mode-promo)'
                        : '1px solid var(--glass-border-2)',
                      background: active ? 'var(--glass-3)' : 'var(--glass-1)',
                      color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                    }}
                    onClick={() => toggleCluster(c)}
                  >
                    {c}
                  </button>
                )
              })
            )}
          </div>
        </div>
      </div>

      <div
        className="glass-2"
        style={{
          borderRadius: 12,
          padding: 14,
          border: '1px solid var(--glass-border-1)',
        }}
      >
        <span
          className="font-mono mb-3 block"
          style={{
            fontSize: 10,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--text-tertiary)',
          }}
        >
          Performance (manuell, debounced Autosave)
        </span>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div>
            <span
              className="font-mono mb-1 block"
              style={{ fontSize: 9, color: 'var(--text-tertiary)' }}
            >
              Impressionen
            </span>
            <input
              type="number"
              min={0}
              value={imp}
              onChange={(e) => {
                const v = e.target.value
                setImp(v)
                debouncedPerf({
                  impressions: v === '' ? null : Number(v),
                })
              }}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 10,
                background: 'var(--glass-1)',
                border: '1px solid var(--glass-border-1)',
                color: 'var(--text-primary)',
                fontSize: 12,
              }}
            />
          </div>
          <div>
            <span
              className="font-mono mb-1 block"
              style={{ fontSize: 9, color: 'var(--text-tertiary)' }}
            >
              Klicks
            </span>
            <input
              type="number"
              min={0}
              value={clk}
              onChange={(e) => {
                const v = e.target.value
                setClk(v)
                debouncedPerf({
                  engagements: v === '' ? null : Number(v),
                })
              }}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 10,
                background: 'var(--glass-1)',
                border: '1px solid var(--glass-border-1)',
                color: 'var(--text-primary)',
                fontSize: 12,
              }}
            />
          </div>
          <div>
            <span
              className="font-mono mb-1 block"
              style={{ fontSize: 9, color: 'var(--text-tertiary)' }}
            >
              Leads
            </span>
            <input
              type="number"
              min={0}
              value={leadsIn}
              onChange={(e) => {
                const v = e.target.value
                setLeadsIn(v)
                debouncedPerf({
                  leads: v === '' ? null : Number(v),
                })
              }}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 10,
                background: 'var(--glass-1)',
                border: '1px solid var(--glass-border-1)',
                color: 'var(--text-primary)',
                fontSize: 12,
              }}
            />
          </div>
          <div>
            <span
              className="font-mono mb-1 block"
              style={{ fontSize: 9, color: 'var(--text-tertiary)' }}
            >
              Conversions
            </span>
            <input
              type="number"
              min={0}
              value={convIn}
              onChange={(e) => {
                const v = e.target.value
                setConvIn(v)
                debouncedConversions(v === '' ? null : Number(v))
              }}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: 10,
                background: 'var(--glass-1)',
                border: '1px solid var(--glass-border-1)',
                color: 'var(--text-primary)',
                fontSize: 12,
              }}
            />
          </div>
        </div>
        <label
          className="font-mono mb-1 mt-3 block"
          style={{ fontSize: 10, color: 'var(--text-tertiary)' }}
        >
          Notizen
        </label>
        <textarea
          value={notesLocal}
          onChange={(e) => {
            const v = e.target.value
            setNotesLocal(v)
            debouncedPerf({ notes: v })
          }}
          rows={3}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 10,
            background: 'var(--glass-1)',
            border: '1px solid var(--glass-border-1)',
            color: 'var(--text-primary)',
            fontSize: 13,
            resize: 'vertical',
          }}
        />
      </div>

      <button
        type="button"
        className="font-mono"
        style={{
          alignSelf: 'flex-start',
          fontSize: 11,
          padding: '8px 14px',
          borderRadius: 10,
          border: '1px solid var(--accent-coral)',
          color: 'var(--accent-coral)',
        }}
        onClick={onDelete}
      >
        Piece löschen
      </button>
    </div>
  )
}
