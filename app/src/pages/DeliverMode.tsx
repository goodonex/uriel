import { motion } from 'framer-motion'
import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { SectionLabel } from '../components/SectionLabel'
import { useContacts } from '../hooks/useContacts'
import { useDeliverProjects } from '../hooks/useDeliverProjects'
import { DELIVER_STAGE_ORDER } from '../types/db'
import type { DeliverProject, DeliverProjectStage } from '../types/db'
import { DELIVER_STAGE_LABEL } from './deliver/stageLabels'

function stageIndex(s: DeliverProjectStage): number {
  return DELIVER_STAGE_ORDER.indexOf(s)
}

function StageDots({ stage }: { stage: DeliverProjectStage }) {
  const idx = stageIndex(stage)
  return (
    <div className="flex items-center gap-1">
      {DELIVER_STAGE_ORDER.map((key, i) => (
        <div
          key={key}
          title={DELIVER_STAGE_LABEL[key]}
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: i <= idx ? 'var(--accent-teal)' : 'var(--glass-3)',
            border: `1px solid ${i <= idx ? 'var(--accent-teal)' : 'var(--glass-border-2)'}`,
          }}
        />
      ))}
    </div>
  )
}

export function DeliverMode() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const projects = useDeliverProjects(slug)
  const contacts = useContacts(slug)

  const contactNameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of contacts.items) m.set(c.id, c.name)
    return m
  }, [contacts.items])

  const clientDisplay = (p: DeliverProject) => {
    if (p.client_contact_id) {
      return contactNameById.get(p.client_contact_id) ?? p.client_name
    }
    return p.client_name || '—'
  }

  return (
    <motion.div
      key={slug}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      style={{ background: 'transparent', pointerEvents: 'auto' }}
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div
            className="font-mono"
            style={{
              fontSize: 10,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--accent-teal)',
              marginBottom: 6,
            }}
          >
            Deliver Modus
          </div>
          <h2
            className="font-display"
            style={{
              fontSize: 22,
              fontWeight: 600,
              color: 'var(--text-primary)',
              letterSpacing: '-0.3px',
            }}
          >
            Kundenprojekte
          </h2>
        </div>
        {!projects.loading && !projects.error ? (
          <button
            type="button"
            className="font-mono"
            style={{
              fontSize: 12,
              padding: '10px 16px',
              borderRadius: 12,
              border: '1px solid var(--glass-border-2)',
              background: 'var(--glass-3)',
              color: 'var(--accent-teal)',
            }}
            onClick={() => {
              const p = projects.create()
              navigate(`/brand/${slug}/deliver/${p.id}`)
            }}
          >
            + Projekt
          </button>
        ) : null}
      </div>

      <SectionLabel accent="var(--accent-teal)" tight>
        Projekte · localStorage / Supabase `deliver_projects`
      </SectionLabel>

      {projects.loading ? (
        <div
          className="animate-pulse mt-3"
          style={{
            minHeight: 160,
            borderRadius: 16,
            background: 'var(--glass-1)',
            border: '1px solid var(--glass-border-1)',
          }}
        />
      ) : null}

      {projects.error ? (
        <p className="font-mono mt-3" style={{ fontSize: 12, color: 'var(--accent-coral)' }}>
          {projects.error}
        </p>
      ) : null}

      <div className="mt-3 flex flex-col gap-3">
        {!projects.loading && projects.items.length === 0 ? (
          <div
            className="glass-2 font-mono"
            style={{
              borderRadius: 14,
              padding: 20,
              border: '1px solid var(--glass-border-1)',
              fontSize: 12,
              color: 'var(--text-tertiary)',
            }}
          >
            Noch keine Projekte — „+ Projekt“ legt eines an.
          </div>
        ) : null}

        {projects.items.map((p, idx) => (
          <motion.button
            key={p.id}
            type="button"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.04, duration: 0.35 }}
            className="glass-2 text-left"
            style={{
              borderRadius: 16,
              padding: 18,
              border: '1px solid var(--glass-border-1)',
              backdropFilter: 'var(--blur-md)',
              WebkitBackdropFilter: 'var(--blur-md)',
              cursor: 'pointer',
            }}
            onClick={() => navigate(`/brand/${slug}/deliver/${p.id}`)}
          >
            <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
              <div>
                <div
                  className="font-display"
                  style={{
                    fontSize: 17,
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                  }}
                >
                  {p.name}
                </div>
                <div className="font-mono mt-1" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  Client: {clientDisplay(p)}
                </div>
              </div>
              <span
                className="font-mono shrink-0"
                style={{
                  fontSize: 10,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  padding: '6px 12px',
                  borderRadius: 999,
                  border: '1px solid var(--glass-border-2)',
                  color:
                    p.status === 'completed' ? 'var(--text-tertiary)' : 'var(--accent-teal)',
                  background: 'var(--glass-1)',
                }}
              >
                {p.status === 'completed' ? 'Abgeschlossen' : 'Aktiv'}
              </span>
            </div>
            <div className="font-mono mb-2" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
              Fortschritt · {DELIVER_STAGE_LABEL[p.internal_stage]}
            </div>
            <StageDots stage={p.internal_stage} />
          </motion.button>
        ))}
      </div>
    </motion.div>
  )
}
