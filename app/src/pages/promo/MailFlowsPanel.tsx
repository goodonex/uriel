/**
 * MailFlowsPanel — Verwaltung + Whiteboard-Builder für E-Mail-Sequenzen.
 *
 * Linke Sidebar: Liste aller Flows + "+ Neuer Flow".
 * Hauptbereich: SequenceBuilderCanvas für den ausgewählten Flow.
 */
import { useEffect, useMemo, useState } from 'react'
import { SequenceBuilderCanvas } from '../../components/promo/SequenceBuilderCanvas'
import { SwarmCheckButton } from '../../components/swarm/SwarmCheckButton'
import { useToast } from '../../components/Toast'
import { useEmailSequences } from '../../hooks/useEmailSequences'
import { useEmailTemplates } from '../../hooks/useSalesPro'
import { triggerSequenceWorker } from '../../lib/emailService'
import type { EmailSequence, SequenceNode } from '../../types/db'

interface MailFlowsPanelProps {
  slug: string
}

function debounce<F extends (...args: never[]) => void>(fn: F, ms: number): F {
  let h: number | null = null
  return ((...args: never[]) => {
    if (h) window.clearTimeout(h)
    h = window.setTimeout(() => fn(...args), ms)
  }) as F
}

export function MailFlowsPanel({ slug }: MailFlowsPanelProps) {
  const seqs = useEmailSequences(slug)
  const tpls = useEmailTemplates(slug)
  const { show } = useToast()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [triggering, setTriggering] = useState(false)

  const active = useMemo(
    () => seqs.items.find((s) => s.id === activeId) ?? null,
    [seqs.items, activeId],
  )

  const swarmContent = useMemo(() => {
    if (!active) return ''
    return active.nodes
      .filter((n) => n.type === 'email')
      .map((n) => `${n.config.subject ?? ''}\n${n.config.body ?? ''}`)
      .join('\n\n---\n\n')
  }, [active])

  // Beim ersten Render: wenn keine Sequence geladen, wähle die erste
  useEffect(() => {
    if (!activeId && seqs.items.length > 0) setActiveId(seqs.items[0].id)
  }, [seqs.items, activeId])

  const debouncedPersist = useMemo(
    () =>
      debounce((id: string, nodes: SequenceNode[]) => {
        void seqs.update(id, { nodes })
      }, 600),
    [seqs],
  )

  const onChangeNodes = (nodes: SequenceNode[]) => {
    if (!active) return
    debouncedPersist(active.id, nodes)
  }

  const createNew = async () => {
    const name = window.prompt('Name des Mail-Flows?', 'Cold Outreach Sequenz')
    if (!name?.trim()) return
    const created = await seqs.create({ name: name.trim() })
    setActiveId(created.id)
    show('Flow erstellt', 'success')
  }

  const toggleActive = async () => {
    if (!active) return
    await seqs.update(active.id, { active: !active.active })
    show(active.active ? 'Flow pausiert' : 'Flow aktiviert', 'success')
  }

  const triggerWorker = async () => {
    setTriggering(true)
    const res = await triggerSequenceWorker()
    setTriggering(false)
    show(
      res.ok ? `Worker gelaufen (${res.processed ?? 0} Einträge)` : 'Worker fehlgeschlagen',
      res.ok ? 'success' : 'info',
    )
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16, minHeight: 600 }}>
      {/* Sidebar */}
      <aside
        style={{
          background: 'var(--glass-1)',
          border: '1px solid var(--glass-border-1)',
          borderRadius: 14,
          padding: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          height: 'fit-content',
        }}
      >
        <div
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}
        >
          <span
            className="font-mono"
            style={{
              fontSize: 9,
              letterSpacing: '0.14em',
              color: 'var(--text-tertiary)',
            }}
          >
            FLOWS
          </span>
          <button
            type="button"
            onClick={createNew}
            className="font-mono"
            style={{
              fontSize: 10,
              padding: '4px 9px',
              borderRadius: 7,
              border: '1px solid var(--mode-promo)',
              background: 'color-mix(in srgb, var(--mode-promo) 16%, transparent)',
              color: 'var(--mode-promo)',
              cursor: 'pointer',
            }}
          >
            + Neu
          </button>
        </div>

        {seqs.loading ? (
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Lädt…</div>
        ) : seqs.items.length === 0 ? (
          <div
            style={{
              padding: 16,
              border: '1px dashed var(--glass-border-2)',
              borderRadius: 10,
              fontSize: 11,
              color: 'var(--text-tertiary)',
              textAlign: 'center',
              lineHeight: 1.5,
            }}
          >
            Noch keine Flows.
            <br />
            <strong>+ Neu</strong> klicken.
          </div>
        ) : (
          seqs.items.map((s) => (
            <FlowItem
              key={s.id}
              flow={s}
              active={s.id === activeId}
              onSelect={() => setActiveId(s.id)}
            />
          ))
        )}

        <div
          style={{
            marginTop: 'auto',
            paddingTop: 10,
            borderTop: '1px solid var(--glass-border-2)',
          }}
        >
          <button
            type="button"
            onClick={triggerWorker}
            disabled={triggering}
            className="font-mono"
            style={{
              width: '100%',
              fontSize: 10,
              padding: '7px 10px',
              borderRadius: 7,
              border: '1px solid var(--glass-border-2)',
              background: 'var(--glass-2)',
              color: 'var(--text-secondary)',
              cursor: triggering ? 'wait' : 'pointer',
              opacity: triggering ? 0.6 : 1,
            }}
            title="Manuell den Sequenz-Worker auslösen (sonst alle 5 Min via Cron)"
          >
            {triggering ? 'Worker läuft …' : '↻ Worker triggern'}
          </button>
        </div>
      </aside>

      {/* Builder */}
      {!active ? (
        <div
          style={{
            background: 'var(--glass-1)',
            border: '1px dashed var(--glass-border-2)',
            borderRadius: 14,
            display: 'grid',
            placeItems: 'center',
            color: 'var(--text-tertiary)',
            fontSize: 13,
          }}
        >
          Wähle einen Flow aus oder erstelle einen neuen.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Header über Canvas */}
          <header
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              padding: '0 4px',
            }}
          >
            <div>
              <input
                type="text"
                value={active.name}
                onChange={(e) => seqs.update(active.id, { name: e.target.value })}
                className="font-display"
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  letterSpacing: '-0.3px',
                  width: 400,
                }}
              />
              <input
                type="text"
                value={active.description}
                onChange={(e) => seqs.update(active.id, { description: e.target.value })}
                placeholder="Kurze Beschreibung …"
                className="font-mono"
                style={{
                  display: 'block',
                  fontSize: 11,
                  color: 'var(--text-tertiary)',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  width: 400,
                  marginTop: 2,
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="email"
                value={active.from_email}
                onChange={(e) => seqs.update(active.id, { from_email: e.target.value })}
                placeholder="Absender-E-Mail"
                className="font-mono"
                style={{
                  fontSize: 11,
                  padding: '7px 9px',
                  borderRadius: 8,
                  border: '1px solid var(--glass-border-2)',
                  background: 'var(--glass-2)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  width: 200,
                }}
              />
              <input
                type="text"
                value={active.from_name}
                onChange={(e) => seqs.update(active.id, { from_name: e.target.value })}
                placeholder="Absender-Name"
                className="font-mono"
                style={{
                  fontSize: 11,
                  padding: '7px 9px',
                  borderRadius: 8,
                  border: '1px solid var(--glass-border-2)',
                  background: 'var(--glass-2)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  width: 140,
                }}
              />
              <SwarmCheckButton slug={slug} contentType="email" content={swarmContent} />
              <button
                type="button"
                onClick={toggleActive}
                className="font-mono"
                style={{
                  fontSize: 11,
                  padding: '7px 14px',
                  borderRadius: 8,
                  border: `1px solid ${active.active ? 'var(--accent-teal)' : 'var(--glass-border-2)'}`,
                  background: active.active
                    ? 'color-mix(in srgb, var(--accent-teal) 18%, transparent)'
                    : 'var(--glass-2)',
                  color: active.active ? 'var(--accent-teal)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                {active.active ? '● Aktiv' : '○ Inaktiv'}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!window.confirm(`Flow „${active.name}" löschen?`)) return
                  void seqs.remove(active.id)
                  setActiveId(null)
                }}
                className="font-mono"
                style={{
                  fontSize: 11,
                  padding: '7px 10px',
                  borderRadius: 8,
                  border: '1px solid color-mix(in srgb, var(--accent-coral) 50%, transparent)',
                  background: 'transparent',
                  color: 'var(--accent-coral)',
                  cursor: 'pointer',
                }}
              >
                Löschen
              </button>
            </div>
          </header>

          <div style={{ height: 680 }}>
            <SequenceBuilderCanvas
              key={active.id}
              nodes={active.nodes}
              templates={tpls.items}
              onChange={onChangeNodes}
              height="100%"
            />
          </div>
        </div>
      )}
    </div>
  )
}

function FlowItem({
  flow,
  active,
  onSelect,
}: {
  flow: EmailSequence
  active: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="font-mono"
      style={{
        width: '100%',
        textAlign: 'left',
        padding: '9px 11px',
        borderRadius: 9,
        border: active
          ? '1px solid var(--mode-promo)'
          : '1px solid var(--glass-border-2)',
        background: active
          ? 'color-mix(in srgb, var(--mode-promo) 14%, var(--glass-2))'
          : 'var(--glass-2)',
        cursor: 'pointer',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 4,
        }}
      >
        <span
          style={{
            fontSize: 12,
            color: 'var(--text-primary)',
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: 160,
          }}
        >
          {flow.name}
        </span>
        <span
          className="font-mono"
          style={{
            fontSize: 9,
            color: flow.active ? 'var(--accent-teal)' : 'var(--text-tertiary)',
            letterSpacing: '0.08em',
          }}
        >
          {flow.active ? '● LIVE' : '○ OFF'}
        </span>
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
        {flow.nodes.length} Nodes
      </div>
    </button>
  )
}
