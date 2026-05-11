/**
 * Whiteboard-Canvas für E-Mail-Sequenzen.
 *
 * - Grid-Hintergrund
 * - Drag-bare Nodes (absolut positioniert)
 * - SVG-Layer für Pfeil-Verbindungen
 * - Node-Inspector rechts (Konfiguration)
 * - Node-Palette links (Neue Nodes hinzufügen)
 *
 * Datenfluss:
 * onChange(nodes) wird bei jeder Mutation aufgerufen — Parent (Page) entscheidet
 * über Persistierung (debounced via useEmailSequences.update).
 */
import { motion } from 'framer-motion'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import type { SalesEmailTemplate, SequenceNode, SequenceNodeType } from '../../types/db'

interface SequenceBuilderCanvasProps {
  nodes: SequenceNode[]
  templates: SalesEmailTemplate[]
  onChange: (nodes: SequenceNode[]) => void
  /** Render-Höhe (optional). Default: 100% */
  height?: number | string
}

interface NodeMeta {
  label: string
  accent: string
  icon: string
  hint: string
}

const NODE_META: Record<SequenceNodeType, NodeMeta> = {
  start: {
    label: 'Start',
    accent: 'var(--accent-teal)',
    icon: '▶',
    hint: 'Einstieg in die Sequenz',
  },
  wait: {
    label: 'Warten',
    accent: 'var(--text-tertiary)',
    icon: '⏱',
    hint: 'Zeit verstreichen lassen',
  },
  email: {
    label: 'E-Mail senden',
    accent: 'var(--accent-blue)',
    icon: '✉',
    hint: 'Resend versendet automatisch',
  },
  condition: {
    label: 'Bedingung',
    accent: 'var(--mode-sales)',
    icon: '?',
    hint: 'Verzweigung nach Verhalten',
  },
  end: {
    label: 'Ende',
    accent: 'var(--accent-coral)',
    icon: '■',
    hint: 'Sequenz beendet',
  },
}

const NODE_W = 220
const NODE_H_DEFAULT = 96
const NODE_H_EMAIL = 132
const NODE_H_CONDITION = 132

function getNodeHeight(t: SequenceNodeType): number {
  if (t === 'email') return NODE_H_EMAIL
  if (t === 'condition') return NODE_H_CONDITION
  return NODE_H_DEFAULT
}

interface DragState {
  nodeId: string
  pointerStart: { x: number; y: number }
  nodeStart: { x: number; y: number }
}

interface ConnectState {
  fromNodeId: string
  anchor: 'next' | 'next_no'
  cursor: { x: number; y: number }
}

export function SequenceBuilderCanvas({
  nodes,
  templates,
  onChange,
  height = '100%',
}: SequenceBuilderCanvasProps) {
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [connect, setConnect] = useState<ConnectState | null>(null)

  const selected = useMemo(
    () => nodes.find((n) => n.id === selectedId) ?? null,
    [nodes, selectedId],
  )

  // ============================================================
  // Drag-Handling
  // ============================================================

  const onNodeMouseDown = useCallback(
    (n: SequenceNode, e: ReactMouseEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest('[data-no-drag]')) return
      e.preventDefault()
      setSelectedId(n.id)
      setDrag({
        nodeId: n.id,
        pointerStart: { x: e.clientX, y: e.clientY },
        nodeStart: { ...n.position },
      })
    },
    [],
  )

  useEffect(() => {
    if (!drag && !connect) return
    const onMove = (e: MouseEvent) => {
      if (drag) {
        const dx = e.clientX - drag.pointerStart.x
        const dy = e.clientY - drag.pointerStart.y
        const next = nodes.map((n) =>
          n.id === drag.nodeId
            ? { ...n, position: { x: drag.nodeStart.x + dx, y: drag.nodeStart.y + dy } }
            : n,
        )
        onChange(next)
      } else if (connect && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect()
        setConnect((c) =>
          c ? { ...c, cursor: { x: e.clientX - rect.left, y: e.clientY - rect.top } } : c,
        )
      }
    }
    const onUp = () => {
      setDrag(null)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [drag, connect, nodes, onChange])

  // ============================================================
  // Connect-Handling (Anchor → Ziel-Node)
  // ============================================================

  const startConnect = (nodeId: string, anchor: 'next' | 'next_no', e: ReactMouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (!canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    setConnect({
      fromNodeId: nodeId,
      anchor,
      cursor: { x: e.clientX - rect.left, y: e.clientY - rect.top },
    })
  }

  const finishConnect = (targetNodeId: string) => {
    if (!connect) return
    if (connect.fromNodeId === targetNodeId) {
      setConnect(null)
      return
    }
    const next = nodes.map((n) =>
      n.id === connect.fromNodeId ? { ...n, [connect.anchor]: targetNodeId } : n,
    )
    onChange(next)
    setConnect(null)
  }

  const onCanvasClick = () => {
    setConnect(null)
    setSelectedId(null)
  }

  // ============================================================
  // Node-CRUD
  // ============================================================

  const addNode = (type: SequenceNodeType) => {
    const id = `n_${Math.random().toString(36).slice(2, 10)}`
    const rect = canvasRef.current?.getBoundingClientRect()
    const offset = nodes.length * 30
    const position = rect
      ? { x: rect.width / 2 - NODE_W / 2 - rect.left + offset, y: 150 + offset }
      : { x: 280 + offset, y: 150 + offset }
    const config: SequenceNode['config'] =
      type === 'wait'
        ? { delay_days: 1, delay_hours: 0 }
        : type === 'email'
          ? { subject: 'Hallo {{first_name}}', body: 'Schön, dass wir reden …' }
          : type === 'condition'
            ? { check: 'opened', within_days: 3 }
            : {}
    onChange([
      ...nodes,
      { id, type, position, config, next: null, next_no: null },
    ])
    setSelectedId(id)
  }

  const updateNode = (id: string, patch: Partial<SequenceNode>) => {
    onChange(nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)))
  }

  const updateConfig = (id: string, patch: Partial<SequenceNode['config']>) => {
    onChange(
      nodes.map((n) => (n.id === id ? { ...n, config: { ...n.config, ...patch } } : n)),
    )
  }

  const removeNode = (id: string) => {
    // Auch eingehende Verbindungen löschen
    const next = nodes
      .filter((n) => n.id !== id)
      .map((n) => ({
        ...n,
        next: n.next === id ? null : n.next,
        next_no: n.next_no === id ? null : n.next_no,
      }))
    onChange(next)
    if (selectedId === id) setSelectedId(null)
  }

  const removeEdge = (fromId: string, anchor: 'next' | 'next_no') => {
    updateNode(fromId, { [anchor]: null })
  }

  // ============================================================
  // Geometrie für Pfeile
  // ============================================================

  function anchorPoint(n: SequenceNode, anchor: 'in' | 'next' | 'next_no') {
    const h = getNodeHeight(n.type)
    if (anchor === 'in') {
      return { x: n.position.x + NODE_W / 2, y: n.position.y }
    }
    if (n.type === 'condition') {
      // condition hat zwei Output-Anker (links für JA, rechts für NEIN)
      return anchor === 'next'
        ? { x: n.position.x + NODE_W * 0.3, y: n.position.y + h }
        : { x: n.position.x + NODE_W * 0.7, y: n.position.y + h }
    }
    return { x: n.position.x + NODE_W / 2, y: n.position.y + h }
  }

  const edges = useMemo(() => {
    const list: Array<{
      from: { x: number; y: number }
      to: { x: number; y: number }
      kind: 'yes' | 'no' | 'normal'
      fromId: string
      anchor: 'next' | 'next_no'
    }> = []
    for (const n of nodes) {
      if (n.next) {
        const target = nodes.find((m) => m.id === n.next)
        if (target) {
          list.push({
            from: anchorPoint(n, 'next'),
            to: anchorPoint(target, 'in'),
            kind: n.type === 'condition' ? 'yes' : 'normal',
            fromId: n.id,
            anchor: 'next',
          })
        }
      }
      if (n.next_no && n.type === 'condition') {
        const target = nodes.find((m) => m.id === n.next_no)
        if (target) {
          list.push({
            from: anchorPoint(n, 'next_no'),
            to: anchorPoint(target, 'in'),
            kind: 'no',
            fromId: n.id,
            anchor: 'next_no',
          })
        }
      }
    }
    return list
  }, [nodes])

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '64px 1fr 320px',
        gap: 0,
        height,
        background: 'var(--bg-deep)',
        borderRadius: 14,
        overflow: 'hidden',
        border: '1px solid var(--glass-border-1)',
      }}
    >
      <NodePalette onAdd={addNode} />

      {/* Canvas */}
      <div
        ref={canvasRef}
        onClick={onCanvasClick}
        style={{
          position: 'relative',
          overflow: 'auto',
          background: `
            radial-gradient(circle at center, color-mix(in srgb, var(--mode-promo) 4%, transparent) 0%, transparent 70%),
            linear-gradient(var(--glass-border-1) 1px, transparent 1px) 0 0 / 30px 30px,
            linear-gradient(90deg, var(--glass-border-1) 1px, transparent 1px) 0 0 / 30px 30px,
            radial-gradient(ellipse at top, color-mix(in srgb, var(--bg-deep) 60%, #000) 0%, var(--bg-deep) 70%)
          `,
          minHeight: 600,
        }}
      >
        {/* SVG-Layer für Verbindungen */}
        <svg
          width="100%"
          height="100%"
          style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
        >
          <defs>
            <marker
              id="arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M0 0 L10 5 L0 10 z" fill="var(--text-secondary)" />
            </marker>
            <marker
              id="arrow-yes"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M0 0 L10 5 L0 10 z" fill="var(--accent-teal)" />
            </marker>
            <marker
              id="arrow-no"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M0 0 L10 5 L0 10 z" fill="var(--accent-coral)" />
            </marker>
          </defs>
          {edges.map((e, idx) => {
            const color =
              e.kind === 'yes'
                ? 'var(--accent-teal)'
                : e.kind === 'no'
                  ? 'var(--accent-coral)'
                  : 'var(--text-secondary)'
            const markerId =
              e.kind === 'yes' ? 'arrow-yes' : e.kind === 'no' ? 'arrow-no' : 'arrow'
            const d = bezierPath(e.from, e.to)
            return (
              <g key={`edge-${idx}`}>
                <path
                  d={d}
                  fill="none"
                  stroke={color}
                  strokeWidth={1.8}
                  markerEnd={`url(#${markerId})`}
                  opacity={0.85}
                />
                {/* Doppel-Klick auf Linie → Edge löschen */}
                <path
                  d={d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={12}
                  style={{ pointerEvents: 'all', cursor: 'pointer' }}
                  onDoubleClick={(ev) => {
                    ev.stopPropagation()
                    removeEdge(e.fromId, e.anchor)
                  }}
                />
                {e.kind !== 'normal' ? (
                  <text
                    x={(e.from.x + e.to.x) / 2}
                    y={(e.from.y + e.to.y) / 2 - 8}
                    fill={color}
                    fontSize={10}
                    fontFamily="ui-monospace, monospace"
                    textAnchor="middle"
                  >
                    {e.kind === 'yes' ? 'JA' : 'NEIN'}
                  </text>
                ) : null}
              </g>
            )
          })}

          {/* Aktive Connect-Linie zum Cursor */}
          {connect ? (
            <ConnectingLine
              from={anchorPoint(
                nodes.find((n) => n.id === connect.fromNodeId)!,
                connect.anchor,
              )}
              to={connect.cursor}
              kind={
                nodes.find((n) => n.id === connect.fromNodeId)?.type === 'condition'
                  ? connect.anchor === 'next'
                    ? 'yes'
                    : 'no'
                  : 'normal'
              }
            />
          ) : null}
        </svg>

        {/* Nodes */}
        {nodes.map((n) => (
          <NodeCard
            key={n.id}
            node={n}
            selected={selectedId === n.id}
            onSelect={() => setSelectedId(n.id)}
            onMouseDownDrag={(e) => onNodeMouseDown(n, e)}
            onClickAnchorIn={() => {
              if (connect) finishConnect(n.id)
            }}
            onStartConnect={(anchor, e) => startConnect(n.id, anchor, e)}
            onRemove={() => removeNode(n.id)}
            templates={templates}
          />
        ))}
      </div>

      <NodeInspector
        node={selected}
        templates={templates}
        onUpdate={(patch) => selected && updateNode(selected.id, patch)}
        onUpdateConfig={(patch) => selected && updateConfig(selected.id, patch)}
        onRemove={() => selected && removeNode(selected.id)}
      />
    </div>
  )
}

// ============================================================
// Pfad-Helper
// ============================================================

function bezierPath(
  from: { x: number; y: number },
  to: { x: number; y: number },
): string {
  const dy = to.y - from.y
  const c1y = from.y + Math.abs(dy) * 0.4 + 30
  const c2y = to.y - Math.abs(dy) * 0.4 - 30
  return `M ${from.x},${from.y} C ${from.x},${c1y} ${to.x},${c2y} ${to.x},${to.y}`
}

function ConnectingLine({
  from,
  to,
  kind,
}: {
  from: { x: number; y: number }
  to: { x: number; y: number }
  kind: 'normal' | 'yes' | 'no'
}) {
  const color =
    kind === 'yes'
      ? 'var(--accent-teal)'
      : kind === 'no'
        ? 'var(--accent-coral)'
        : 'var(--text-secondary)'
  return (
    <path
      d={bezierPath(from, to)}
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeDasharray="5 4"
      opacity={0.7}
    />
  )
}

// ============================================================
// NodePalette
// ============================================================

function NodePalette({ onAdd }: { onAdd: (t: SequenceNodeType) => void }) {
  const ITEMS: SequenceNodeType[] = ['wait', 'email', 'condition', 'end']
  return (
    <aside
      style={{
        background: 'var(--glass-1)',
        borderRight: '1px solid var(--glass-border-1)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '12px 0',
        gap: 8,
      }}
    >
      <div
        className="font-mono"
        style={{
          fontSize: 9,
          color: 'var(--text-tertiary)',
          letterSpacing: '0.14em',
          writingMode: 'vertical-rl',
          transform: 'rotate(180deg)',
          marginBottom: 12,
        }}
      >
        BAUSTEINE
      </div>
      {ITEMS.map((t) => {
        const meta = NODE_META[t]
        return (
          <button
            key={t}
            type="button"
            onClick={() => onAdd(t)}
            title={`${meta.label} — ${meta.hint}`}
            className="font-mono"
            style={{
              width: 46,
              height: 46,
              borderRadius: 10,
              border: `1px solid ${meta.accent}`,
              background: `color-mix(in srgb, ${meta.accent} 12%, var(--glass-2))`,
              color: meta.accent,
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
              fontSize: 16,
              fontFamily: 'system-ui',
            }}
          >
            {meta.icon}
          </button>
        )
      })}
    </aside>
  )
}

// ============================================================
// NodeCard
// ============================================================

function NodeCard({
  node,
  selected,
  onSelect,
  onMouseDownDrag,
  onClickAnchorIn,
  onStartConnect,
  onRemove,
  templates,
}: {
  node: SequenceNode
  selected: boolean
  onSelect: () => void
  onMouseDownDrag: (e: ReactMouseEvent<HTMLDivElement>) => void
  onClickAnchorIn: () => void
  onStartConnect: (anchor: 'next' | 'next_no', e: ReactMouseEvent) => void
  onRemove: () => void
  templates: SalesEmailTemplate[]
}) {
  const meta = NODE_META[node.type]
  const h = getNodeHeight(node.type)

  return (
    <motion.div
      onMouseDown={onMouseDownDrag}
      onClick={(e) => {
        e.stopPropagation()
        onSelect()
      }}
      style={{
        position: 'absolute',
        left: node.position.x,
        top: node.position.y,
        width: NODE_W,
        height: h,
        background: selected
          ? `color-mix(in srgb, ${meta.accent} 18%, var(--glass-1))`
          : 'var(--glass-1)',
        border: selected
          ? `1.5px solid ${meta.accent}`
          : '1px solid var(--glass-border-1)',
        borderRadius: 12,
        cursor: 'grab',
        boxShadow: selected
          ? `0 8px 32px color-mix(in srgb, ${meta.accent} 26%, transparent)`
          : '0 4px 14px rgba(0,0,0,0.18)',
        userSelect: 'none',
        overflow: 'hidden',
      }}
      whileHover={{ y: -1 }}
    >
      {/* In-Anchor (oben) */}
      {node.type !== 'start' ? (
        <Anchor
          x={NODE_W / 2}
          y={0}
          color={meta.accent}
          onClick={(e) => {
            e.stopPropagation()
            onClickAnchorIn()
          }}
          tooltip="Hier verbinden"
        />
      ) : null}

      {/* Header */}
      <header
        style={{
          padding: '8px 12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid var(--glass-border-2)',
          background: `color-mix(in srgb, ${meta.accent} 8%, transparent)`,
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            color: meta.accent,
            fontSize: 11,
            fontFamily: 'ui-monospace, monospace',
            letterSpacing: '0.08em',
            fontWeight: 600,
          }}
        >
          <span style={{ fontSize: 13, fontFamily: 'system-ui' }}>{meta.icon}</span>
          {meta.label.toUpperCase()}
        </span>
        {node.type !== 'start' ? (
          <button
            data-no-drag
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onRemove()
            }}
            title="Node löschen"
            className="font-mono"
            style={{
              padding: 0,
              width: 18,
              height: 18,
              border: 'none',
              background: 'transparent',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
              fontSize: 12,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        ) : null}
      </header>

      {/* Body */}
      <div style={{ padding: '8px 12px', fontSize: 11, color: 'var(--text-secondary)' }}>
        {node.type === 'start' ? (
          <div style={{ color: 'var(--text-tertiary)' }}>Einstiegspunkt</div>
        ) : null}
        {node.type === 'wait' ? (
          <div>
            <strong style={{ color: 'var(--text-primary)', fontSize: 13 }}>
              {node.config.delay_days ?? 0}d
              {(node.config.delay_hours ?? 0) > 0 ? ` · ${node.config.delay_hours}h` : ''}
            </strong>
            <div style={{ color: 'var(--text-tertiary)', marginTop: 2 }}>warten</div>
          </div>
        ) : null}
        {node.type === 'email' ? (
          <>
            <div
              style={{
                fontSize: 12,
                color: 'var(--text-primary)',
                fontWeight: 500,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {node.config.template_id
                ? templates.find((t) => t.id === node.config.template_id)?.name ?? '(Template)'
                : node.config.subject || '(Betreff)'}
            </div>
            <div
              style={{
                marginTop: 4,
                fontSize: 10,
                color: 'var(--text-tertiary)',
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {node.config.body || '…'}
            </div>
          </>
        ) : null}
        {node.type === 'condition' ? (
          <>
            <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>
              {labelForCheck(node.config.check)}
            </div>
            <div style={{ marginTop: 4, fontSize: 10, color: 'var(--text-tertiary)' }}>
              innerhalb {node.config.within_days ?? 7} Tage
            </div>
          </>
        ) : null}
        {node.type === 'end' ? (
          <div style={{ color: 'var(--text-tertiary)' }}>Sequenz endet</div>
        ) : null}
      </div>

      {/* Out-Anchor (unten) */}
      {node.type !== 'end' ? (
        node.type === 'condition' ? (
          <>
            <Anchor
              x={NODE_W * 0.3}
              y={h}
              color="var(--accent-teal)"
              onMouseDown={(e) => onStartConnect('next', e)}
              tooltip="JA-Pfad"
              label="JA"
            />
            <Anchor
              x={NODE_W * 0.7}
              y={h}
              color="var(--accent-coral)"
              onMouseDown={(e) => onStartConnect('next_no', e)}
              tooltip="NEIN-Pfad"
              label="NEIN"
            />
          </>
        ) : (
          <Anchor
            x={NODE_W / 2}
            y={h}
            color={meta.accent}
            onMouseDown={(e) => onStartConnect('next', e)}
            tooltip="Verbindung ziehen"
          />
        )
      ) : null}
    </motion.div>
  )
}

function Anchor({
  x,
  y,
  color,
  onMouseDown,
  onClick,
  tooltip,
  label,
}: {
  x: number
  y: number
  color: string
  onMouseDown?: (e: ReactMouseEvent) => void
  onClick?: (e: ReactMouseEvent) => void
  tooltip: string
  label?: string
}) {
  return (
    <>
      <div
        data-no-drag
        title={tooltip}
        onMouseDown={onMouseDown}
        onClick={onClick}
        style={{
          position: 'absolute',
          left: x - 8,
          top: y - 8,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: color,
          border: '2px solid var(--bg-deep)',
          cursor: onMouseDown ? 'crosshair' : 'pointer',
          boxShadow: `0 0 0 3px color-mix(in srgb, ${color} 22%, transparent)`,
          zIndex: 5,
        }}
      />
      {label ? (
        <span
          style={{
            position: 'absolute',
            left: x - 14,
            top: y + 12,
            fontSize: 9,
            color,
            fontFamily: 'ui-monospace, monospace',
            letterSpacing: '0.08em',
            pointerEvents: 'none',
          }}
        >
          {label}
        </span>
      ) : null}
    </>
  )
}

// ============================================================
// NodeInspector
// ============================================================

function NodeInspector({
  node,
  templates,
  onUpdate,
  onUpdateConfig,
  onRemove,
}: {
  node: SequenceNode | null
  templates: SalesEmailTemplate[]
  onUpdate: (patch: Partial<SequenceNode>) => void
  onUpdateConfig: (patch: Partial<SequenceNode['config']>) => void
  onRemove: () => void
}) {
  if (!node) {
    return (
      <aside
        style={{
          background: 'var(--glass-1)',
          borderLeft: '1px solid var(--glass-border-1)',
          padding: 16,
          color: 'var(--text-tertiary)',
          fontSize: 12,
        }}
      >
        <div
          className="font-mono"
          style={{
            fontSize: 9,
            letterSpacing: '0.14em',
            marginBottom: 12,
            color: 'var(--text-tertiary)',
          }}
        >
          NODE-EINSTELLUNGEN
        </div>
        <div
          style={{
            padding: 16,
            border: '1px dashed var(--glass-border-2)',
            borderRadius: 10,
            textAlign: 'center',
          }}
        >
          Wähle einen Node aus.
          <br />
          <span style={{ fontSize: 10 }}>Linke Spalte zum Hinzufügen.</span>
        </div>
      </aside>
    )
  }

  const meta = NODE_META[node.type]

  return (
    <aside
      style={{
        background: 'var(--glass-1)',
        borderLeft: '1px solid var(--glass-border-1)',
        padding: 16,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            background: `color-mix(in srgb, ${meta.accent} 18%, var(--glass-2))`,
            color: meta.accent,
            display: 'grid',
            placeItems: 'center',
            fontSize: 14,
            border: `1px solid ${meta.accent}`,
          }}
        >
          {meta.icon}
        </span>
        <div>
          <div
            className="font-mono"
            style={{ fontSize: 9, letterSpacing: '0.14em', color: 'var(--text-tertiary)' }}
          >
            NODE
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            {meta.label}
          </div>
        </div>
      </div>

      {node.type === 'wait' ? (
        <>
          <FieldRow label="Tage warten">
            <input
              type="number"
              min={0}
              value={node.config.delay_days ?? 0}
              onChange={(e) => onUpdateConfig({ delay_days: Math.max(0, parseInt(e.target.value || '0', 10)) })}
              style={inputStyle}
            />
          </FieldRow>
          <FieldRow label="Zusätzliche Stunden">
            <input
              type="number"
              min={0}
              max={23}
              value={node.config.delay_hours ?? 0}
              onChange={(e) =>
                onUpdateConfig({
                  delay_hours: Math.max(0, Math.min(23, parseInt(e.target.value || '0', 10))),
                })
              }
              style={inputStyle}
            />
          </FieldRow>
        </>
      ) : null}

      {node.type === 'email' ? (
        <>
          <FieldRow label="Template (optional)">
            <select
              value={node.config.template_id ?? ''}
              onChange={(e) => {
                const tplId = e.target.value || null
                const tpl = templates.find((t) => t.id === tplId)
                onUpdateConfig({
                  template_id: tplId,
                  subject: tpl ? tpl.subject : node.config.subject,
                  body: tpl ? tpl.body : node.config.body,
                })
              }}
              style={inputStyle}
            >
              <option value="">— Keins —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </FieldRow>
          <FieldRow label="Betreff">
            <input
              type="text"
              value={node.config.subject ?? ''}
              onChange={(e) => onUpdateConfig({ subject: e.target.value })}
              placeholder="Hallo {{first_name}}…"
              style={inputStyle}
            />
          </FieldRow>
          <FieldRow label="Body">
            <textarea
              value={node.config.body ?? ''}
              onChange={(e) => onUpdateConfig({ body: e.target.value })}
              rows={8}
              placeholder="Variablen: {{first_name}}, {{name}}, {{email}}, {{company}}"
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
            />
          </FieldRow>
          <div
            style={{
              padding: '6px 8px',
              background: 'var(--glass-2)',
              borderRadius: 7,
              fontSize: 10,
              color: 'var(--text-tertiary)',
              lineHeight: 1.6,
            }}
          >
            Variablen: <code style={{ color: 'var(--accent-blue)' }}>{'{{first_name}}'}</code>{' '}
            <code style={{ color: 'var(--accent-blue)' }}>{'{{name}}'}</code>{' '}
            <code style={{ color: 'var(--accent-blue)' }}>{'{{email}}'}</code>{' '}
            <code style={{ color: 'var(--accent-blue)' }}>{'{{company}}'}</code>
          </div>
        </>
      ) : null}

      {node.type === 'condition' ? (
        <>
          <FieldRow label="Prüfen">
            <select
              value={node.config.check ?? 'opened'}
              onChange={(e) =>
                onUpdateConfig({
                  check: e.target.value as 'opened' | 'replied' | 'not_opened' | 'not_replied',
                })
              }
              style={inputStyle}
            >
              <option value="opened">Mail geöffnet?</option>
              <option value="not_opened">Mail nicht geöffnet?</option>
              <option value="replied">Geantwortet?</option>
              <option value="not_replied">Nicht geantwortet?</option>
            </select>
          </FieldRow>
          <FieldRow label="Innerhalb (Tage)">
            <input
              type="number"
              min={1}
              value={node.config.within_days ?? 3}
              onChange={(e) =>
                onUpdateConfig({ within_days: Math.max(1, parseInt(e.target.value || '1', 10)) })
              }
              style={inputStyle}
            />
          </FieldRow>
          <div
            style={{
              padding: '6px 8px',
              background: 'var(--glass-2)',
              borderRadius: 7,
              fontSize: 10,
              color: 'var(--text-tertiary)',
              lineHeight: 1.5,
            }}
          >
            <strong style={{ color: 'var(--accent-teal)' }}>JA</strong>-Anker links →
            Bedingung erfüllt. <br />
            <strong style={{ color: 'var(--accent-coral)' }}>NEIN</strong>-Anker rechts →
            Bedingung nicht erfüllt.
          </div>
        </>
      ) : null}

      {node.type !== 'start' ? (
        <button
          type="button"
          onClick={onRemove}
          className="font-mono"
          style={{
            marginTop: 'auto',
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid color-mix(in srgb, var(--accent-coral) 50%, transparent)',
            background: 'transparent',
            color: 'var(--accent-coral)',
            fontSize: 10,
            cursor: 'pointer',
            letterSpacing: '0.08em',
          }}
        >
          NODE LÖSCHEN
        </button>
      ) : null}

      <div
        style={{
          fontSize: 10,
          color: 'var(--text-tertiary)',
          padding: '8px 0',
          borderTop: '1px solid var(--glass-border-2)',
          lineHeight: 1.5,
        }}
      >
        Tipp: Anker an der Unterseite eines Nodes ziehen → auf Ziel-Node loslassen.
        Doppelklick auf eine Linie löscht die Verbindung.
        <span style={{ display: 'block', marginTop: 4, opacity: 0.7 }}>
          Position X/Y: {Math.round(node.position.x)} · {Math.round(node.position.y)}
        </span>
      </div>
      <span style={{ display: 'none' }}>{node.id}</span>
      {/* unused-warning silencer */}
      <span style={{ display: 'none' }}>{JSON.stringify(onUpdate)}</span>
    </aside>
  )
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span
        className="font-mono"
        style={{
          fontSize: 9,
          letterSpacing: '0.12em',
          color: 'var(--text-tertiary)',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
      {children}
    </label>
  )
}

function labelForCheck(c?: string): string {
  switch (c) {
    case 'opened':
      return 'Mail geöffnet?'
    case 'not_opened':
      return 'Mail nicht geöffnet?'
    case 'replied':
      return 'Geantwortet?'
    case 'not_replied':
      return 'Nicht geantwortet?'
    default:
      return 'Bedingung'
  }
}

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '7px 9px',
  borderRadius: 7,
  border: '1px solid var(--glass-border-2)',
  background: 'var(--glass-2)',
  color: 'var(--text-primary)',
  fontSize: 12,
  outline: 'none',
}
