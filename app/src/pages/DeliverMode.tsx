import { motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Drawer } from '../components/Drawer'
import { EmptyState } from '../components/EmptyState'
import { SectionLabel } from '../components/SectionLabel'
import { useContacts } from '../hooks/useContacts'
import { useDeliverProjects } from '../hooks/useDeliverProjects'
import type { DeliverProject } from '../types/db'
import { DELIVER_STAGE_LABEL } from './deliver/stageLabels'

export function DeliverMode() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const projects = useDeliverProjects(slug)
  const contacts = useContacts(slug)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [formName, setFormName] = useState('')
  const [formContactId, setFormContactId] = useState('')
  const [formStatus, setFormStatus] = useState<'active' | 'completed'>('active')

  const contactNameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of contacts.items) m.set(c.id, c.name || c.email || c.id)
    return m
  }, [contacts.items])

  const openNewDrawer = () => {
    setFormName('')
    setFormContactId('')
    setFormStatus('active')
    setDrawerOpen(true)
  }

  const handleCreateFromDrawer = () => {
    if (!slug) return
    const c = contacts.items.find((x) => x.id === formContactId)
    const p = projects.create({
      name: formName.trim() || 'Neues Projekt',
      client_contact_id: c ? c.id : null,
      client_name: c ? (c.name || c.email || '') : '',
      status: formStatus,
    })
    setDrawerOpen(false)
    navigate(`/brand/${slug}/deliver/${p.id}`, { state: { showClientInvite: true } })
  }

  const clientDisplay = (p: DeliverProject) => {
    if (p.client_contact_id) {
      return contactNameById.get(p.client_contact_id) ?? p.client_name
    }
    return p.client_name || '—'
  }

  const updatedLabel = (iso: string) => {
    const d = iso.slice(0, 10)
    return d || '—'
  }

  if (!slug) {
    return null
  }

  const hasProjects = !projects.loading && projects.items.length > 0

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
        {hasProjects && !projects.error ? (
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
            onClick={openNewDrawer}
          >
            + Neues Projekt
          </button>
        ) : null}
      </div>

      <SectionLabel accent="var(--accent-teal)" tight>
        Projekte
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

      {!projects.loading && !projects.error && projects.items.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon="◇"
            title="Noch keine Projekte"
            description="Lege das erste Kundenprojekt an, um Deliver und das Kundenportal zu nutzen."
            actionLabel="+ Neues Projekt"
            onAction={openNewDrawer}
            accent="var(--accent-teal)"
          />
        </div>
      ) : null}

      {!projects.loading && !projects.error && projects.items.length > 0 ? (
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {projects.items.map((p, idx) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04, duration: 0.35 }}
              className="glass-2 flex flex-col"
              style={{
                borderRadius: 18,
                padding: 20,
                border: '1px solid var(--glass-border-1)',
                backdropFilter: 'var(--blur-md)',
                WebkitBackdropFilter: 'var(--blur-md)',
              }}
            >
              <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div
                    className="font-display truncate"
                    style={{
                      fontSize: 17,
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                    }}
                  >
                    {p.name}
                  </div>
                  <div
                    className="font-mono mt-1 truncate"
                    style={{ fontSize: 11, color: 'var(--text-secondary)' }}
                  >
                    {clientDisplay(p)}
                  </div>
                </div>
                <span
                  className="font-mono shrink-0"
                  style={{
                    fontSize: 9,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    padding: '5px 10px',
                    borderRadius: 999,
                    border: '1px solid var(--glass-border-2)',
                    color: 'var(--accent-teal)',
                    background: 'var(--glass-1)',
                  }}
                >
                  {DELIVER_STAGE_LABEL[p.internal_stage]}
                </span>
              </div>
              <div
                className="font-mono mb-4"
                style={{ fontSize: 10, color: 'var(--text-tertiary)' }}
              >
                Zuletzt {updatedLabel(p.updated_at)}
                {p.status === 'completed' ? (
                  <span style={{ color: 'var(--text-tertiary)', marginLeft: 8 }}>· Abgeschlossen</span>
                ) : null}
              </div>
              <button
                type="button"
                className="font-mono mt-auto w-full"
                style={{
                  fontSize: 12,
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: '1px solid var(--glass-border-2)',
                  background: 'var(--glass-3)',
                  color: 'var(--text-primary)',
                }}
                onClick={() => navigate(`/brand/${slug}/deliver/${p.id}`)}
              >
                Zum Projekt
              </button>
            </motion.div>
          ))}
        </div>
      ) : null}

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Neues Projekt">
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="font-mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
              Projektname
            </span>
            <input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="font-mono rounded-lg px-3 py-2"
              style={{
                fontSize: 13,
                border: '1px solid var(--glass-border-2)',
                background: 'var(--glass-1)',
                color: 'var(--text-primary)',
              }}
              placeholder="z. B. Website Relaunch"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
              Kontakt (optional)
            </span>
            <select
              value={formContactId}
              onChange={(e) => setFormContactId(e.target.value)}
              className="font-mono rounded-lg px-3 py-2"
              style={{
                fontSize: 13,
                border: '1px solid var(--glass-border-2)',
                background: 'var(--glass-1)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="">— Kein Kontakt —</option>
              {contacts.items.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name || c.email || c.id}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-mono" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
              Status
            </span>
            <select
              value={formStatus}
              onChange={(e) =>
                setFormStatus(e.target.value === 'completed' ? 'completed' : 'active')
              }
              className="font-mono rounded-lg px-3 py-2"
              style={{
                fontSize: 13,
                border: '1px solid var(--glass-border-2)',
                background: 'var(--glass-1)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="active">Aktiv</option>
              <option value="completed">Abgeschlossen</option>
            </select>
          </label>
          <button
            type="button"
            className="font-mono mt-2"
            style={{
              fontSize: 13,
              padding: '12px 16px',
              borderRadius: 12,
              border: '1px solid var(--accent-teal)',
              background: 'color-mix(in srgb, var(--accent-teal) 22%, transparent)',
              color: 'var(--accent-teal)',
            }}
            onClick={handleCreateFromDrawer}
          >
            Anlegen &amp; öffnen
          </button>
        </div>
      </Drawer>
    </motion.div>
  )
}
