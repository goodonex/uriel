import { motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { SectionLabel } from '../components/SectionLabel'
import { generateId, loadList, saveList } from '../lib/storage'
import type { Contact } from '../types/db'
import { useContacts } from '../hooks/useContacts'

export type DeliverProjectStatus = 'active' | 'completed'

export interface DeliverProjectLocal {
  id: string
  name: string
  /** Referenz zu Kontakt-ID aus CRM (dieselbe Brand) */
  client_contact_id: string | null
  status: DeliverProjectStatus
  internal_notes: string
  client_area_notes: string
}

function emptyProject(): DeliverProjectLocal {
  return {
    id: generateId(),
    name: 'Neues Projekt',
    client_contact_id: null,
    status: 'active',
    internal_notes: '',
    client_area_notes: '',
  }
}

function contactLabel(c: Contact): string {
  const bits = [c.name, c.email].filter(Boolean)
  return bits.join(' · ')
}

export function DeliverMode() {
  const { slug } = useParams<{ slug: string }>()
  const contacts = useContacts(slug)

  const [items, setItems] = useState<DeliverProjectLocal[]>([])
  const itemsRef = useRef<DeliverProjectLocal[]>([])
  itemsRef.current = items

  useEffect(() => {
    if (!slug) {
      setItems([])
      return
    }
    const loaded = loadList<DeliverProjectLocal>([slug, 'deliver-projects'])
    setItems(loaded)
  }, [slug])

  const persist = useCallback(
    (next: DeliverProjectLocal[]) => {
      if (!slug) return
      saveList([slug, 'deliver-projects'], next)
    },
    [slug],
  )

  const addProject = () => {
    const next = [...itemsRef.current, emptyProject()]
    setItems(next)
    persist(next)
  }

  const patchProject = (id: string, patch: Partial<DeliverProjectLocal>) => {
    const next = itemsRef.current.map((p) =>
      p.id === id ? { ...p, ...patch } : p,
    )
    setItems(next)
    persist(next)
  }

  const removeProject = (id: string) => {
    const next = itemsRef.current.filter((p) => p.id !== id)
    setItems(next)
    persist(next)
  }

  const field = {
    width: '100%',
    padding: '8px 10px',
    borderRadius: 10,
    background: 'var(--glass-1)',
    border: '1px solid var(--glass-border-1)',
    color: 'var(--text-primary)',
    fontSize: 13,
  } as const

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
          onClick={addProject}
        >
          + Projekt
        </button>
      </div>

      <SectionLabel accent="var(--accent-teal)" tight>
        Projekte (localStorage · später Supabase `deliver_projects`)
      </SectionLabel>

      <div className="mt-3 flex flex-col gap-3">
        {items.length === 0 ? (
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

        {items.map((p, idx) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.04, duration: 0.35 }}
            className="glass-2"
            style={{
              borderRadius: 16,
              padding: 18,
              border: '1px solid var(--glass-border-1)',
              backdropFilter: 'var(--blur-md)',
              WebkitBackdropFilter: 'var(--blur-md)',
            }}
          >
            <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
              <input
                type="text"
                value={p.name}
                onChange={(e) => patchProject(p.id, { name: e.target.value })}
                className="font-display flex-1"
                style={{
                  ...field,
                  fontWeight: 600,
                  fontSize: 16,
                  minWidth: 160,
                }}
              />
              <select
                value={p.status}
                onChange={(e) =>
                  patchProject(p.id, {
                    status: e.target.value as DeliverProjectStatus,
                  })
                }
                className="font-mono shrink-0"
                style={{ ...field, maxWidth: 140, fontSize: 12 }}
              >
                <option value="active">Aktiv</option>
                <option value="completed">Abgeschlossen</option>
              </select>
            </div>

            <div className="mb-2">
              <label
                className="font-mono mb-1 block"
                style={{ fontSize: 10, color: 'var(--text-tertiary)' }}
              >
                Client-Referenz (Kontakt)
              </label>
              <select
                value={p.client_contact_id ?? ''}
                onChange={(e) =>
                  patchProject(p.id, {
                    client_contact_id:
                      e.target.value === '' ? null : e.target.value,
                  })
                }
                style={field}
              >
                <option value="">— kein Kontakt —</option>
                {contacts.items.map((c) => (
                  <option key={c.id} value={c.id}>
                    {contactLabel(c)}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <div>
                <label
                  className="font-mono mb-1 block"
                  style={{ fontSize: 10, color: 'var(--text-tertiary)' }}
                >
                  Interner Bereich
                </label>
                <textarea
                  value={p.internal_notes}
                  onChange={(e) =>
                    patchProject(p.id, { internal_notes: e.target.value })
                  }
                  rows={3}
                  style={{ ...field, resize: 'vertical' }}
                />
              </div>
              <div>
                <label
                  className="font-mono mb-1 block"
                  style={{ fontSize: 10, color: 'var(--text-tertiary)' }}
                >
                  Kundenbereich
                </label>
                <textarea
                  value={p.client_area_notes}
                  onChange={(e) =>
                    patchProject(p.id, { client_area_notes: e.target.value })
                  }
                  rows={3}
                  style={{ ...field, resize: 'vertical' }}
                />
              </div>
            </div>

            <button
              type="button"
              className="font-mono mt-3"
              style={{
                fontSize: 11,
                padding: '6px 12px',
                borderRadius: 10,
                border: '1px solid var(--accent-coral)',
                color: 'var(--accent-coral)',
              }}
              onClick={() => removeProject(p.id)}
            >
              Projekt entfernen
            </button>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}
