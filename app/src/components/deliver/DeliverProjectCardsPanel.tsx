import { motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Drawer } from '../Drawer'
import { EmptyState } from '../EmptyState'
import { SectionLabel } from '../SectionLabel'
import { CARD_TILE_TAP } from '../../modules/CardTile'
import { useContacts } from '../../hooks/useContacts'
import { useDeliverProjects } from '../../hooks/useDeliverProjects'
import { isPitchProject } from '../../lib/projectAreas'
import type { DeliverProject } from '../../types/db'
import { DELIVER_STAGE_LABEL } from '../../pages/deliver/stageLabels'

type Filter = 'active' | 'completed'

export function DeliverProjectCardsPanel({ filter }: { filter: Filter }) {
  const { slug = '' } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const projects = useDeliverProjects(slug)
  const contacts = useContacts(slug)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [formName, setFormName] = useState('')
  const [formContactId, setFormContactId] = useState('')

  const contactNameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of contacts.items) m.set(c.id, c.name || c.email || c.id)
    return m
  }, [contacts.items])

  const filtered = useMemo(
    () =>
      projects.items.filter((p) =>
        filter === 'completed' ? p.status === 'completed' : p.status !== 'completed',
      ),
    [projects.items, filter],
  )

  const openNewDrawer = () => {
    setFormName('')
    setFormContactId('')
    setDrawerOpen(true)
  }

  const handleCreateFromDrawer = () => {
    if (!slug) return
    const c = contacts.items.find((x) => x.id === formContactId)
    void projects
      .create({
        name: formName.trim() || 'Neues Projekt',
        client_contact_id: c ? c.id : null,
        client_name: c ? (c.name || c.email || '') : '',
        client_email: c?.email?.trim() ?? '',
        status: 'active',
      })
      .then((p) => {
        setDrawerOpen(false)
        navigate(`/brand/${slug}/deliver/${p.id}`, { state: { showClientInvite: true } })
      })
      .catch(() => {})
  }

  const clientDisplay = (p: DeliverProject) => {
    if (p.client_contact_id) {
      return contactNameById.get(p.client_contact_id) ?? p.client_name
    }
    return p.client_name || '—'
  }

  const title = filter === 'completed' ? 'Abgeschlossene Projekte' : 'Aktive Projekte'

  return (
    <div style={{ paddingBottom: 16 }}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <SectionLabel accent="var(--accent-teal)" tight>
          {title}
        </SectionLabel>
        {filter === 'active' && filtered.length > 0 && !projects.error ? (
          <button
            type="button"
            className="font-mono"
            style={{
              fontSize: 12,
              padding: '8px 14px',
              borderRadius: 10,
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

      {projects.loading ? (
        <div
          className="animate-pulse"
          style={{
            minHeight: 120,
            borderRadius: 16,
            background: 'var(--glass-1)',
            border: '1px solid var(--glass-border-1)',
          }}
        />
      ) : null}

      {projects.error ? (
        <p className="font-mono" style={{ fontSize: 12, color: 'var(--accent-coral)' }}>
          {projects.error}
        </p>
      ) : null}

      {!projects.loading && !projects.error && filtered.length === 0 ? (
        <EmptyState
          icon="◇"
          title={filter === 'completed' ? 'Keine abgeschlossenen Projekte' : 'Noch keine Projekte'}
          description={
            filter === 'completed'
              ? 'Abgeschlossene Projekte erscheinen hier.'
              : 'Lege das erste Kundenprojekt an.'
          }
          actionLabel={filter === 'active' ? '+ Neues Projekt' : undefined}
          onAction={filter === 'active' ? openNewDrawer : undefined}
          accent="var(--accent-teal)"
        />
      ) : null}

      {!projects.loading && !projects.error && filtered.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filtered.map((p, idx) => (
            <motion.div
              key={p.id}
              {...CARD_TILE_TAP}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04, duration: 0.35 }}
              className="glass-2 flex flex-col"
              style={{
                borderRadius: 18,
                padding: 20,
                border: '1px solid var(--glass-border-1)',
              }}
            >
              <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div
                    className="font-display truncate"
                    style={{ fontSize: 17, fontWeight: 600, color: 'var(--text-primary)' }}
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
                <div className="flex shrink-0 flex-wrap gap-1">
                  {isPitchProject(p) ? (
                    <span
                      className="font-mono"
                      style={{
                        fontSize: 9,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        padding: '5px 10px',
                        borderRadius: 999,
                        border: '1px solid var(--mode-sales)',
                        color: 'var(--mode-sales)',
                        background: 'color-mix(in srgb, var(--mode-sales) 10%, transparent)',
                      }}
                    >
                      Pitch
                    </span>
                  ) : null}
                  <span
                    className="font-mono"
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
              </div>
              <div className="font-mono mb-4" style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                Zuletzt {p.updated_at.slice(0, 10) || '—'}
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

      {filter === 'active' ? (
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
      ) : null}
    </div>
  )
}
