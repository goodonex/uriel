import { useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useDeliverProjects } from '../../hooks/useDeliverProjects'
import { DELIVER_STAGE_LABEL } from '../../pages/deliver/stageLabels'
import type { DeliverProject } from '../../types/db'

const STAGES: DeliverProject['internal_stage'][] = [
  'onboarding',
  'discover',
  'inner_world',
  'visual_world',
  'execute',
]

export function DeliverMoonStatusPanel() {
  const { slug = '' } = useParams<{ slug: string }>()
  const projects = useDeliverProjects(slug)

  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of STAGES) m.set(s, 0)
    for (const p of projects.items) {
      if (p.status === 'completed') continue
      m.set(p.internal_stage, (m.get(p.internal_stage) ?? 0) + 1)
    }
    return m
  }, [projects.items])

  const active = projects.items.filter((p) => p.status !== 'completed').length
  const done = projects.items.filter((p) => p.status === 'completed').length

  return (
    <div style={{ paddingBottom: 24 }}>
      <div
        className="font-mono"
        style={{
          fontSize: 10,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--accent-teal)',
          marginBottom: 8,
        }}
      >
        Mond-Status
      </div>
      <h2
        className="font-display"
        style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}
      >
        Deliver Orbit
      </h2>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 32,
          flexWrap: 'wrap',
          marginBottom: 24,
        }}
      >
        <div style={{ position: 'relative', width: 120, height: 120 }}>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background: 'radial-gradient(circle at 35% 30%, #6b6b78, #2a2a32)',
              boxShadow: '0 0 40px rgba(94, 227, 193, 0.15)',
            }}
          />
          {STAGES.map((stage, i) => {
            const t = (i / STAGES.length) * Math.PI * 2 - Math.PI / 2
            const r = 52
            const x = 60 + Math.cos(t) * r
            const y = 60 + Math.sin(t) * r
            const n = counts.get(stage) ?? 0
            return (
              <div
                key={stage}
                title={`${DELIVER_STAGE_LABEL[stage]}: ${n}`}
                style={{
                  position: 'absolute',
                  left: x - 6,
                  top: y - 6,
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: n > 0 ? 'var(--accent-teal)' : 'rgba(120,120,140,0.4)',
                  boxShadow: n > 0 ? '0 0 12px var(--accent-teal)' : 'none',
                }}
              />
            )
          })}
        </div>
        <div>
          <div className="font-display" style={{ fontSize: 28, fontWeight: 600, color: 'var(--text-primary)' }}>
            {active}
          </div>
          <div className="font-mono" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
            aktive Projekte im Orbit
          </div>
          <div className="font-mono mt-2" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            {done} abgeschlossen (Krater)
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {STAGES.map((stage) => (
          <div
            key={stage}
            className="glass-2 flex items-center justify-between"
            style={{
              padding: '10px 12px',
              borderRadius: 12,
              border: '1px solid var(--glass-border-1)',
            }}
          >
            <span className="font-mono" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
              {DELIVER_STAGE_LABEL[stage]}
            </span>
            <span className="font-display" style={{ fontSize: 16, fontWeight: 600, color: 'var(--accent-teal)' }}>
              {counts.get(stage) ?? 0}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
