import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useUiTheme } from '../../hooks/useUiTheme'
import type { NebulaNode } from '../graph/nebulaLayout'
import { getLayerColors } from '../graph/nebulaLayout'
import { fetchOsFile, openInObsidian } from '../lib/runnerApi'

/**
 * Detail-Panel für den Nebula-Graph: jeder Node ist klickbar.
 * Skills/Notizen zeigen ihren Datei-Inhalt (read-only via /os/file), Notizen
 * zusätzlich "In Obsidian öffnen". Apps/Routinen/Hubs zeigen Beschreibung.
 */
export function OsDetailPanel({ node, onClose }: { node: NebulaNode; onClose: () => void }) {
  const [content, setContent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { isPlainLight } = useUiTheme()

  const showsFile = (node.kind === 'skill' || node.kind === 'note') && !!node.path

  useEffect(() => {
    setContent(null)
    setError(null)
    if (!showsFile || !node.path) return
    setLoading(true)
    fetchOsFile(node.path)
      .then((f) => setContent(f.content))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [node.path, node.kind, showsFile])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const layerName =
    node.kind === 'hub'
      ? `Bereich · ${node.count ?? ''} Objekte`
      : node.layer === 'skills'
        ? node.source === 'vault'
          ? 'Skill · Vault'
          : 'Skill · Global'
        : node.layer === 'memory'
          ? `Memory · ${node.area ?? 'Vault'}`
          : node.layer === 'routines'
            ? 'Routine'
            : node.layer === 'apps'
              ? `App · ${node.status ?? ''}`
              : node.layer === 'sales' || node.layer === 'loom' || node.layer === 'kalt'
                ? 'Lead-Pipeline'
                : node.layer === 'paused'
                  ? 'Lead · pausiert'
                  : 'Kern'

  return (
    <div
      role="dialog"
      aria-label={`Detail ${node.label}`}
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: 'min(560px, 92vw)',
        background: 'var(--ck-panel)',
        borderLeft: '1px solid var(--ck-border-strong)',
        zIndex: 55,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '12px 16px',
          borderBottom: '1px solid var(--ck-border)',
        }}
      >
        <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              width: 9,
              height: 9,
              borderRadius: '50%',
              background: getLayerColors(isPlainLight)[node.layer],
              flexShrink: 0,
            }}
          />
          <div style={{ minWidth: 0 }}>
            <div className="ck-label">{layerName}</div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {node.label}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          {node.kind === 'note' && node.path ? (
            <button className="ck-btn" onClick={() => openInObsidian(node.path!)}>
              In Obsidian öffnen
            </button>
          ) : null}
          <button className="ck-btn" onClick={onClose} aria-label="Schließen">
            ✕
          </button>
        </div>
      </div>

      <div
        className="ck-md"
        style={{ flex: 1, overflowY: 'auto', padding: '14px 18px', fontSize: 13, lineHeight: 1.65 }}
      >
        {node.sub && !showsFile ? (
          <p style={{ color: 'var(--ck-text-2)' }}>{node.sub}</p>
        ) : null}
        {showsFile ? (
          error ? (
            <p style={{ color: 'var(--ck-warn)' }}>{error}</p>
          ) : loading ? (
            <p style={{ color: 'var(--ck-text-3)' }}>Lade…</p>
          ) : content != null ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          ) : null
        ) : null}
      </div>
    </div>
  )
}
