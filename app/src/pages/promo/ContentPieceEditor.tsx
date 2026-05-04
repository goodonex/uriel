import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect, useState } from 'react'
import { useDebouncedCallback } from '../../hooks/useDebouncedCallback'
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

const LABEL: Record<string, string> = {
  post: 'Post',
  reel: 'Reel',
  story: 'Story',
  article: 'Artikel',
  email: 'E-Mail',
  carousel: 'Karussell',
  other: 'Sonstiges',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  website: 'Website',
  tiktok: 'TikTok',
  awareness: 'Awareness',
  leads: 'Leads',
  nurture: 'Nurture',
  sales: 'Sales',
}

export function ContentPieceEditor({
  piece,
  campaigns,
  icps,
  wordBank,
  onPatch,
  onDelete,
  onAutoTagged,
}: ContentPieceEditorProps) {
  const [title, setTitle] = useState(piece.title)

  useEffect(() => {
    setTitle(piece.title)
  }, [piece.id, piece.title])

  const debouncedTitle = useDebouncedCallback((v: string) =>
    onPatch({ title: v }),
  )
  const debouncedContent = useDebouncedCallback((doc: Record<string, unknown>) =>
    onPatch({ content: doc }),
  )

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

  const toggleIcp = (id: string) => {
    const set = new Set(piece.tags.icp_ids)
    if (set.has(id)) set.delete(id)
    else set.add(id)
    onPatch({ tags: { ...piece.tags, icp_ids: [...set] } })
  }

  const applyAutoTag = () => {
    const sug = suggestContentTags(icps, wordBank, title, piece.content)
    onPatch({
      tags: mergeTagsIntoPieceTags(piece.tags, sug),
    })
    onAutoTagged?.()
  }

  const syncMockInstagram = () => {
    onPatch({
      performance_api: {
        ...piece.performance_api,
        instagram_last_sync_at: new Date().toISOString(),
        instagram_metrics_json: {
          mock: true,
          reach: Math.floor(Math.random() * 5000),
          saves: Math.floor(Math.random() * 120),
        },
      },
    })
  }

  const syncMockLinkedIn = () => {
    onPatch({
      performance_api: {
        ...piece.performance_api,
        linkedin_last_sync_at: new Date().toISOString(),
        linkedin_metrics_json: {
          mock: true,
          impressions: Math.floor(Math.random() * 8000),
          clicks: Math.floor(Math.random() * 200),
        },
      },
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label
          className="font-mono mb-1 block"
          style={{
            fontSize: 11,
            letterSpacing: '0.06em',
            color: 'var(--text-tertiary)',
          }}
        >
          Titel
        </label>
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label
            className="font-mono mb-1 block"
            style={{
              fontSize: 11,
              letterSpacing: '0.06em',
              color: 'var(--text-tertiary)',
            }}
          >
            Geplant am
          </label>
          <input
            type="date"
            value={piece.scheduled_at.slice(0, 10)}
            onChange={(e) => onPatch({ scheduled_at: e.target.value })}
            style={{
              width: '100%',
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
            Veröffentlicht
          </label>
          <input
            type="datetime-local"
            value={
              piece.published_at
                ? piece.published_at.slice(0, 16)
                : ''
            }
            onChange={(e) =>
              onPatch({
                published_at: e.target.value
                  ? new Date(e.target.value).toISOString()
                  : null,
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
          />
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
            Tags (Foundation)
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
              {(
                [
                  'post',
                  'reel',
                  'story',
                  'article',
                  'email',
                  'carousel',
                  'other',
                ] as ContentFormat[]
              ).map((k) => (
                <option key={k} value={k}>
                  {LABEL[k]}
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
              {(
                [
                  'instagram',
                  'linkedin',
                  'website',
                  'email',
                  'tiktok',
                  'other',
                ] as ContentChannel[]
              ).map((k) => (
                <option key={k} value={k}>
                  {LABEL[k]}
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
              {(
                ['awareness', 'leads', 'nurture', 'sales', 'other'] as ContentGoal[]
              ).map((k) => (
                <option key={k} value={k}>
                  {LABEL[k]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-3">
          <span
            className="font-mono mb-1 block"
            style={{ fontSize: 10, color: 'var(--text-tertiary)' }}
          >
            ICPs
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
            Cluster-Tags
          </span>
          <div className="flex flex-wrap gap-1">
            {piece.tags.cluster_tags.map((t) => (
              <button
                key={t}
                type="button"
                className="font-mono"
                style={{
                  fontSize: 10,
                  padding: '4px 8px',
                  borderRadius: 999,
                  border: '1px solid var(--glass-border-2)',
                  background: 'var(--glass-1)',
                  color: 'var(--text-secondary)',
                }}
                onClick={() =>
                  onPatch({
                    tags: {
                      ...piece.tags,
                      cluster_tags: piece.tags.cluster_tags.filter((x) => x !== t),
                    },
                  })
                }
              >
                {t} ✕
              </button>
            ))}
          </div>
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
          Inhalt
        </label>
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
          Performance (manuell)
        </span>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ['impressions', 'Impressions'],
              ['engagements', 'Engagements'],
              ['leads', 'Leads'],
            ] as const
          ).map(([key, lab]) => (
            <div key={key}>
              <span
                className="font-mono mb-1 block"
                style={{ fontSize: 9, color: 'var(--text-tertiary)' }}
              >
                {lab}
              </span>
              <input
                type="number"
                min={0}
                value={piece.performance_manual[key] ?? ''}
                onChange={(e) => {
                  const v = e.target.value
                  onPatch({
                    performance_manual: {
                      ...piece.performance_manual,
                      [key]: v === '' ? null : Number(v),
                      updated_at: new Date().toISOString(),
                    },
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
          ))}
        </div>
        <label
          className="font-mono mb-1 mt-3 block"
          style={{ fontSize: 10, color: 'var(--text-tertiary)' }}
        >
          Notizen
        </label>
        <textarea
          value={piece.performance_manual.notes}
          onChange={(e) =>
            onPatch({
              performance_manual: {
                ...piece.performance_manual,
                notes: e.target.value,
                updated_at: new Date().toISOString(),
              },
            })
          }
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

      <div
        className="glass-2"
        style={{
          borderRadius: 12,
          padding: 14,
          border: '1px solid var(--glass-border-1)',
        }}
      >
        <span
          className="font-mono mb-2 block"
          style={{
            fontSize: 10,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--text-tertiary)',
          }}
        >
          API-Anbindung (Phase 4 Scope — noch Mock)
        </span>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>
          Instagram Graph &amp; LinkedIn Analytics: echte OAuth-Flows folgen mit
          Backend. Hier nur Platzhalter-Sync für UI-Demos.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="font-mono"
            style={{
              fontSize: 11,
              padding: '8px 12px',
              borderRadius: 10,
              border: '1px solid var(--glass-border-2)',
              background: 'var(--glass-3)',
              color: 'var(--text-secondary)',
            }}
            onClick={syncMockInstagram}
          >
            Mock: Instagram Sync
          </button>
          <button
            type="button"
            className="font-mono"
            style={{
              fontSize: 11,
              padding: '8px 12px',
              borderRadius: 10,
              border: '1px solid var(--glass-border-2)',
              background: 'var(--glass-3)',
              color: 'var(--text-secondary)',
            }}
            onClick={syncMockLinkedIn}
          >
            Mock: LinkedIn Sync
          </button>
        </div>
        <div
          className="font-mono mt-3"
          style={{ fontSize: 10, color: 'var(--text-tertiary)' }}
        >
          IG letzter Sync:{' '}
          {piece.performance_api.instagram_last_sync_at
            ? new Date(piece.performance_api.instagram_last_sync_at).toLocaleString(
                'de-DE',
              )
            : '—'}
          <br />
          LI letzter Sync:{' '}
          {piece.performance_api.linkedin_last_sync_at
            ? new Date(piece.performance_api.linkedin_last_sync_at).toLocaleString(
                'de-DE',
              )
            : '—'}
        </div>
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
